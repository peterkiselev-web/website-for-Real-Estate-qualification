'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Q = require('../lib/qualify');
const scoring = require('../lib/scoring');

function lead(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 'ld_0000000000000000',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '+971501234567' },
    area: 'Dubai Marina',
    branch: 'apartment',
    swipes: [],
    answers: {},
    ...overrides,
  };
}

const FULL_DECK = [
  { id: 'd1-marina', dir: 'y', round: 1 },
  { id: 'd1-downtown', dir: 'y', round: 1 },
  { id: 'd1-community', dir: 'n', round: 1 },
  { id: 'd1-beach', dir: 'n', round: 1 },
  { id: 'd1-golf', dir: 'n', round: 1 },
  { id: 'd1-offplan', dir: 'n', round: 1 },
  { id: 'a-seaview', dir: 'y', round: 2 },
  { id: 'a-highfloor', dir: 'y', round: 2 },
  { id: 'green-balcony', dir: 'y', round: 2 },
  { id: 'layout-open', dir: 'y', round: 2 },
  { id: 'pool-community', dir: 'y', round: 2 },
  { id: 'extra-gated', dir: 'n', round: 2 },
  { id: 'pool-private', dir: 'n', round: 3 },
  { id: 'layout-office', dir: 'y', round: 3 },
  { id: 'green-roof', dir: 'y', round: 3 },
  { id: 'extra-station', dir: 'y', round: 3 },
  { id: 'layout-separate', dir: 'n', round: 3 },
  { id: 'extra-gym', dir: 'y', round: 3 },
];

const READY = { purpose: 'live', budget: 'b3', payment: 'cash_uae', timeline: 'now', viewing: 'here_now' };

/* ----------------------------------------------------------- the deck */

test('round one is the same wide net for everyone', () => {
  const deck = Q.buildRound(1, 'mixed', []);
  assert.equal(deck.length, 6);
  assert.deepEqual(deck.slice().sort(), Q.ROUND1.slice().sort());
});

test('round two is chosen by the branch and never repeats a card', () => {
  const swipes = [{ id: 'd1-community', dir: 'y', round: 1 }];
  const villa = Q.buildRound(2, Q.decideBranch(swipes), swipes);
  assert.equal(villa.length, 6);
  assert.ok(villa.includes('v-majlis'), 'a villa buyer gets asked about a majlis');
  assert.ok(!villa.some((id) => swipes.some((s) => s.id === id)));

  const apartment = Q.buildRound(2, 'apartment', []);
  assert.ok(apartment.includes('a-seaview'));
  assert.ok(!apartment.includes('v-majlis'), 'an apartment buyer is not asked about a staff majlis');
});

test('round three always settles the water question', () => {
  for (const branch of Object.keys(Q.ROUND2)) {
    const deck = Q.buildRound(3, branch, []);
    assert.equal(deck.length, 6, `${branch} should still deal six`);
    assert.ok(deck.some((id) => id.startsWith('pool-')), `${branch} should be asked about a pool`);
  }
});

test('a branch is only claimed when one corner clearly wins', () => {
  assert.equal(Q.decideBranch([{ id: 'd1-beach', dir: 'y', round: 1 }]), 'prime');
  assert.equal(Q.decideBranch([]), 'mixed');
  const tie = [
    { id: 'd1-marina', dir: 'y', round: 1 },   // apartment 2
    { id: 'd1-community', dir: 'y', round: 1 }, // villa 2
  ];
  assert.equal(Q.decideBranch(tie), 'mixed');
});

test('every card carries an answer, an illustration and tags', () => {
  const imgDir = path.join(__dirname, '..', 'public', 'img');
  for (const [id, card] of Object.entries(Q.CARDS)) {
    assert.ok(card.t && card.c, `${id} needs a title and caption`);
    assert.ok(Array.isArray(card.f) && card.f.length === 2, `${id} needs a facet`);
    assert.ok(fs.existsSync(path.join(imgDir, `${id}.svg`)), `${id} has no illustration`);
  }
});

/* ------------------------------------------------------- the hotness */

test('the perfect lead scores 100 and is told to be called today', () => {
  const h = Q.hotness(lead({ swipes: FULL_DECK, answers: READY }));
  assert.equal(h.value, 100);
  assert.equal(h.label, 'Ready to proceed');
  assert.match(h.advice, /Call today/);
});

test('a tyre-kicker who finishes the whole deck is still not hot', () => {
  const h = Q.hotness(lead({
    swipes: FULL_DECK,
    answers: { purpose: 'live', budget: 'b3', payment: 'unsure', timeline: 'watch', viewing: 'remote' },
  }));
  assert.ok(h.value < 50, `expected a cool score, got ${h.value}`);
  assert.ok(h.flags.some((f) => /only watching/.test(f.text)));
  assert.ok(h.flags.some((f) => /Finance not arranged/.test(f.text)));
});

