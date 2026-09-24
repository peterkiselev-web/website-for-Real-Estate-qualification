'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const C = require('../lib/communities');
const F = require('../lib/funnel');
const Q = require('../lib/qualify');

function lead(overrides = {}) {
  return {
    contact: { name: 'Alex', email: 'a@b.co', phone: '' },
    swipes: [],
    answers: {},
    tiebreaks: {},
    ...overrides,
  };
}

const yes = (...ids) => ids.map((id) => ({ id, dir: 'y' }));
const no = (...ids) => ids.map((id) => ({ id, dir: 'n' }));

function rankOpts(l) {
  const state = F.replay(l.swipes);
  return { signals: C.signalsFor(l, state.signals), alive: state.alive, kind: state.kind };
}

/** Rank the way the app does: the funnel decides the pool, the matcher sorts it. */
function rank(l, extra) {
  const state = F.replay(l.swipes);
  const opts = { signals: C.signalsFor(l, state.signals), alive: state.alive, kind: state.kind };
  return C.match(l, Object.assign(opts, extra || {}));
}

/* ----------------------------------------------------- the dataset */

test('every community is priced, described and placed on the map', () => {
  const ids = new Set();
  for (const c of C.COMMUNITIES) {
    assert.ok(!ids.has(c.id), `${c.id} is listed twice`);
    ids.add(c.id);
    assert.ok(c.name && c.blurb && c.catch, `${c.id} needs a name, blurb and catch`);
    assert.ok(Object.keys(c.from).length, `${c.id} needs an entry price`);
    for (const [kind, price] of Object.entries(c.from)) {
      assert.ok(price > 100000 && price < 200000000, `${c.id} ${kind} price looks wrong`);
    }
    assert.ok(Object.keys(c.attrs).length >= 4, `${c.id} needs attributes to match on`);
    for (const key of Object.keys(c.attrs)) {
      assert.ok(C.PHRASE[key], `${c.id} uses an attribute with no phrase: ${key}`);
      assert.ok(c.attrs[key] >= 1 && c.attrs[key] <= 3, `${c.id}.${key} must be 1 to 3`);
    }
    for (const zone of ['downtown', 'marina', 'jebelali', 'deira']) {
      assert.ok(typeof c.drive[zone] === 'number', `${c.id} has no drive time to ${zone}`);
    }
  }
});

/* ------------------------------------------------------- matching */

test('gated, quiet, golf and a private pool lands on the golf communities', () => {
  const result = rank(lead({
    swipes: yes('k-villa', 'l-golf', 'c-gated', 'pool-private', 'v-majlis'),
    answers: { budget: 'b4', purpose: 'live', commute: 'marina' },
  }));
  const names = result.top.map((c) => c.name);
  assert.ok(
    names.some((n) => /Emirates Living|Jumeirah Golf Estates|Arabian Ranches|Dubai Hills|Damac Hills/.test(n)),
    `expected a golf or gated villa community, got ${names.join(', ')}`
  );
  assert.ok(!names.includes('Downtown Dubai'), 'a tower has no business on this list');
  assert.ok(result.top[0].reasons.length, 'the top match should say why');
});

test('waterfront taste with a Marina commute lands on the water', () => {
  const result = rank(lead({
    swipes: no('k-villa').concat(yes('k-apartment', 'l-waterfront', 'c-seaview', 'green-balcony')),
    answers: { budget: 'b3', purpose: 'live', commute: 'marina' },
  }));
  const names = result.top.map((c) => c.name);
  assert.ok(
    names.some((n) => /Marina|Jumeirah Beach Residence|Jumeirah Lake Towers|Emaar Beachfront/.test(n)),
    `expected a waterfront apartment area, got ${names.join(', ')}`
  );
});

test('a villa hunter is never shown an apartment-only community', () => {
  const result = rank(lead({
    swipes: yes('k-villa', 'v-majlis', 'v-staff', 'pool-private'),
    answers: { budget: 'b5' },
  }));
  const apartmentOnly = new Set(
    C.COMMUNITIES.filter((c) => !c.from.villa && !c.from.townhouse).map((c) => c.name)
  );
  for (const row of result.top.concat(result.also)) {
    assert.ok(!apartmentOnly.has(row.name), `${row.name} has no villas`);
  }
});

