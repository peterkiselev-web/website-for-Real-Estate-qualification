'use strict';

/**
 * The dashboard's view of a lead. All the judgement lives in lib/qualify.js,
 * which the client page runs too; this file only shapes it for the agent.
 */

const Q = require('./qualify');

const ABANDON_AFTER_MS = 20 * 60 * 1000;
const DECK_SIZE = 18; // three rounds of six
const QUESTION_COUNT = 5;

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

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

/** Where they stopped. The bit an agent never normally gets to see. */
function dropOff(lead, status) {
  if (status !== 'abandoned') return null;
  const swipes = lead.swipes || [];
  const answered = answeredCount(lead);
  if (answered) {
    return { stage: 'on readiness question ' + (answered + 1) + ' of ' + QUESTION_COUNT, seen: swipes.length, of: DECK_SIZE };
  }
  if (!swipes.length) return { stage: 'before the first card', seen: 0, of: DECK_SIZE };
  const last = swipes[swipes.length - 1];
  const card = Q.CARDS[last.id];
  return {
    stage: 'in round ' + (last.round || 1) + (card ? ', after "' + card.t + '"' : ''),
    seen: swipes.length,
    of: DECK_SIZE,
  };
}

function labelFor(group, id) {
  const found = Q.option(group, id);
  return found ? found.l : '';
}

function cardBrief(id) {
  const card = Q.CARDS[id];
  if (!card) return null;
  return { id: id, title: card.t, image: '/img/' + id + '.svg', heading: card.f[0], value: card.f[1] };
}

/** Everything the dashboard renders for one lead. */
function summarise(lead, options) {
  const opts = options || {};
  const status = derivedStatus(lead, opts.now);
  const swipes = lead.swipes || [];
  const hot = Q.hotness(lead);
  const f = Q.facets(swipes);

  return {
    id: lead.id,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    completedAt: lead.completedAt,
    status: status,
    dropOff: dropOff(lead, status),
    contact: lead.contact,
    area: lead.area,
    note: lead.note,
    agentNotes: lead.agentNotes,
    archived: !!lead.archived,
    branch: lead.branch,
    branchLabel: Q.BRANCH_NAME[lead.branch] || 'undecided',
    answers: {
      purpose: labelFor('purpose', (lead.answers || {}).purpose),
      budget: labelFor('budget', (lead.answers || {}).budget),
      payment: labelFor('payment', (lead.answers || {}).payment),
      timeline: labelFor('timeline', (lead.answers || {}).timeline),
      viewing: labelFor('viewing', (lead.answers || {}).viewing),
    },
    hotness: hot,
    progress: { done: swipes.length, of: DECK_SIZE, answered: answeredCount(lead), questions: QUESTION_COUNT },
    facets: f,
    likes: Q.likes(swipes).map((s) => cardBrief(s.id)).filter(Boolean),
    passes: swipes.filter((s) => s.dir === 'n').map((s) => cardBrief(s.id)).filter(Boolean),
    briefText: Q.briefText(lead),
  };
}

module.exports = {
  summarise,
  derivedStatus,
  dropOff,
  validEmail,
  ABANDON_AFTER_MS,
  DECK_SIZE,
  QUESTION_COUNT,
};