test('finance readiness moves the number more than anything else', () => {
  const base = { swipes: FULL_DECK, answers: { ...READY, payment: 'mortgage_no' } };
  const weak = Q.hotness(lead(base));
  const strong = Q.hotness(lead({ swipes: FULL_DECK, answers: READY }));
  assert.ok(strong.value - weak.value >= 15, 'cash in the UAE should clearly outrank an unstarted mortgage');
});

test('champagne taste on a lemonade budget is flagged, not hidden', () => {
  const h = Q.hotness(lead({
    swipes: [{ id: 'd1-beach', dir: 'y', round: 1 }],
    answers: { ...READY, budget: 'b2' },
  }));
  const flag = h.flags.find((f) => f.tone === 'bad');
  assert.ok(flag, 'expected a budget flag');
  assert.match(flag.text, /Budget will not reach/);
  assert.match(flag.text, /AED 15M/);
});

test('a budget that does reach the taste is not flagged', () => {
  const h = Q.hotness(lead({
    swipes: [{ id: 'd1-marina', dir: 'y', round: 1 }],
    answers: { ...READY, budget: 'b3' },
  }));
  assert.ok(!h.flags.some((f) => /Budget will not reach/.test(f.text)));
});

test('wanting both sides of an either/or reads as undecided', () => {
  const swipes = FULL_DECK.filter((s) => s.id !== 'pool-private').concat([
    { id: 'pool-private', dir: 'y', round: 3 },
    { id: 'pool-none', dir: 'y', round: 3 },
  ]);
  const clash = Q.hotness(lead({ swipes, answers: READY }));
  const clean = Q.hotness(lead({ swipes: FULL_DECK, answers: READY }));
  assert.ok(clash.value < clean.value);
  assert.ok(clash.flags.some((f) => /both sides/.test(f.text)));
});

test('someone who passes on everything is flagged rather than scored as decisive', () => {
  const allNo = FULL_DECK.map((s) => ({ ...s, dir: 'n' }));
  const h = Q.hotness(lead({ swipes: allNo, answers: READY }));
  assert.ok(h.flags.some((f) => /Passed on everything/.test(f.text)));
  assert.ok(h.value < 100);
});

test('the score is the sum of its published parts', () => {
  const h = Q.hotness(lead({ swipes: FULL_DECK, answers: READY }));
  const summed = h.parts.reduce((total, p) => total + p.got, 0);
  assert.equal(h.value, Math.min(100, Math.round(summed)));
  assert.deepEqual(h.parts.map((p) => p.key), ['Funds', 'Timing', 'Viewing', 'Clarity', 'Budget', 'Contact']);
});

/* ---------------------------------------------------------- the brief */

test('the brief carries what an agent needs to act', () => {
  const text = Q.briefText(lead({ swipes: FULL_DECK, answers: READY, branch: 'apartment' }));
  assert.match(text, /Alex Morgan/);
  assert.match(text, /Dubai Marina/);
  assert.match(text, /AED 2M to 4M/);
  assert.match(text, /Cash, already in the UAE/);
  assert.match(text, /sea view/);
  assert.match(text, /Ready to proceed/);
});

test('facets separate what they want from what they ruled out', () => {
  const f = Q.facets(FULL_DECK);
  const water = f.want.find((r) => r.key === 'Water');
  assert.deepEqual(water.values, ['shared pool']);
  const inside = f.no.find((r) => r.key === 'Inside');
  assert.ok(inside.values.includes('closed kitchen'));
});

/* --------------------------------------------------- dashboard shape */

test('a quiet session becomes a drop-off that names where they stopped', () => {
  const stale = new Date(Date.now() - scoring.ABANDON_AFTER_MS - 1000).toISOString();
  const summary = scoring.summarise(lead({
    updatedAt: stale,
    swipes: FULL_DECK.slice(0, 8),
  }));
  assert.equal(summary.status, 'abandoned');
  assert.match(summary.dropOff.stage, /round 2/);
  assert.equal(summary.dropOff.seen, 8);
});

test('a drop-off during the money questions says which question', () => {
  const stale = new Date(Date.now() - scoring.ABANDON_AFTER_MS - 1000).toISOString();
  const summary = scoring.summarise(lead({
    updatedAt: stale,
    swipes: FULL_DECK,
    answers: { purpose: 'live', budget: 'b3' },
  }));
  assert.match(summary.dropOff.stage, /readiness question 3 of 6/);
});

test('the dashboard view answers in words, not ids', () => {
  const summary = scoring.summarise(lead({ swipes: FULL_DECK, answers: READY }));
  assert.equal(summary.answers.payment, 'Cash, already in the UAE');
  assert.equal(summary.answers.budget, 'AED 2M to 4M');
  assert.equal(summary.branchLabel, 'apartments with a view');
  assert.equal(summary.progress.of, 18);
  assert.ok(summary.likes.every((c) => c.image.startsWith('/img/')));
});

test('the copy of the engine served to browsers matches the source', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'qualify.js'), 'utf8');
  const copy = fs.readFileSync(path.join(__dirname, '..', 'public', 'qualify.js'), 'utf8');
  assert.ok(copy.endsWith(src), 'public/qualify.js is stale, run `npm run sync`');
});
