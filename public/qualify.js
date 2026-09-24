/* GENERATED FILE. Edit lib/qualify.js and run `npm run sync`. */
/**
 * The tap questions and the money vocabulary.
 *
 * The swipe cards, the funnel engine and the scoring live in lib/funnel.js;
 * the areas live in lib/communities.js. This file is the bit both of them need
 * and neither of them owns, so it depends on nothing.
 *
 * Market: Dubai. Prices in AED.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Qualify = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CURRENCY = 'AED';

  /** `w` is the weight this answer contributes to its band of the hotness score. */
  const QUESTIONS = {
    purpose: {
      label: 'What it is for',
      options: [
        { id: 'live', l: 'To live in', w: 1 },
        { id: 'invest', l: 'Investment, for yield', w: 1 },
        { id: 'holiday', l: 'Holiday home', w: 0.9 },
        { id: 'flip', l: 'Buy and resell', w: 0.9 },
      ],
    },
    budget: {
      label: 'Budget',
      options: [
        { id: 'b1', l: 'Under AED 1M', min: 0, max: 1000000 },
        { id: 'b2', l: 'AED 1M to 2M', min: 1000000, max: 2000000 },
        { id: 'b3', l: 'AED 2M to 4M', min: 2000000, max: 4000000 },
        { id: 'b4', l: 'AED 4M to 8M', min: 4000000, max: 8000000 },
        { id: 'b5', l: 'AED 8M to 15M', min: 8000000, max: 15000000 },
        { id: 'b6', l: 'AED 15M and up', min: 15000000, max: null },
      ],
    },
    payment: {
      label: 'How it gets paid for',
      options: [
        { id: 'cash_uae', l: 'Cash, already in the UAE', w: 30 },
        { id: 'mortgage_ok', l: 'Mortgage pre-approved', w: 27 },
        { id: 'cash_abroad', l: 'Cash, transferring in', w: 23 },
        { id: 'mortgage_no', l: 'Mortgage, not applied yet', w: 12 },
        { id: 'sell_first', l: 'Need to sell something first', w: 7 },
        { id: 'unsure', l: 'Not worked that out yet', w: 3 },
      ],
    },
    timeline: {
      label: 'When',
      options: [
        { id: 'now', l: 'Ready to buy now', w: 20 },
        { id: 'month', l: 'Within a month', w: 16 },
        { id: 'quarter', l: '1 to 3 months', w: 12 },
        { id: 'half', l: '3 to 6 months', w: 6 },
        { id: 'watch', l: 'Watching the market', w: 2 },
      ],
    },
    viewing: {
      label: 'Viewing',
      options: [
        { id: 'here_now', l: 'In Dubai, can view this week', w: 15 },
        { id: 'here_soon', l: 'In Dubai, in a few weeks', w: 11 },
        { id: 'flying', l: 'Flying in to view', w: 10 },
        { id: 'remote', l: 'Remotely, video tours', w: 6 },
      ],
    },
    /** Not part of the score. It is the strongest single clue to the right area. */
    commute: {
      label: 'Where the week happens',
      options: [
        { id: 'downtown', l: 'Downtown, DIFC or Business Bay' },
        { id: 'marina', l: 'Marina, Media City or Internet City' },
        { id: 'jebelali', l: 'Jebel Ali, Expo or Dubai South' },
        { id: 'deira', l: 'Deira, Festival City or the airport' },
        { id: 'wfh', l: 'Mostly from home' },
      ],
    },
  };

  function option(group, id) {
    const set = QUESTIONS[group];
    if (!set) return null;
    return set.options.find((o) => o.id === id) || null;
  }

  function money(n) {
    if (n === null || n === undefined) return '';
    if (n >= 1000000) return CURRENCY + ' ' + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
    if (n >= 1000) return CURRENCY + ' ' + Math.round(n / 1000) + 'k';
    return CURRENCY + ' ' + n;
  }

  function budgetMax(id) {
    const band = option('budget', id);
    if (!band) return null;
    return band.max === null ? Infinity : band.max;
  }

  function validEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }

  return {
    CURRENCY: CURRENCY,
    QUESTIONS: QUESTIONS,
    option: option,
    money: money,
    budgetMax: budgetMax,
    validEmail: validEmail,
  };
});
