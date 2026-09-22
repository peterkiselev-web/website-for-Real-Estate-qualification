'use strict';

/**
 * Turns a pile of swipes into something an agent can act on in ten seconds:
 * a score, a temperature, a list of wants and deal-breakers, and a paragraph
 * they can paste into an email.
 */

const { CARDS_BY_ID, BUDGET_BANDS, TIMELINES, CATEGORIES } = require('./deck');

const ABANDON_AFTER_MS = 20 * 60 * 1000; // quiet for this long and it is a drop-off

const TEMPERATURES = [
  { min: 80, label: 'Hot', tone: 'hot', advice: 'Call today. They finished the deck and told you what they want.' },
  { min: 60, label: 'Qualified', tone: 'warm', advice: 'Enough to send matching properties. Confirm budget on the call.' },
  { min: 35, label: 'Warming', tone: 'cool', advice: 'Half a picture. One short call fills the gaps.' },
  { min: 0, label: 'Cold', tone: 'cold', advice: 'Dropped out early. Worth one nudge, not a viewing slot.' },
];

function budgetBand(id) {
  return BUDGET_BANDS.find((b) => b.id === id) || null;
}

function timeline(id) {
  return TIMELINES.find((t) => t.id === id) || null;
}

function formatMoney(value, symbol) {
  if (value === null || value === undefined) return '';
  if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)}M`;
  if (value >= 1000) return `${symbol}${Math.round(value / 1000)}k`;
  return `${symbol}${value}`;
}

function budgetLabel(lead, symbol = '$') {
  const band = budgetBand(lead.brief && lead.brief.budget);
  if (!band) return 'Budget not given';
  if (band.max === null) return `${formatMoney(band.min, symbol)}+`;
  if (band.min === 0) return `Up to ${formatMoney(band.max, symbol)}`;
  return `${formatMoney(band.min, symbol)} to ${formatMoney(band.max, symbol)}`;
}

/** Split swipes into liked and passed cards, newest information last. */
function partition(lead) {
  const liked = [];
  const passed = [];
  for (const swipe of lead.swipes || []) {
    const card = CARDS_BY_ID.get(swipe.cardId);
    if (!card) continue;
    const entry = { card, ms: swipe.ms || 0, at: swipe.at };
    (swipe.direction === 'right' ? liked : passed).push(entry);
  }
  return { liked, passed };
}

/**
 * Facets are the direct answers: "pool: private pool" beats a tag cloud when
 * the agent is deciding what to send.
 */
function facets(lead) {
  const { liked, passed } = partition(lead);
  const wanted = new Map();
  const rejected = new Map();

  for (const { card } of liked) {
    if (!card.facet) continue;
    if (!wanted.has(card.facet.key)) wanted.set(card.facet.key, []);
    wanted.get(card.facet.key).push(card.facet.value);
  }
  for (const { card } of passed) {
    if (!card.facet) continue;
    if (!rejected.has(card.facet.key)) rejected.set(card.facet.key, []);
    rejected.get(card.facet.key).push(card.facet.value);
  }

  const keys = [...new Set([...wanted.keys(), ...rejected.keys()])];
  return keys.map((key) => ({
    key,
    wanted: wanted.get(key) || [],
    rejected: rejected.get(key) || [],
  }));
}

function tagCounts(lead) {
  const { liked, passed } = partition(lead);
  const counts = new Map();
  for (const { card } of liked) {
    for (const tag of card.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const wants = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  const negative = new Map();
  for (const { card } of passed) {
    for (const tag of card.tags || []) negative.set(tag, (negative.get(tag) || 0) + 1);
  }
  // A tag only counts as a deal-breaker if they never swiped right on it.
  const avoid = [...negative.entries()]
    .filter(([tag]) => !counts.has(tag))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));

  return { wants, avoid };
}

function derivedStatus(lead, now = Date.now()) {
  if (lead.completedAt) return 'completed';
  const idleFor = now - new Date(lead.updatedAt).getTime();
  if (idleFor > ABANDON_AFTER_MS) return 'abandoned';
  return (lead.swipes || []).length ? 'swiping' : 'started';
}

/** Where they stopped. This is the bit agents currently never get to see. */
function dropOff(lead, status) {
  if (status !== 'abandoned') return null;
  const swipes = lead.swipes || [];
  const done = swipes.length;
  if (!done) return { stage: 'the very first card', seen: 0, of: lead.deckSize || 0 };
  const last = CARDS_BY_ID.get(swipes[done - 1].cardId);
  return {
    stage: last ? `after "${last.title}"` : `after card ${done}`,
    seen: done,
    of: lead.deckSize || done,
  };
}

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Weighted so the swiping carries the score. Contact details alone are what
 * every boring form already collects, and they qualify nobody.
 */
function score(lead) {
  const parts = { contact: 0, brief: 0, intent: 0, swipes: 0, decisiveness: 0 };
  const contact = lead.contact || {};
  const brief = lead.brief || {};

  if (contact.name && contact.name.trim().length > 1) parts.contact += 6;
  if (validEmail(contact.email)) parts.contact += 10;
  if (contact.phone) parts.contact += 4;
  parts.contact = Math.min(parts.contact, 18);

  if (brief.propertyType) parts.brief += 6;
  if (brief.location && brief.location.trim().length > 1) parts.brief += 7;
  if (brief.budget) parts.brief += 7;

  const tl = timeline(brief.timeline);
  parts.intent = tl ? Math.round(tl.weight * 10) : 0;

  const total = lead.deckSize || 0;
  const done = (lead.swipes || []).length;
  parts.swipes = total ? Math.round(Math.min(done / total, 1) * 42) : 0;

  // Someone who swipes right on everything has told you nothing. Reward a mix.
  if (done >= 4) {
    const rights = lead.swipes.filter((s) => s.direction === 'right').length;
    const ratio = rights / done;
    parts.decisiveness = ratio > 0.05 && ratio < 0.95 ? 10 : 4;
  }

  const value = Math.min(
    100,
    parts.contact + parts.brief + parts.intent + parts.swipes + parts.decisiveness
  );
  const temperature = TEMPERATURES.find((t) => value >= t.min);
  return { value, parts, ...temperature };
}

function timeSpentMs(lead) {
  return (lead.swipes || []).reduce((sum, s) => sum + (s.ms || 0), 0);
}

/** A paragraph the agent can paste straight into an email or a CRM note. */
function summaryText(lead, symbol = '$') {
  const contact = lead.contact || {};
  const brief = lead.brief || {};
  const { liked, passed } = partition(lead);
  const facetList = facets(lead);
  const s = score(lead);
  const lines = [];

  lines.push(`${contact.name || 'Unnamed lead'} (${contact.email || 'no email'})`);
  if (contact.phone) lines.push(`Phone: ${contact.phone}`);
  lines.push(
    `Looking for: ${brief.propertyType || 'unspecified'} in ${brief.location || 'unspecified area'}, ${budgetLabel(lead, symbol)}.`
  );
  const tl = timeline(brief.timeline);
  if (tl) lines.push(`Timing: ${tl.label}.`);
  lines.push(`Qualification: ${s.label} (${s.value}/100), ${liked.length} likes from ${(lead.swipes || []).length} cards.`);

  for (const facet of facetList) {
    if (!facet.wanted.length) continue;
    lines.push(`${capitalise(facet.key)}: wants ${facet.wanted.join(', ')}${facet.rejected.length ? `; ruled out ${facet.rejected.join(', ')}` : ''}.`);
  }

  if (!facetList.some((f) => f.wanted.length) && passed.length) {
    lines.push('Passed on everything shown so far, so the deck did not narrow anything down.');
  }
  if (lead.note) lines.push(`Their note: "${lead.note}"`);
  return lines.join('\n');
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** The full object the agent dashboard renders. */
function summarise(lead, options = {}) {
  const symbol = options.currency || '$';
  const status = derivedStatus(lead, options.now);
  const { liked, passed } = partition(lead);
  const { wants, avoid } = tagCounts(lead);
  const s = score(lead);

  return {
    id: lead.id,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    completedAt: lead.completedAt,
    status,
    dropOff: dropOff(lead, status),
    contact: lead.contact,
    brief: {
      ...lead.brief,
      budgetLabel: budgetLabel(lead, symbol),
      timelineLabel: (timeline(lead.brief && lead.brief.timeline) || {}).label || '',
    },
    note: lead.note,
    agentNotes: lead.agentNotes,
    archived: !!lead.archived,
    score: s,
    progress: { done: (lead.swipes || []).length, of: lead.deckSize || 0 },
    secondsSpent: Math.round(timeSpentMs(lead) / 1000),
    likes: liked.map(({ card, ms }) => ({
      id: card.id,
      title: card.title,
      image: card.image,
      category: card.category,
      categoryLabel: CATEGORIES[card.category].label,
      seconds: Math.round(ms / 100) / 10,
    })),
    passes: passed.map(({ card }) => ({
      id: card.id,
      title: card.title,
      image: card.image,
      category: card.category,
      categoryLabel: CATEGORIES[card.category].label,
    })),
    facets: facets(lead),
    wants,
    avoid,
    summaryText: summaryText(lead, symbol),
  };
}

/** What the client sees on the results screen. Same data, friendlier framing. */
function clientProfile(lead, options = {}) {
  const full = summarise(lead, options);
  return {
    score: { value: full.score.value, label: full.score.label, tone: full.score.tone },
    likes: full.likes,
    facets: full.facets,
    wants: full.wants.slice(0, 6),
    avoid: full.avoid.slice(0, 4),
    brief: full.brief,
    progress: full.progress,
  };
}

module.exports = {
  summarise,
  clientProfile,
  summaryText,
  score,
  facets,
  derivedStatus,
  budgetLabel,
  validEmail,
  ABANDON_AFTER_MS,
};
