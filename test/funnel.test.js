'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const F = require('../lib/funnel');
const C = require('../lib/communities');
const Q = require('../lib/qualify');
const scoring = require('../lib/scoring');

/** Walk the funnel the way a buyer does, saying yes to the ids in `likes`. */
function walk(likes, cap) {
  const swipes = [];
  const trail = [];
  for (let i = 0; i < (cap || 20); i += 1) {
    const card = F.next(swipes);
    if (!card) break;
    const yes = likes.indexOf(card.id) > -1;
    trail.push({ id: card.id, dir: yes ? 'y' : 'n', aliveBefore: F.replay(swipes).alive.length });
    swipes.push({ id: card.id, dir: yes ? 'y' : 'n' });
  }
  return { swipes, trail, state: F.replay(swipes) };
}

function leadFrom(swipes, answers) {
  const now = new Date().toISOString();
  return {
    id: 'ld_0000000000000000',
    createdAt: now, updatedAt: now, completedAt: null,
    contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '+971501234567' },
    swipes, answers: answers || {}, tiebreaks: {},
  };
}

const READY = { purpose: 'live', budget: 'b4', payment: 'cash_uae', timeline: 'now', viewing: 'here_now', commute: 'marina' };

/* ------------------------------------------------- the funnel narrows */

test('it opens on the broadest question there is', () => {
  const first = F.next([]);
  assert.equal(first.id, 'k-villa');
  assert.equal(first.stage, 1);
});

test('saying no to a villa kills every villa question and every villa-only area', () => {
  const { swipes, state } = walk(['k-apartment', 'l-waterfront']);
  const askedIds = swipes.map((s) => s.id);
  for (const id of ['l-golf', 'v-majlis', 'v-staff', 'extra-garage', 'pool-private', 'l-lagoon', 'g-mansion']) {
    assert.ok(askedIds.indexOf(id) === -1, `${id} should never be asked of an apartment buyer`);
  }
  for (const community of state.alive) {
    assert.ok(community.from.apartment, `${community.name} has no apartments and should be gone`);
  }
  assert.equal(state.kind, 'apartment');
});

test('saying yes to a villa kills the towers and the tower questions', () => {
  const { swipes, state } = walk(['k-villa', 'l-golf']);
  const askedIds = swipes.map((s) => s.id);
  for (const id of ['l-waterfront', 'l-central', 'l-beachapt', 'green-balcony']) {
    assert.ok(askedIds.indexOf(id) === -1, `${id} should never be asked of a villa buyer`);
  }
  for (const community of state.alive) {
    assert.ok(community.from.villa, `${community.name} has no villas and should be gone`);
  }
});

test('yes to golf narrows to golf communities, and the next questions split those', () => {
  const golf = walk(['k-villa', 'l-golf']);
  assert.ok(golf.state.alive.length >= 2);
  for (const community of golf.state.alive) {
    assert.ok((community.attrs.golf || 0) >= 2, `${community.name} has no golf and should be gone`);
  }
  const afterGolf = golf.swipes.findIndex((s) => s.id === 'l-golf');
  const later = golf.swipes.slice(afterGolf + 1).map((s) => s.id);
  assert.ok(later.length, 'the funnel should keep asking after golf');
  assert.ok(later.every((id) => F.BY_ID[id].stage >= 2), 'and never go back to a broader stage');
});

test('every answer either narrows the pool or refines the ranking, never widens it', () => {
  const { trail, swipes } = walk(['k-villa', 'l-golf', 'g-established', 'pool-private']);
  let previous = C.COMMUNITIES.length;
  for (let i = 0; i < trail.length; i += 1) {
    const after = F.replay(swipes.slice(0, i + 1)).alive.length;
    assert.ok(after <= previous, `card ${trail[i].id} widened the pool`);
    previous = after;
  }
});

test('the stages only ever move forward', () => {
  for (const likes of [['k-villa', 'l-golf'], ['k-apartment', 'l-waterfront', 'l-beachapt'], []]) {
    const { swipes } = walk(likes);
    let stage = 0;
    for (const s of swipes) {
      const card = F.BY_ID[s.id];
      assert.ok(card.stage >= stage, `${card.id} went back from stage ${stage} to ${card.stage}`);
      stage = card.stage;
    }
  }
});

test('the funnel ends, and ends narrow', () => {
  const villa = walk(['k-villa', 'l-golf', 'g-established']);
  assert.ok(villa.swipes.length <= F.MAX_CARDS);
  assert.ok(villa.state.alive.length <= 4, `expected a short list, got ${villa.state.alive.length}`);
  assert.equal(F.next(villa.swipes), null);
});

test('a buyer who says no to everything is still left with something to be shown', () => {
  const { state, swipes } = walk([]);
  assert.ok(state.alive.length >= 2, 'never narrow to nothing');
  assert.ok(swipes.length <= F.MAX_CARDS);
});

test('a filter that would empty the pool is applied softly instead', () => {
  // Beachfront villas are few; stack the questions so the hard filters collide.
  const { state } = walk(['k-villa', 'l-beachvilla', 'l-lagoon', 'g-mansion', 'g-established']);
  assert.ok(state.alive.length >= 2, `pool emptied to ${state.alive.length}`);
});

test('the same swipes always replay to the same state', () => {
  const { swipes } = walk(['k-villa', 'l-golf']);
  const a = F.replay(swipes);
  const b = F.replay(swipes.slice());
  assert.deepEqual(a.alive.map((c) => c.id), b.alive.map((c) => c.id));
  assert.deepEqual(a.signals, b.signals);
  assert.equal(a.kind, b.kind);
});

