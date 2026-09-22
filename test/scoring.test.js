'use strict';

const test = require('node:test');
const assert = require('node:assert');

const scoring = require('../lib/scoring');
const { buildDeck, CARDS } = require('../lib/deck');

function leadWith(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: 'ld_0000000000000000',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '' },
    brief: { propertyType: 'house', location: 'Shoreditch', budget: 'b4', timeline: 'now' },
    deckSize: 4,
    swipes: [],
    note: '',
    ...overrides,
  };
}

test('an empty session is cold, a finished one is hot', () => {
  const empty = scoring.score(leadWith());
  assert.ok(empty.value < 60, `expected a cold-ish score, got ${empty.value}`);

  const finished = scoring.score(leadWith({
    swipes: [
      { cardId: 'style-modern', direction: 'right', ms: 900 },
      { cardId: 'green-wild', direction: 'left', ms: 700 },
      { cardId: 'layout-open', direction: 'right', ms: 800 },
      { cardId: 'pool-private', direction: 'right', ms: 600 },
    ],
  }));
  assert.ok(finished.value >= 80, `expected a hot score, got ${finished.value}`);
  assert.equal(finished.label, 'Hot');
});

test('swiping carries more weight than typing contact details', () => {
  const formOnly = scoring.score(leadWith());
  const swipesOnly = scoring.score(leadWith({
    contact: { name: '', email: '', phone: '' },
    brief: {},
    swipes: [
      { cardId: 'style-modern', direction: 'right', ms: 900 },
      { cardId: 'green-wild', direction: 'left', ms: 700 },
      { cardId: 'layout-open', direction: 'right', ms: 800 },
      { cardId: 'pool-private', direction: 'left', ms: 600 },
    ],
  }));
  assert.ok(swipesOnly.value > formOnly.value, 'a full deck should beat a full form');
});

test('swiping right on everything is not decisive', () => {
  const mixed = scoring.score(leadWith({
    swipes: [
      { cardId: 'style-modern', direction: 'right' },
      { cardId: 'green-wild', direction: 'left' },
      { cardId: 'layout-open', direction: 'right' },
      { cardId: 'pool-private', direction: 'left' },
    ],
  }));
  const all = scoring.score(leadWith({
    swipes: [
      { cardId: 'style-modern', direction: 'right' },
      { cardId: 'green-wild', direction: 'right' },
      { cardId: 'layout-open', direction: 'right' },
      { cardId: 'pool-private', direction: 'right' },
    ],
  }));
  assert.ok(mixed.parts.decisiveness > all.parts.decisiveness);
});

test('facets split into wanted and rejected', () => {
  const lead = leadWith({
    swipes: [
      { cardId: 'pool-private', direction: 'right' },
      { cardId: 'pool-community', direction: 'left' },
    ],
  });
  const pool = scoring.facets(lead).find((f) => f.key === 'pool');
  assert.deepEqual(pool.wanted, ['private pool']);
  assert.deepEqual(pool.rejected, ['community pool']);
});

test('a tag the client also liked is never reported as a deal-breaker', () => {
  const lead = leadWith({
    swipes: [
      { cardId: 'green-roof', direction: 'right' },   // tags include "views"
      { cardId: 'style-tower', direction: 'left' },   // also tagged "views"
    ],
  });
  const summary = scoring.summarise(lead);
  assert.ok(summary.wants.some((w) => w.tag === 'views'));
  assert.ok(!summary.avoid.some((w) => w.tag === 'views'));
});

test('a quiet session becomes a drop-off with the card they stopped on', () => {
  const stale = new Date(Date.now() - scoring.ABANDON_AFTER_MS - 1000).toISOString();
  const lead = leadWith({
    updatedAt: stale,
    swipes: [{ cardId: 'style-modern', direction: 'right' }],
  });
  const summary = scoring.summarise(lead);
  assert.equal(summary.status, 'abandoned');
  assert.match(summary.dropOff.stage, /Glass-front new build/);
  assert.equal(summary.dropOff.seen, 1);
});

test('finished sessions never read as abandoned', () => {
  const stale = new Date(Date.now() - scoring.ABANDON_AFTER_MS - 1000).toISOString();
  const lead = leadWith({ updatedAt: stale, completedAt: stale });
  assert.equal(scoring.derivedStatus(lead), 'completed');
});

test('budget reads back in the configured currency', () => {
  assert.equal(scoring.budgetLabel(leadWith(), '£'), '£750k to £1M');
  assert.equal(scoring.budgetLabel(leadWith({ brief: { budget: 'b6' } }), '$'), '$2M+');
  assert.equal(scoring.budgetLabel(leadWith({ brief: {} })), 'Budget not given');
});

test('the CRM summary carries the facts an agent needs', () => {
  const lead = leadWith({
    swipes: [{ cardId: 'pool-private', direction: 'right' }],
    note: 'Near a good school please',
  });
  const text = scoring.summaryText(lead, '£');
  assert.match(text, /Alex Morgan/);
  assert.match(text, /Shoreditch/);
  assert.match(text, /£750k to £1M/);
  assert.match(text, /private pool/);
  assert.match(text, /Near a good school/);
});

test('the deck stays inside the limit, never repeats and respects property type', () => {
  const deck = buildDeck('apartment', 20);
  assert.ok(deck.length <= 20);
  assert.equal(new Set(deck.map((c) => c.id)).size, deck.length);
  assert.ok(!deck.some((c) => c.id === 'green-lawn'), 'no lawns for an apartment');
  assert.ok(deck.every((c) => c.title && c.caption && c.image));

  const houseDeck = buildDeck('house', 20);
  assert.ok(houseDeck.some((c) => c.id === 'green-lawn'));
});

test('the deck deals categories round robin so it never drags', () => {
  const deck = buildDeck('house', 10);
  const firstFive = deck.slice(0, 5).map((c) => c.category);
  assert.equal(new Set(firstFive).size, 5, 'the first five cards should each be a different category');
});

test('every card has an illustration and scoring metadata', () => {
  for (const card of CARDS) {
    assert.ok(card.facet && card.facet.key && card.facet.value, `${card.id} needs a facet`);
    assert.ok(Array.isArray(card.tags) && card.tags.length, `${card.id} needs tags`);
    assert.match(card.image, /^(https?:)?\/?\/?.+/);
  }
});
