/* GENERATED FILE. Edit lib/funnel.js and run `npm run sync`. */
/**
 * The funnel: a card tree that gets narrower with every swipe.
 *
 * Nothing here is a fixed list of questions. Each card knows which communities
 * survive a yes and which survive a no, so an answer removes areas from the
 * running AND removes every question that only mattered to those areas. Say no
 * to a villa and you are never asked about a majlis, a garage or a golf course
 * again. Say yes to golf and the next questions are about which golf community.
 *
 * Universal module: the server and the browser run this same file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./qualify'), require('./communities'));
  } else {
    root.Funnel = factory(root.Qualify, root.Communities);
  }
})(typeof self !== 'undefined' ? self : this, function (Qualify, Communities) {
  'use strict';

  const MIN_CARDS = 7;     // never end the deck before this, if a useful card remains
  const MAX_CARDS = 14;    // and never drag on past this
  const MIN_ALIVE = 2;     // a filter that would leave fewer than this is applied softly

  const STAGES = [
    { n: 1, name: 'What kind of home' },
    { n: 2, name: 'Where in Dubai' },
    { n: 3, name: 'Which community' },
    { n: 4, name: 'The details' },
  ];

  const has = (c, attr, min) => (c.attrs[attr] || 0) >= (min === undefined ? 2 : min);
  const villaStock = (c) => !!(c.from.villa || c.from.townhouse);

  /* ------------------------------------------------------------- cards */

  /**
   * `keep` decides which communities survive the answer. `hard: true` means the
   * others are eliminated for good. `sig` feeds the area matcher. `when` is what
   * makes this a funnel rather than a questionnaire: a card that no longer
   * applies is never dealt.
   */
  const CARDS = [
    /* -------- stage 1: what kind of home ---------------------------- */
    {
      id: 'k-villa', stage: 1, img: 'd1-community',
      t: 'A villa with its own plot',
      c: 'Your own walls, your own garden, your own gate',
      facet: ['Home', 'a villa'],
      when: (s) => !s.kind,
      yes: { keep: (c) => !!c.from.villa, hard: true, sets: { kind: 'villa' }, sig: { lowRise: 2, garage: 1, privatePool: 1 } },
      no: { keep: (c) => !!(c.from.apartment || c.from.townhouse), hard: true, sig: { highRise: 1 } },
    },
    {
      id: 'k-apartment', stage: 1, img: 'a-highfloor',
      t: 'An apartment in a tower',
      c: 'Lift, concierge, nothing to maintain outside your front door',
      facet: ['Home', 'an apartment'],
      when: (s) => !s.kind && s.said('k-villa', 'n'),
      yes: { keep: (c) => !!c.from.apartment, hard: true, sets: { kind: 'apartment' }, sig: { highRise: 2, communityPool: 1 } },
      no: { keep: (c) => !!c.from.townhouse, hard: true, sig: { lowRise: 2 } },
    },
    {
      id: 'k-townhouse', stage: 1, img: 'k-townhouse',
      t: 'A townhouse in a row',
      c: 'A small garden and a neighbour on each side',
      facet: ['Home', 'a townhouse'],
      when: (s) => !s.kind && s.said('k-villa', 'n') && s.said('k-apartment', 'n'),
      yes: { keep: (c) => !!c.from.townhouse, hard: true, sets: { kind: 'townhouse' }, sig: { lowRise: 2, family: 1 } },
      no: { keep: () => true, hard: false, sets: { kind: 'any' }, sig: {} },
    },

    /* -------- stage 2: where in Dubai -------------------------------- */
    {
      id: 'l-golf', stage: 2, img: 'd1-golf',
      t: 'On a golf course',
      c: 'Greens out of the window, buggy in the garage',
      facet: ['Setting', 'golf community'],
      when: (s) => s.wantsHouse() && !s.answered('l-golf'),
      yes: { keep: (c) => has(c, 'golf'), hard: true, sig: { golf: 3, quiet: 2, gated: 1 } },
      no: { keep: () => true, hard: false, sig: { golf: -2 } },
    },
    {
      id: 'l-beachvilla', stage: 2, img: 'd1-beach',
      t: 'Beach at the end of the garden',
      c: 'Sand, sea, and a price tag to match',
      facet: ['Setting', 'beachfront'],
      when: (s) => s.wantsHouse() && !s.said('l-golf', 'y'),
      yes: { keep: (c) => has(c, 'beach', 3), hard: true, sig: { beach: 3, waterfront: 3, prime: 2, seaView: 2 } },
      no: { keep: () => true, hard: false, sig: { beach: -1 } },
    },
    {
      id: 'l-lagoon', stage: 2, img: 'l-lagoon',
      t: 'A lagoon inside the community',
      c: 'Swimmable water and a beach without leaving the gates',
      facet: ['Setting', 'lagoon community'],
      when: (s) => s.wantsHouse() && !s.said('l-golf', 'y') && !s.said('l-beachvilla', 'y'),
      yes: { keep: (c) => has(c, 'waterfront') && villaStock(c), hard: true, sig: { waterfront: 3, newBuild: 1, gated: 1 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'l-family', stage: 2, img: 'green-lawn',
      t: 'Parks, schools and a walkable school run',
      c: 'The kind of place built around families',
      facet: ['Setting', 'family community'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: { family: 3, schools: 3, park: 2, quiet: 1 } },
      no: { keep: () => true, hard: false, sig: { family: -2, schools: -2 } },
    },
    {
      id: 'l-waterfront', stage: 2, img: 'd1-marina',
      t: 'On the water',
      c: 'Marina, creek or sea, with the promenade downstairs',
      facet: ['Setting', 'waterfront'],
      when: (s) => s.wantsFlat(),
      yes: { keep: (c) => has(c, 'waterfront') || has(c, 'beach'), hard: true, sig: { waterfront: 3, seaView: 2, dining: 1 } },
      no: { keep: () => true, hard: false, sig: { waterfront: -2 } },
    },
    {
      id: 'l-beachapt', stage: 2, img: 'l-beachapt',
      t: 'Steps from the sand',
      c: 'Not a view of the beach, the actual beach',
      facet: ['Setting', 'beachfront tower'],
      when: (s) => s.wantsFlat() && s.said('l-waterfront', 'y'),
      yes: { keep: (c) => has(c, 'beach', 3), hard: true, sig: { beach: 3, prime: 1 } },
      no: { keep: () => true, hard: false, sig: { beach: -1 } },
    },
    {
      id: 'l-central', stage: 2, img: 'd1-downtown',
      t: 'In the middle of the city',
      c: 'Downtown, DIFC, the canal. Everything a walk away',
      facet: ['Setting', 'central'],
      when: (s) => s.wantsFlat() && s.answered('l-waterfront') && !s.said('l-waterfront', 'y'),
      yes: { keep: (c) => has(c, 'central'), hard: true, sig: { central: 3, buzz: 2, skylineView: 2 } },
      no: { keep: () => true, hard: false, sig: { central: -1, quiet: 1 } },
    },
    {
      id: 'l-offplan', stage: 2, img: 'd1-offplan',
      t: 'Brand new, handover in two years',
      c: 'Pay in instalments while it goes up',
      facet: ['Buying', 'off-plan'],
      when: () => true,
      yes: { keep: (c) => has(c, 'offplan') || has(c, 'newBuild', 3), hard: true, sig: { offplan: 3, newBuild: 3 } },
      no: { keep: () => true, hard: false, sig: { offplan: -3, established: 1 } },
    },

    /* -------- stage 3: which community ------------------------------- */
    {
      id: 'g-mansion', stage: 3, img: 'g-mansion',
      t: 'The biggest plots in the city',
      c: 'Eight figures, staff wing, gates you drive through',
      facet: ['Level', 'prime'],
      when: (s) => s.wantsHouse() && s.aliveSplits('prime', 3),
      yes: { keep: (c) => has(c, 'prime', 3), hard: true, sig: { prime: 3, staffRoom: 2, privatePool: 2 } },
      no: { keep: () => true, hard: false, sig: { prime: -1 } },
    },
    {
      id: 'g-established', stage: 3, img: 'green-courtyard',
      t: 'Streets where the trees have grown in',
      c: 'Twenty years old, shaded, finished. Bring a builder',
      facet: ['Feel', 'established'],
      when: (s) => s.aliveSplits('established', 2),
      yes: { keep: (c) => has(c, 'established'), hard: true, sig: { established: 3, quiet: 1 } },
      no: { keep: () => true, hard: false, sig: { established: -2, newBuild: 2 } },
    },
    {
      id: 'c-buzz', stage: 3, img: 'green-roof',
      t: 'Dinner downstairs, walk home',
      c: 'Restaurants and weekends on the doorstep',
      facet: ['Feel', 'lively'],
      when: (s) => s.aliveSplits('buzz', 2),
      yes: { keep: (c) => has(c, 'buzz'), hard: true, sig: { buzz: 3, dining: 2 } },
      no: { keep: () => true, hard: false, sig: { buzz: -2, quiet: 2 } },
    },
    {
      id: 'c-metro', stage: 3, img: 'extra-station',
      t: 'Walk to the metro',
      c: 'Leave the car at home on a Tuesday',
      facet: ['Priority', 'metro on foot'],
      when: (s) => s.aliveSplits('metro', 2),
      yes: { keep: (c) => has(c, 'metro'), hard: true, sig: { metro: 3, central: 1 } },
      no: { keep: () => true, hard: false, sig: { metro: -1 } },
    },
    {
      id: 'c-gated', stage: 3, img: 'extra-gated',
      t: 'Gates, barriers and a guard',
      c: 'Nobody drives in who does not live there',
      facet: ['Security', 'gated'],
      when: (s) => s.aliveSplits('gated', 2),
      yes: { keep: (c) => has(c, 'gated'), hard: true, sig: { gated: 3 } },
      no: { keep: () => true, hard: false, sig: { gated: -1 } },
    },
    {
      id: 'c-seaview', stage: 3, img: 'a-seaview',
      t: 'Water in the window',
      c: 'Sea view, not a car park view',
      facet: ['View', 'sea view'],
      when: (s) => s.aliveSplits('seaView', 2),
      yes: { keep: (c) => has(c, 'seaView'), hard: true, sig: { seaView: 3, waterfront: 1 } },
      no: { keep: () => true, hard: false, sig: { seaView: -1 } },
    },
    {
      id: 'c-yield', stage: 3, img: 'layout-open',
      t: 'Rents itself when you are not in it',
      c: 'Tenant demand all year, not just in season',
      facet: ['Priority', 'rental demand'],
      when: (s) => s.aliveSplits('yield', 3),
      yes: { keep: (c) => has(c, 'yield', 3), hard: true, sig: { yield: 3 } },
      no: { keep: () => true, hard: false, sig: { yield: -1 } },
    },

    /* -------- stage 4: the details ----------------------------------- */
    {
      id: 'pool-private', stage: 4, img: 'pool-private',
      t: 'Your own pool',
      c: 'Nobody else in it, ever',
      facet: ['Water', 'private pool'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: { privatePool: 3 } },
      no: { keep: () => true, hard: false, sig: { privatePool: -2 } },
    },
    {
      id: 'pool-community', stage: 4, img: 'pool-community',
      t: 'A big shared pool',
      c: 'Comes with the building, and with the service charge',
      facet: ['Water', 'shared pool'],
      when: (s) => !s.said('pool-private', 'y'),
      yes: { keep: () => true, hard: false, sig: { communityPool: 3 } },
      no: { keep: () => true, hard: false, sig: { communityPool: -2 } },
    },
    {
      id: 'v-majlis', stage: 4, img: 'v-majlis',
      t: 'A separate majlis',
      c: 'Guests received properly, family side kept private',
      facet: ['Inside', 'majlis'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: { majlis: 3, family: 1 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'v-staff', stage: 4, img: 'v-staff',
      t: 'Staff room off the kitchen',
      c: 'Own entrance, own bathroom, own laundry',
      facet: ['Inside', 'staff accommodation'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: { staffRoom: 3 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'extra-garage', stage: 4, img: 'extra-garage',
      t: 'Garage and driveway',
      c: 'Two cars out of the sun',
      facet: ['Parking', 'garage'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: { garage: 3 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'green-balcony', stage: 4, img: 'green-balcony',
      t: 'A balcony you actually use',
      c: 'Room for plants, a table and two chairs',
      facet: ['Outside', 'usable balcony'],
      when: (s) => s.wantsFlat(),
      yes: { keep: () => true, hard: false, sig: { lowRise: 1 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'green-paved', stage: 4, img: 'green-paved',
      t: 'Nothing to maintain outside',
      c: 'No gardener, no watering, no thought',
      facet: ['Outside', 'zero upkeep'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: { park: -1 } },
      no: { keep: () => true, hard: false, sig: { park: 2 } },
    },
    {
      id: 'layout-office', stage: 4, img: 'layout-office',
      t: 'A real home office',
      c: 'A door, a desk, nobody behind you on calls',
      facet: ['Inside', 'home office'],
      when: () => true,
      yes: { keep: () => true, hard: false, sig: { quiet: 1 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'extra-gym', stage: 4, img: 'extra-gym',
      t: 'Gym and spa in the building',
      c: 'Downstairs, not a twenty minute drive',
      facet: ['Wellness', 'gym on site'],
      when: () => true,
      yes: { keep: () => true, hard: false, sig: { communityPool: 1, newBuild: 1 } },
      no: { keep: () => true, hard: false, sig: {} },
    },
    {
      id: 'layout-separate', stage: 4, img: 'layout-separate',
      t: 'A closed kitchen',
      c: 'Doors that shut, cooking smells that stay put',
      facet: ['Inside', 'closed kitchen'],
      when: () => true,
      yes: { keep: () => true, hard: false, sig: { established: 1 } },
      no: { keep: () => true, hard: false, sig: { newBuild: 1 } },
    },
    {
      id: 'layout-loft', stage: 4, img: 'layout-loft',
      t: 'The whole top floor as one suite',
      c: 'Bedroom, bathroom and a room to sit in',
      facet: ['Inside', 'top-floor suite'],
      when: (s) => s.wantsHouse(),
      yes: { keep: () => true, hard: false, sig: {} },
      no: { keep: () => true, hard: false, sig: {} },
    },
  ];

  const BY_ID = {};
  for (const card of CARDS) BY_ID[card.id] = card;

  /** Liking both of a pair means they have not decided yet. */
  const CONTRADICTIONS = [
    ['pool-private', 'pool-community'],
    ['l-family', 'c-buzz'],
    ['g-established', 'l-offplan'],
  ];

  /* ------------------------------------------------------------ replay */

  /**
   * Rebuild everything from the swipes alone, so the browser and the server
   * always agree and nothing has to be stored twice.
   */
  function replay(swipes) {
    const list = (swipes || []).filter((s) => BY_ID[s.id]);
    const state = {
      kind: null,
      alive: Communities.COMMUNITIES.slice(),
      signals: {},
      answered: {},
      history: [],
      softened: [],
    };

    for (const swipe of list) {
      const card = BY_ID[swipe.id];
      const branch = swipe.dir === 'y' ? card.yes : card.no;
      state.answered[card.id] = swipe.dir;

      const before = state.alive.length;
      if (branch.hard) {
        const survivors = state.alive.filter(branch.keep);
        if (survivors.length >= MIN_ALIVE) {
          state.alive = survivors;
        } else {
          // Never narrow to nothing: keep the pool and let the weights decide.
          state.softened.push(card.id);
        }
      }
      if (branch.sets) Object.assign(state, branch.sets);
      addSignals(state.signals, branch.sig);
      state.history.push({ id: card.id, dir: swipe.dir, before: before, after: state.alive.length });
    }

    for (const key of Object.keys(state.signals)) {
      state.signals[key] = Math.max(-3, Math.min(3, state.signals[key]));
    }
    return state;
  }

  function addSignals(vector, sig) {
    if (!sig) return;
    for (const key of Object.keys(sig)) vector[key] = (vector[key] || 0) + sig[key];
  }

  /** The little helper object the `when` predicates read. */
  function context(state) {
    return {
      kind: state.kind,
      alive: state.alive,
      answered: (id) => id in state.answered,
      said: (id, dir) => state.answered[id] === dir,
      wantsHouse: () => state.kind === 'villa' || state.kind === 'townhouse' || !state.kind || state.kind === 'any',
      wantsFlat: () => state.kind === 'apartment' || !state.kind || state.kind === 'any',
      /** Is this attribute still an open question among the communities left? */
      aliveSplits: (attr, min) => {
        const yes = state.alive.filter((c) => has(c, attr, min)).length;
        return yes > 0 && yes < state.alive.length;
      },
    };
  }

  function shareOf(state, card) {
    if (!state.alive.length) return 0;
    return state.alive.filter(card.yes.keep).length / state.alive.length;
  }

  /**
   * The next question worth asking: the broadest one still open, and among
   * those the one that splits what is left most evenly.
   */
  function next(swipes) {
    const state = replay(swipes);
    const asked = (swipes || []).length;
    if (asked >= MAX_CARDS) return null;

    const ctx = context(state);
    const usable = [];
    for (const card of CARDS) {
      if (card.id in state.answered) continue;
      if (!card.when(ctx)) continue;
      const share = shareOf(state, card);
      const structural = card.stage === 1 && !state.kind;
      if (!structural) {
        if (card.yes.hard && (share < 0.08 || share > 0.95)) continue;   // decides nothing
        if (!card.yes.hard && !cardStillMatters(state, card)) continue;
      }
      usable.push({ card: card, share: share });
    }
    if (!usable.length) return null;

    // Enough narrowing done, and enough cards asked: stop rather than pad.
    if (state.alive.length <= 4 && asked >= MIN_CARDS) return null;

    usable.sort((a, b) => {
      if (a.card.stage !== b.card.stage) return a.card.stage - b.card.stage;
      return Math.abs(a.share - 0.5) - Math.abs(b.share - 0.5);
    });
    return usable[0].card;
  }

  /** A soft card earns its place if it separates the communities still in play. */
  function cardStillMatters(state, card) {
    const keys = Object.keys(card.yes.sig || {}).filter((k) => card.yes.sig[k] > 0);
    if (!keys.length) return true;
    for (const key of keys) {
      const values = state.alive.map((c) => c.attrs[key] || 0);
      if (Math.max.apply(null, values) - Math.min.apply(null, values) >= 2) return true;
    }
    return false;
  }

  /** How far through the funnel they are, for the progress bar. */
  function progress(swipes) {
    const state = replay(swipes);
    const total = Communities.COMMUNITIES.length;
    const card = next(swipes);
    return {
      alive: state.alive.length,
      total: total,
      asked: (swipes || []).length,
      stage: card ? card.stage : 4,
      kind: state.kind,
      done: !card,
    };
  }

  /** Which areas the last answer knocked out, for the between-stage screen. */
  function ruledOutBy(swipes, upTo) {
    const before = replay((swipes || []).slice(0, upTo));
    const after = replay((swipes || []).slice(0, upTo + 1));
    const kept = {};
    for (const c of after.alive) kept[c.id] = true;
    return before.alive.filter((c) => !kept[c.id]).map((c) => c.name);
  }

  /* ------------------------------------------------------------ output */

  function publicCard(card) {
    return { id: card.id, stage: card.stage, title: card.t, caption: card.c, image: '/img/' + card.img + '.svg', heading: card.facet[0] };
  }

  /** Grouped answers, the way an agent reads them. */
  function facets(swipes) {
    const want = [];
    const no = [];
    const push = (list, key, value) => {
      const row = list.find((r) => r.key === key);
      if (row) row.values.push(value);
      else list.push({ key: key, values: [value] });
    };
    for (const swipe of swipes || []) {
      const card = BY_ID[swipe.id];
      if (!card || !card.facet) continue;
      push(swipe.dir === 'y' ? want : no, card.facet[0], card.facet[1]);
    }
    for (const row of no) {
      const kept = (want.find((w) => w.key === row.key) || { values: [] }).values;
      row.values = row.values.filter((v) => kept.indexOf(v) === -1);
    }
    return { want: want, no: no.filter((r) => r.values.length) };
  }

  function contradictions(swipes) {
    const yes = {};
    for (const s of swipes || []) if (s.dir === 'y') yes[s.id] = true;
    return CONTRADICTIONS.filter((pair) => yes[pair[0]] && yes[pair[1]]);
  }

  function likes(swipes) {
    return (swipes || []).filter((s) => s.dir === 'y' && BY_ID[s.id]);
  }

  /** The cheapest door in what is left, for the kind of home they want. */
  function cheapestAlive(state, kind) {
    let best = null;
    for (const c of state.alive) {
      const price = entryFor(c, kind);
      if (price && (!best || price.price < best.price)) best = { name: c.name, price: price.price, kind: price.kind };
    }
    return best;
  }

  function entryFor(community, kind) {
    const from = community.from;
    if (kind === 'villa') return from.villa ? { price: from.villa, kind: 'villa' } : (from.townhouse ? { price: from.townhouse, kind: 'townhouse' } : null);
    if (kind === 'townhouse') return from.townhouse ? { price: from.townhouse, kind: 'townhouse' } : (from.villa ? { price: from.villa, kind: 'villa' } : null);
    if (kind === 'apartment') return from.apartment ? { price: from.apartment, kind: 'apartment' } : null;
    const keys = Object.keys(from);
    if (!keys.length) return null;
    const cheapest = keys.reduce((lo, k) => (from[k] < from[lo] ? k : lo), keys[0]);
    return { price: from[cheapest], kind: cheapest };
  }

  /* ----------------------------------------------------------- hotness */

  /**
   * Hotness, read across everything. 100 is the buyer who can proceed today:
   * money in place, in Dubai, viewing this week, and a brief that narrowed to
   * a real shortlist without contradicting itself.
   */
  function hotness(lead) {
    const swipes = lead.swipes || [];
    const answers = lead.answers || {};
    const contact = lead.contact || {};
    const state = replay(swipes);
    const parts = [];
    const flags = [];

    const pay = Qualify.option('payment', answers.payment);
    parts.push({ key: 'Funds', got: pay ? pay.w : 0, of: 30, note: pay ? pay.l : 'not answered' });
    if (pay && (pay.id === 'cash_uae' || pay.id === 'mortgage_ok')) {
      flags.push({ tone: 'good', text: pay.id === 'cash_uae' ? 'Cash is already in the UAE' : 'Mortgage pre-approved' });
    }
    if (pay && (pay.id === 'mortgage_no' || pay.id === 'unsure')) {
      flags.push({ tone: 'warn', text: 'Finance not arranged yet, so any offer is weeks away' });
    }
    if (pay && pay.id === 'sell_first') flags.push({ tone: 'warn', text: 'Buying depends on selling something first' });

    const when = Qualify.option('timeline', answers.timeline);
    parts.push({ key: 'Timing', got: when ? when.w : 0, of: 20, note: when ? when.l : 'not answered' });
    if (when && when.id === 'watch') flags.push({ tone: 'bad', text: 'Says they are only watching the market' });

    const view = Qualify.option('viewing', answers.viewing);
    parts.push({ key: 'Viewing', got: view ? view.w : 0, of: 15, note: view ? view.l : 'not answered' });
    if (view && view.id === 'remote') flags.push({ tone: 'warn', text: 'Overseas buyer, video tours only for now' });
    if (view && view.id === 'here_now') flags.push({ tone: 'good', text: 'In Dubai and free to view this week' });

    // Clarity is how far the funnel actually narrowed, not how many cards they touched.
    const narrowedTo = state.alive.length;
    const total = Communities.COMMUNITIES.length;
    const narrowing = Math.max(0, Math.min(1, (total - narrowedTo) / (total - 3)));
    let clarity = Math.round(narrowing * 12);
    const yes = likes(swipes).length;
    if (swipes.length >= 4) clarity += yes > 0 && yes < swipes.length ? 4 : 1;
    const clashes = contradictions(swipes);
    clarity += Math.max(0, 4 - clashes.length * 2);
    if (!yes && swipes.length) flags.push({ tone: 'warn', text: 'Passed on everything, so nothing is confirmed yet' });
    if (clashes.length) {
      flags.push({ tone: 'warn', text: 'Wants both sides of ' + clashes.length + ' either/or question' + (clashes.length > 1 ? 's' : '') });
    }
    if (!clashes.length && narrowedTo <= 5 && yes >= 3) {
      flags.push({ tone: 'good', text: 'Narrowed cleanly to ' + narrowedTo + ' communities' });
    }
    parts.push({
      key: 'Clarity', got: Math.min(20, clarity), of: 20,
      note: swipes.length + ' cards, narrowed ' + total + ' areas to ' + narrowedTo,
    });

    const band = Qualify.option('budget', answers.budget);
    let budgetScore = band ? 5 : 0;
    const cheapest = cheapestAlive(state, state.kind);
    if (band && cheapest) {
      const ceiling = band.max === null ? Infinity : band.max;
      if (cheapest.price <= ceiling) {
        budgetScore += 5;
      } else {
        flags.push({
          tone: 'bad',
          text: 'Budget will not reach the shortlist: the cheapest is ' + cheapest.name
            + ' at ' + Qualify.money(cheapest.price) + ' on ' + band.l,
        });
      }
    }
    parts.push({ key: 'Budget', got: budgetScore, of: 10, note: band ? band.l : 'not answered' });

    let reach = 0;
    if (contact.name) reach += 1;
    if (contact.email) reach += 2;
    if (contact.phone) reach += 2;
    parts.push({ key: 'Contact', got: reach, of: 5, note: contact.phone ? 'phone and email' : contact.email ? 'email only' : 'incomplete' });

    const value = Math.max(0, Math.min(100, Math.round(parts.reduce((sum, p) => sum + p.got, 0))));
    const band2 = value >= 85 ? { label: 'Ready to proceed', tone: 'hot' }
      : value >= 70 ? { label: 'Hot', tone: 'hot' }
      : value >= 50 ? { label: 'Warm', tone: 'warm' }
      : value >= 30 ? { label: 'Cool', tone: 'cool' }
      : { label: 'Cold', tone: 'cold' };

    const advice = value >= 85 ? 'Call today. Money is in place and they can view this week.'
      : value >= 70 ? 'Worth a call now. One gap to close, see the flags.'
      : value >= 50 ? 'Send the shortlist, qualify the money on the call before you drive anywhere.'
      : value >= 30 ? 'Not viewing-ready. Nurture, do not block out a Saturday for them.'
      : 'Barely told you anything. One follow-up, then leave it.';

    return { value: value, label: band2.label, tone: band2.tone, parts: parts, flags: flags, advice: advice };
  }

  /* -------------------------------------------------------- the brief */

  function kindLabel(kind) {
    return kind === 'villa' ? 'a villa'
      : kind === 'apartment' ? 'an apartment'
      : kind === 'townhouse' ? 'a townhouse'
      : 'still open on the type';
  }

  function briefText(lead) {
    const contact = lead.contact || {};
    const answers = lead.answers || {};
    const state = replay(lead.swipes);
    const h = hotness(lead);
    const f = facets(lead.swipes);
    const lines = [];

    lines.push(contact.name || 'Unnamed lead');
    lines.push([contact.email, contact.phone].filter(Boolean).join(' · '));
    lines.push('Looking for: ' + kindLabel(state.kind));
    lines.push('Budget: ' + ((Qualify.option('budget', answers.budget) || {}).l || 'not given'));
    lines.push('For: ' + ((Qualify.option('purpose', answers.purpose) || {}).l || 'not given'));
    lines.push('Funds: ' + ((Qualify.option('payment', answers.payment) || {}).l || 'not given'));
    lines.push('Timing: ' + ((Qualify.option('timeline', answers.timeline) || {}).l || 'not given'));
    lines.push('Viewing: ' + ((Qualify.option('viewing', answers.viewing) || {}).l || 'not given'));
    if (answers.commute) lines.push('Week spent around: ' + ((Qualify.option('commute', answers.commute) || {}).l || ''));
    lines.push('');
    for (const row of f.want) lines.push(row.key + ': ' + row.values.join(', '));
    if (f.no.length) lines.push('Ruled out: ' + f.no.map((r) => r.values.join(', ')).join(' · '));
    if (lead.note) lines.push('Their note: ' + lead.note);
    lines.push('');
    lines.push('Lead temperature: ' + h.label + ' (' + h.value + '/100)');
    for (const p of h.parts) lines.push('  ' + p.key + ' ' + p.got + '/' + p.of + ' (' + p.note + ')');
    for (const fl of h.flags) lines.push('  ' + (fl.tone === 'good' ? '+' : '!') + ' ' + fl.text);
    return lines.join('\n');
  }

  return {
    CARDS: CARDS,
    BY_ID: BY_ID,
    STAGES: STAGES,
    MIN_CARDS: MIN_CARDS,
    MAX_CARDS: MAX_CARDS,
    replay: replay,
    next: next,
    progress: progress,
    ruledOutBy: ruledOutBy,
    publicCard: publicCard,
    facets: facets,
    contradictions: contradictions,
    likes: likes,
    hotness: hotness,
    briefText: briefText,
    kindLabel: kindLabel,
    entryFor: entryFor,
  };
});