test('an unknown card id in the history is ignored rather than trusted', () => {
  const state = F.replay([{ id: 'not-a-card', dir: 'y' }, { id: 'k-villa', dir: 'y' }]);
  assert.equal(state.kind, 'villa');
});

test('every card has a picture, a facet and both branches', () => {
  const imgDir = path.join(__dirname, '..', 'public', 'img');
  for (const card of F.CARDS) {
    assert.ok(card.t && card.c, `${card.id} needs a title and caption`);
    assert.ok(card.facet && card.facet.length === 2, `${card.id} needs a facet`);
    assert.ok(typeof card.when === 'function', `${card.id} needs a when()`);
    for (const branch of ['yes', 'no']) {
      assert.ok(typeof card[branch].keep === 'function', `${card.id}.${branch} needs keep()`);
    }
    assert.ok(fs.existsSync(path.join(imgDir, `${card.img}.svg`)), `${card.id} has no illustration`);
  }
});

/* ------------------------------------------------- what it produces */

test('the shortlist comes from what survived, not from the whole map', () => {
  const { swipes, state } = walk(['k-villa', 'l-golf', 'g-established']);
  const lead = leadFrom(swipes, READY);
  const opts = { signals: C.signalsFor(lead, state.signals), alive: state.alive, kind: state.kind };
  const areas = C.match(lead, opts);
  const aliveNames = state.alive.map((c) => c.name);
  for (const row of areas.top.concat(areas.also)) {
    assert.ok(aliveNames.indexOf(row.name) > -1, `${row.name} was eliminated and should not be on the list`);
  }
});

test('narrowing further is worth more than swiping more', () => {
  const narrow = F.hotness(leadFrom(walk(['k-villa', 'l-golf', 'g-established']).swipes, READY));
  const broad = F.hotness(leadFrom(walk([]).swipes, READY));
  const narrowClarity = narrow.parts.find((p) => p.key === 'Clarity').got;
  const broadClarity = broad.parts.find((p) => p.key === 'Clarity').got;
  assert.ok(narrowClarity > broadClarity, 'a buyer who narrowed should read as clearer');
});

test('a budget that cannot reach the shortlist is flagged by name', () => {
  const { swipes } = walk(['k-villa', 'l-beachvilla']);
  const hot = F.hotness(leadFrom(swipes, { ...READY, budget: 'b2' }));
  const flag = hot.flags.find((f) => f.tone === 'bad');
  assert.ok(flag, 'expected a budget flag');
  assert.match(flag.text, /Budget will not reach/);
});

test('the dashboard summary carries the narrowing and the areas', () => {
  const { swipes } = walk(['k-villa', 'l-golf', 'g-established']);
  const summary = scoring.summarise(leadFrom(swipes, READY));
  assert.equal(summary.narrowing.from, C.COMMUNITIES.length);
  assert.ok(summary.narrowing.to <= 4);
  assert.ok(summary.areas.top.length >= 1);
  assert.equal(summary.kind, 'villa');
  assert.match(summary.kindLabel, /villa/);
  assert.match(summary.briefText, /Areas that suit them/);
});

test('a drop-out is reported with how far the funnel had got', () => {
  const stale = new Date(Date.now() - scoring.ABANDON_AFTER_MS - 1000).toISOString();
  const { swipes } = walk(['k-villa', 'l-golf']);
  const lead = leadFrom(swipes.slice(0, 2), {});
  lead.updatedAt = stale;
  const summary = scoring.summarise(lead);
  assert.equal(summary.status, 'abandoned');
  assert.ok(summary.dropOff.narrowedTo < C.COMMUNITIES.length);
  assert.match(summary.dropOff.stage, /after "/);
});

test('the brief says what kind of home they settled on', () => {
  const { swipes } = walk(['k-apartment', 'l-waterfront', 'l-beachapt']);
  const text = F.briefText(leadFrom(swipes, READY));
  assert.match(text, /Looking for: an apartment/);
  assert.match(text, /Cash, already in the UAE/);
});

test('the browser copies of all three engines match the source', () => {
  for (const name of ['qualify.js', 'communities.js', 'funnel.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', name), 'utf8');
    const copy = fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
    assert.ok(copy.endsWith(src), `public/${name} is stale, run \`npm run sync\``);
  }
});

test('the questions and the money vocabulary still answer', () => {
  assert.equal(Q.option('budget', 'b4').l, 'AED 4M to 8M');
  assert.equal(Q.money(2500000), 'AED 2.5M');
  assert.equal(Q.budgetMax('b6'), Infinity);
  assert.ok(Q.validEmail('a@b.co'));
  assert.ok(!Q.validEmail('nope'));
});

test('the static site is built from the current client page', () => {
  const fragment = fs.readFileSync(path.join(__dirname, '..', 'public', 'shortlist.html'), 'utf8');
  const expected = require('../scripts/build-pages').wrap(fragment);
  for (const file of ['public/index.html', 'docs/index.html']) {
    const built = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.equal(built, expected, `${file} is stale, run \`npm run pages\``);
  }
  // Phones need this or the page renders at desktop width.
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8'), /name="viewport"/);
  for (const name of ['qualify.js', 'communities.js', 'funnel.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', name), 'utf8');
    const copy = fs.readFileSync(path.join(__dirname, '..', 'docs', name), 'utf8');
    assert.equal(copy, src, `docs/${name} is stale, run \`npm run pages\``);
  }
});
