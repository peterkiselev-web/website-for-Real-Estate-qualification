'use strict';

/**
 * The dashboard's view of a lead. The judgement lives in lib/funnel.js and
 * lib/communities.js, which the client page runs too; this only shapes it.
 */

const Q = require('./qualify');
const C = require('./communities');
const F = require('./funnel');

const ABANDON_AFTER_MS = 20 * 60 * 1000;
const QUESTION_COUNT = 6; // purpose, budget, commute, payment, timeline, viewing

function answeredCount(lead) {
  return Object.keys(lead.answers || {}).length;
}

function derivedStatus(lead, now) {
  if (lead.completedAt) return 'completed';
  const idle = (now || Date.now()) - new Date(lead.updatedAt).getTime();
  if (idle > ABANDON_AFTER_MS) return 'abandoned';
  if (answeredCount(lead)) return 'answering';
  return (lead.swipes || []).length ? 'swiping' : 'started';
}

/** Where they stopped, and how far the funnel had narrowed by then. */
function dropOff(lead, status, state) {
  if (status !== 'abandoned') return null;
  const swipes = lead.swipes || [];
  const answered = answeredCount(lead);
  const narrowed = state.alive.length;
  if (answered) {
    return {
      stage: 'on question ' + (answered + 1) + ' of ' + QUESTION_COUNT,
      seen: swipes.length,
      narrowedTo: narrowed,
    };
  }
  if (!swipes.length) return { stage: 'before the first card', seen: 0, narrowedTo: narrowed };
  const last = swipes[swipes.length - 1];
  const card = F.BY_ID[last.id];
  return {
    stage: card ? 'after "' + card.t + '"' : 'after card ' + swipes.length,
    seen: swipes.length,
    narrowedTo: narrowed,
  };
}

function labelFor(group, id) {
  const found = Q.option(group, id);
  return found ? found.l : '';
}

/** Everything the dashboard renders for one lead. */
function summarise(lead, options) {
  const opts = options || {};
  const status = derivedStatus(lead, opts.now);
  const swipes = lead.swipes || [];
  const state = F.replay(swipes);
  const signals = C.signalsFor(lead, state.signals);
  const matchOpts = { signals: signals, alive: state.alive, kind: state.kind };
  const areas = C.match(lead, matchOpts);
  const shortlist = C.shortlistText(lead, matchOpts);
  const hot = F.hotness(lead);
  const f = F.facets(swipes);

  return {
    id: lead.id,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    completedAt: lead.completedAt,
    status: status,
    dropOff: dropOff(lead, status, state),
    contact: lead.contact,
    note: lead.note,
    agentNotes: lead.agentNotes,
    archived: !!lead.archived,
    kind: state.kind,
    kindLabel: F.kindLabel(state.kind),
    narrowing: {
      from: C.COMMUNITIES.length,
      to: state.alive.length,
      ruledOut: C.COMMUNITIES.length - state.alive.length,
    },
    answers: {
      purpose: labelFor('purpose', (lead.answers || {}).purpose),
      budget: labelFor('budget', (lead.answers || {}).budget),
      payment: labelFor('payment', (lead.answers || {}).payment),
      timeline: labelFor('timeline', (lead.answers || {}).timeline),
      viewing: labelFor('viewing', (lead.answers || {}).viewing),
      commute: labelFor('commute', (lead.answers || {}).commute),
    },
    areas: { top: areas.top, also: areas.also, outOfReach: areas.outOfReach, kind: areas.kind },
    shortlistText: shortlist,
    hotness: hot,
    progress: { done: swipes.length, of: F.MAX_CARDS, answered: answeredCount(lead), questions: QUESTION_COUNT },
    facets: f,
    likes: F.likes(swipes).map((s) => F.publicCard(F.BY_ID[s.id])),
    passes: swipes.filter((s) => s.dir === 'n' && F.BY_ID[s.id]).map((s) => F.publicCard(F.BY_ID[s.id])),
    briefText: 'Areas that suit them:\n' + shortlist + '\n\n' + F.briefText(lead),
  };
}

module.exports = {
  summarise,
  derivedStatus,
  dropOff,
  validEmail: Q.validEmail,
  ABANDON_AFTER_MS,
  QUESTION_COUNT,
};