test('the budget decides what makes the list, and what is named as out of reach', () => {
  const dreamer = rank(lead({
    swipes: yes('k-villa', 'l-beachvilla', 'pool-private'),
    answers: { budget: 'b2', purpose: 'live' },
  }));
  for (const row of dreamer.top) {
    assert.notEqual(row.budget, 'over', `${row.name} is over budget and should not be a top pick`);
  }
  assert.ok(dreamer.outOfReach.length, 'the places they actually liked should be named as out of reach');

  const rich = rank(lead({
    swipes: yes('k-villa', 'l-beachvilla', 'pool-private'),
    answers: { budget: 'b6', purpose: 'live' },
  }));
  assert.ok(
    rich.top.some((c) => /Palm Jumeirah|Emirates Hills|District One|Umm Suqeim|Al Barari/.test(c.name)),
    `a 15M budget with beach taste should reach the prime areas, got ${rich.top.map((c) => c.name).join(', ')}`
  );
});

test('an investor is pushed towards the areas that rent', () => {
  const result = rank(lead({
    swipes: no('k-villa').concat(yes('k-apartment', 'l-offplan', 'c-yield', 'extra-gym')),
    answers: { budget: 'b2', purpose: 'invest' },
  }));
  const names = result.top.map((c) => c.name);
  assert.ok(
    names.some((n) => /Jumeirah Village|Business Bay|Sports City|Dubai South|Jumeirah Lake Towers|Silicon Oasis|Creek Harbour/.test(n)),
    `expected yield-led areas, got ${names.join(', ')}`
  );
});

test('the commute answer moves the shortlist', () => {
  const base = {
    swipes: yes('k-villa', 'l-family', 'extra-garage', 'pool-private'),
    answers: { budget: 'b4', purpose: 'live' },
  };
  const marina = rank(lead({ ...base, answers: { ...base.answers, commute: 'marina' } }));
  const deira = rank(lead({ ...base, answers: { ...base.answers, commute: 'deira' } }));
  assert.notDeepEqual(
    marina.top.map((c) => c.id),
    deira.top.map((c) => c.id),
    'where they work should change which villa community comes first'
  );
  const marinaTop = C.COMMUNITIES.find((c) => c.id === marina.top[0].id);
  assert.ok(marinaTop.drive.marina <= 30, 'the Marina commuter should not be sent to the far side of town');
});

test('match percentages are ordered and bounded', () => {
  const result = rank(lead({
    swipes: yes('k-villa', 'pool-private', 'v-majlis'),
    answers: { budget: 'b4' },
  }));
  assert.equal(result.top[0].match, 97);
  for (let i = 1; i < result.top.length; i += 1) {
    assert.ok(result.top[i].match <= result.top[i - 1].match);
    assert.ok(result.top[i].match >= 35 && result.top[i].match <= 99);
  }
});

/* ----------------------------------------------------- tie-breaks */

test('a tie-break is only asked when the leading areas disagree about it', () => {
  const tornLead = lead({ swipes: yes('k-villa'), answers: { budget: 'b6' } });
  const torn = C.pickTiebreakers(tornLead, 2, rankOpts(tornLead));
  assert.ok(torn.length, 'someone who likes both beach and golf should be asked to choose');
  for (const tb of torn) {
    assert.ok(tb.q && tb.options.length === 2, 'a tie-break needs a question and two options');
  }
});

test('a tie-break already answered is never asked twice', () => {
  const base = lead({ swipes: yes('k-villa'), answers: { budget: 'b6' } });
  const first = C.pickTiebreakers(base, 1, rankOpts(base))[0];
  const answered = { ...base, tiebreaks: { [first.id]: first.options[0].id } };
  const next = C.pickTiebreakers(answered, 2, rankOpts(answered));
  assert.ok(!next.some((tb) => tb.id === first.id));
});

test('answering a tie-break actually moves the shortlist', () => {
  const base = lead({ swipes: yes('k-villa', 'pool-private'), answers: { budget: 'b6', purpose: 'live' } });
  const beachy = rank({ ...base, tiebreaks: { 'tb-beach-golf': 'beach' } });
  const golfy = rank({ ...base, tiebreaks: { 'tb-beach-golf': 'golf' } });
  assert.notEqual(beachy.top[0].id, golfy.top[0].id, 'the answer should change the leader');
});

test('every tie-break option pushes attributes the communities actually have', () => {
  for (const tb of C.TIEBREAKERS) {
    for (const option of tb.options) {
      for (const key of Object.keys(option.s)) {
        assert.ok(C.PHRASE[key], `${tb.id}/${option.id} pushes an unknown attribute: ${key}`);
      }
    }
  }
});

/* --------------------------------------------------------- output */

test('the shortlist reads as sentences an agent can send', () => {
  const textLead = lead({
    swipes: yes('k-villa', 'pool-private', 'c-gated', 'l-family'),
    answers: { budget: 'b4', purpose: 'live', commute: 'downtown' },
  });
  const text = C.shortlistText(textLead, rankOpts(textLead));
  assert.match(text, /1\. /);
  assert.match(text, /% match/);
  assert.match(text, /AED/);
});
