/* GENERATED FILE. Edit lib/qualify.js and run `npm run sync`. */
/**
 * The qualification engine: the deck, the rounds, the readiness questions and
 * the hotness model. Written as a universal module on purpose, so the Node
 * server and the standalone single-file page score a lead identically instead
 * of drifting apart.
 *
 * Market: Dubai. Prices in AED.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Qualify = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CURRENCY = 'AED';

  /* --------------------------------------------------------------- cards */
  /**
   * `f` is the answer the agent reads: [heading, value].
   * `b` is what liking the card says about which corner of the market they are in.
   * `from` is the realistic entry price in AED, used to catch the classic
   * time-waster: Palm taste on a studio budget.
   */
  const CARDS = {
    // ---- round one: the wide net -------------------------------------
    'd1-marina': {
      t: 'Waterfront tower apartment', c: 'Marina views, big balcony, walk to the promenade',
      f: ['Location', 'waterfront tower'], b: { apartment: 2, waterfront: 1 }, from: 1400000,
      g: ['apartment', 'waterfront', 'balcony living'],
    },
    'd1-downtown': {
      t: 'Downtown high-rise', c: 'Burj views, metro and the mall on your doorstep',
      f: ['Location', 'downtown high-rise'], b: { apartment: 2, city: 1 }, from: 1600000,
      g: ['apartment', 'city centre', 'high floor'],
    },
    'd1-community': {
      t: 'Villa in a gated community', c: 'Parks, schools, neighbours you actually know',
      f: ['Location', 'gated family community'], b: { villa: 2, family: 1 }, from: 2500000,
      g: ['villa', 'family community', 'gated'],
    },
    'd1-beach': {
      t: 'Beachfront villa', c: 'Sand at the end of the garden, sea out every window',
      f: ['Location', 'beachfront villa'], b: { prime: 2, villa: 1 }, from: 15000000,
      g: ['beachfront', 'prime', 'villa'],
    },
    'd1-golf': {
      t: 'Villa on a golf course', c: 'Greens out the back, buggy in the garage',
      f: ['Location', 'golf community'], b: { golf: 2, villa: 1 }, from: 5000000,
      g: ['golf community', 'villa', 'quiet'],
    },
    'd1-offplan': {
      t: 'Off-plan, handover in two years', c: 'Pay in instalments while it goes up',
      f: ['Buying', 'off-plan on a payment plan'], b: { offplan: 2 }, from: 900000,
      g: ['off-plan', 'payment plan', 'brand new'],
    },

    // ---- views and outside -------------------------------------------
    'a-seaview': {
      t: 'Sea view from the sofa', c: 'Water in the window, sunsets included',
      f: ['View', 'sea view'], b: {}, g: ['sea view', 'premium view'],
    },
    'a-highfloor': {
      t: 'High floor, city below', c: 'Twentieth and up, skyline at night',
      f: ['View', 'high floor city view'], b: {}, g: ['high floor', 'city view'],
    },
    'green-balcony': {
      t: 'Balcony you actually use', c: 'Plants, two chairs, morning coffee',
      f: ['Outside', 'usable balcony'], b: {}, g: ['balcony', 'small outdoor space'],
    },
    'green-lawn': {
      t: 'Lawn and landscaping', c: 'Grass for the kids, gardener once a week',
      f: ['Outside', 'landscaped garden'], b: {}, g: ['garden', 'family', 'upkeep'],
    },
    'green-paved': {
      t: 'Paved, nothing to maintain', c: 'No watering, no gardener, no thought',
      f: ['Outside', 'zero upkeep'], b: {}, g: ['low maintenance', 'practical'],
    },
    'green-courtyard': {
      t: 'Shaded courtyard', c: 'Mature trees, walls, cool in July',
      f: ['Outside', 'shaded courtyard'], b: {}, g: ['courtyard', 'shade', 'private'],
    },
    'green-roof': {
      t: 'Roof terrace', c: 'Somewhere to put a table and forty people',
      f: ['Outside', 'roof terrace'], b: {}, g: ['roof terrace', 'entertaining'],
    },

    // ---- inside --------------------------------------------------------
    'layout-open': {
      t: 'Open-plan living', c: 'Kitchen, dining and living in one room',
      f: ['Inside', 'open plan'], b: {}, g: ['open plan', 'sociable'],
    },
    'layout-separate': {
      t: 'Separate closed kitchen', c: 'Doors that shut, cooking smells that stay put',
      f: ['Inside', 'closed kitchen'], b: {}, g: ['separate rooms', 'closed kitchen'],
    },
    'layout-atrium': {
      t: 'Double-height entrance', c: 'Galleried landing, chandelier optional',
      f: ['Inside', 'double height'], b: {}, g: ['double height', 'statement'],
    },
    'layout-office': {
      t: 'A real home office', c: 'A door, a desk, nobody behind you on calls',
      f: ['Inside', 'home office'], b: {}, g: ['home office', 'extra room'],
    },
    'layout-loft': {
      t: 'Top floor to yourself', c: 'The whole upper floor as one suite',
      f: ['Inside', 'top-floor suite'], b: {}, g: ['main suite', 'extra floor'],
    },
    'v-majlis': {
      t: 'Separate majlis', c: 'Guests received properly, family side kept private',
      f: ['Inside', 'separate majlis'], b: {}, g: ['majlis', 'entertaining', 'privacy'],
    },
    'v-staff': {
      t: 'Staff room off the kitchen', c: 'Own entrance, own bathroom, own laundry',
      f: ['Inside', 'staff accommodation'], b: {}, g: ['staff room', 'live-in help'],
    },

    // ---- water ----------------------------------------------------------
    'pool-community': {
      t: 'Big shared pool', c: 'Comes with the tower, and with the service charge',
      f: ['Water', 'shared pool'], b: {}, g: ['community pool', 'shared amenities'],
    },
    'pool-private': {
      t: 'Private pool', c: 'Yours alone, nobody else in it',
      f: ['Water', 'private pool'], b: {}, g: ['private pool', 'premium'],
    },
    'pool-plunge': {
      t: 'Plunge pool in the courtyard', c: 'Small, private, for cooling off',
      f: ['Water', 'plunge pool'], b: {}, g: ['plunge pool', 'compact'],
    },
    'pool-none': {
      t: 'No pool at all', c: 'Lower service charge, more garden',
      f: ['Water', 'no pool'], b: {}, g: ['no pool', 'lower running costs'],
    },

    // ---- the rest -------------------------------------------------------
    'extra-garage': {
      t: 'Garage and driveway', c: 'Two cars out of the sun',
      f: ['Parking', 'garage'], b: {}, g: ['parking', 'garage'],
    },
    'extra-station': {
      t: 'Walk to the metro', c: 'Commute without the Sheikh Zayed crawl',
      f: ['Priority', 'walk to metro'], b: {}, g: ['metro', 'commuter', 'walkable'],
    },
    'extra-gated': {
      t: 'Gated, with concierge', c: 'Security on the gate, someone takes your parcels',
      f: ['Security', 'gated and staffed'], b: {}, g: ['gated', 'concierge', 'security'],
    },
    'extra-gym': {
      t: 'Gym and spa in the building', c: 'Downstairs, not a twenty minute drive',
      f: ['Wellness', 'gym on site'], b: {}, g: ['gym', 'wellness'],
    },
  };

  const ROUND1 = ['d1-marina', 'd1-downtown', 'd1-community', 'd1-beach', 'd1-golf', 'd1-offplan'];

  // Round two only asks what fits the corner round one put them in.
  const ROUND2 = {
    apartment: ['a-seaview', 'a-highfloor', 'green-balcony', 'layout-open', 'pool-community', 'extra-gated', 'extra-gym', 'green-roof'],
    villa:     ['pool-private', 'green-lawn', 'v-majlis', 'v-staff', 'layout-open', 'extra-garage', 'green-courtyard', 'layout-separate'],
    prime:     ['pool-private', 'a-seaview', 'v-majlis', 'v-staff', 'layout-atrium', 'extra-gated', 'green-paved', 'extra-gym'],
    golf:      ['pool-private', 'green-lawn', 'v-majlis', 'extra-garage', 'layout-open', 'extra-gym', 'v-staff', 'green-courtyard'],
    offplan:   ['a-highfloor', 'green-balcony', 'layout-open', 'pool-community', 'extra-gym', 'extra-gated', 'a-seaview', 'green-roof'],
    mixed:     ['green-balcony', 'pool-community', 'layout-open', 'green-lawn', 'extra-garage', 'a-seaview', 'v-majlis', 'extra-gym'],
  };

  // Round three settles the water question and the deal-breakers.
  const ROUND3 = {
    apartment: ['pool-private', 'layout-office', 'green-roof', 'extra-station', 'layout-separate', 'extra-gym', 'green-paved', 'v-staff'],
    villa:     ['pool-plunge', 'pool-none', 'layout-office', 'green-courtyard', 'layout-separate', 'extra-station', 'layout-loft', 'extra-gym'],
    prime:     ['pool-plunge', 'layout-office', 'layout-loft', 'green-courtyard', 'extra-station', 'layout-separate', 'pool-none', 'green-roof'],
    golf:      ['pool-plunge', 'pool-none', 'layout-office', 'layout-atrium', 'extra-station', 'green-courtyard', 'layout-loft', 'green-roof'],
    offplan:   ['pool-private', 'layout-office', 'green-roof', 'extra-station', 'layout-separate', 'extra-garage', 'green-paved', 'v-staff'],
    mixed:     ['pool-private', 'pool-none', 'layout-office', 'extra-station', 'extra-gym', 'green-roof', 'layout-separate', 'extra-garage'],
  };

  const BRANCH_NAME = {
    apartment: 'apartments with a view',
    villa: 'family villas',
    prime: 'prime waterfront',
    golf: 'golf and green communities',
    offplan: 'off-plan and brand new',
    mixed: 'a bit of everything',
  };

  const ROUND_NAME = ['Round 1 · Wide net', 'Round 2 · Narrowing', 'Round 3 · The fussy bit'];

  /* ---------------------------------------------------------- questions */
  /** `w` is the weight this answer contributes to its band of the hotness score. */
  const QUESTIONS = {
    purpose: {
      label: 'What is it for',
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

  /** Liking both of a pair means they have not decided yet. */
  const CONTRADICTIONS = [
    ['pool-private', 'pool-none'],
    ['green-paved', 'green-lawn'],
    ['layout-open', 'layout-separate'],
  ];

  /* ----------------------------------------------------------- helpers */
  function opt(group, id) {
    return (QUESTIONS[group].options.find((o) => o.id === id)) || null;
  }

  function money(n) {
    if (n === null || n === undefined) return '';
    if (n >= 1000000) return CURRENCY + ' ' + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
    if (n >= 1000) return CURRENCY + ' ' + Math.round(n / 1000) + 'k';
    return CURRENCY + ' ' + n;
  }

  function likes(swipes, round) {
    return (swipes || []).filter((s) => s.dir === 'y' && (round === undefined || s.round === round));
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /** Which corner of the market round one put them in. */
  function decideBranch(swipes) {
    const score = {};
    for (const s of likes(swipes, 1)) {
      const card = CARDS[s.id];
      if (!card) continue;
      for (const key of Object.keys(card.b || {})) score[key] = (score[key] || 0) + card.b[key];
    }
    const ranked = Object.keys(score).map((k) => [k, score[k]]).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return 'mixed';
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return 'mixed';
    const top = ranked[0][0];
    return ROUND2[top] ? top : 'mixed';
  }

  /** The six cards for a round, skipping anything already seen. */
  function buildRound(n, branch, swipes) {
    const seen = {};
    for (const s of swipes || []) seen[s.id] = true;
    if (n === 1) return shuffle(ROUND1);
    const table = n === 2 ? ROUND2 : ROUND3;
    const list = table[branch] || table.mixed;
    return list.filter((id) => !seen[id]).slice(0, 6);
  }

  /** Grouped answers: what they said yes to, and what they ruled out. */
  function facets(swipes) {
    const want = [];
    const no = [];
    const pushTo = (list, key, value) => {
      const row = list.find((r) => r.key === key);
      if (row) row.values.push(value);
      else list.push({ key, values: [value] });
    };
    for (const s of swipes || []) {
      const card = CARDS[s.id];
      if (!card) continue;
      pushTo(s.dir === 'y' ? want : no, card.f[0], card.f[1]);
    }
    // Something they liked elsewhere is not a deal-breaker.
    for (const row of no) {
      const kept = (want.find((w) => w.key === row.key) || { values: [] }).values;
      row.values = row.values.filter((v) => kept.indexOf(v) === -1);
    }
    return { want, no: no.filter((r) => r.values.length) };
  }

  function contradictions(swipes) {
    const yes = {};
    for (const s of likes(swipes)) yes[s.id] = true;
    return CONTRADICTIONS.filter((pair) => yes[pair[0]] && yes[pair[1]]);
  }

  /** The cheapest thing they liked in round one, which is what they can actually be shown. */
  function tasteFloor(swipes) {
    const priced = likes(swipes, 1).map((s) => CARDS[s.id]).filter((c) => c && c.from);
    if (!priced.length) return null;
    return priced.reduce((lo, c) => (c.from < lo.from ? c : lo), priced[0]);
  }

  /**
   * Hotness, read across everything rather than from any single answer.
   * 100 is the lead who can proceed today: money in place, in Dubai, viewing
   * this week, and a brief with no contradictions in it.
   */
  function hotness(lead) {
    const swipes = lead.swipes || [];
    const answers = lead.answers || {};
    const contact = lead.contact || {};
    const parts = [];
    const flags = [];

    // --- money in place (30) ------------------------------------------
    const pay = opt('payment', answers.payment);
    parts.push({ key: 'Funds', got: pay ? pay.w : 0, of: 30, note: pay ? pay.l : 'not answered' });
    if (pay && (pay.id === 'cash_uae' || pay.id === 'mortgage_ok')) {
      flags.push({ tone: 'good', text: pay.id === 'cash_uae' ? 'Cash is already in the UAE' : 'Mortgage pre-approved' });
    }
    if (pay && (pay.id === 'mortgage_no' || pay.id === 'unsure')) {
      flags.push({ tone: 'warn', text: 'Finance not arranged yet, so any offer is weeks away' });
    }
    if (pay && pay.id === 'sell_first') flags.push({ tone: 'warn', text: 'Buying depends on selling something first' });

    // --- urgency (20) --------------------------------------------------
    const when = opt('timeline', answers.timeline);
    parts.push({ key: 'Timing', got: when ? when.w : 0, of: 20, note: when ? when.l : 'not answered' });
    if (when && when.id === 'watch') flags.push({ tone: 'bad', text: 'Says they are only watching the market' });

    // --- can they actually be shown a property (15) ---------------------
    const view = opt('viewing', answers.viewing);
    parts.push({ key: 'Viewing', got: view ? view.w : 0, of: 15, note: view ? view.l : 'not answered' });
    if (view && view.id === 'remote') flags.push({ tone: 'warn', text: 'Overseas buyer, video tours only for now' });
    if (view && view.id === 'here_now') flags.push({ tone: 'good', text: 'In Dubai and free to view this week' });

    // --- do they know what they want (20) -------------------------------
    const rounds = [1, 2, 3].filter((r) => swipes.some((s) => s.round === r)).length;
    let clarity = rounds * 3;                       // played the rounds
    const yes = likes(swipes).length;
    if (swipes.length >= 6) clarity += yes > 0 && yes < swipes.length ? 6 : 2;
    const clashes = contradictions(swipes);
    clarity += Math.max(0, 5 - clashes.length * 2.5);
    if (!yes && swipes.length) {
      flags.push({ tone: 'warn', text: 'Passed on everything, so nothing is confirmed yet' });
    }
    if (clashes.length) {
      flags.push({ tone: 'warn', text: 'Wants both sides of ' + clashes.length + ' either/or question' + (clashes.length > 1 ? 's' : '') });
    }
    if (!clashes.length && rounds === 3 && yes >= 3) {
      flags.push({ tone: 'good', text: 'Consistent brief, no contradictions' });
    }
    parts.push({ key: 'Clarity', got: Math.round(Math.min(20, clarity)), of: 20, note: rounds + ' of 3 rounds, ' + yes + ' yes' });

    // --- budget, and whether it matches the taste (10) -------------------
    const band = opt('budget', answers.budget);
    let budgetScore = band ? 5 : 0;
    const floor = tasteFloor(swipes);
    if (band && floor) {
      const ceiling = band.max === null ? Infinity : band.max;
      if (floor.from <= ceiling) {
        budgetScore += 5;
      } else {
        flags.push({
          tone: 'bad',
          text: 'Budget will not reach the taste: liked ' + floor.t.toLowerCase() + ' (from ' + money(floor.from) + ') on ' + band.l,
        });
      }
    }
    parts.push({ key: 'Budget', got: budgetScore, of: 10, note: band ? band.l : 'not answered' });

    // --- can you reach them (5) ------------------------------------------
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
      : value >= 50 ? 'Send listings, qualify the money on the call before you drive anywhere.'
      : value >= 30 ? 'Not viewing-ready. Nurture, do not block out a Saturday for them.'
      : 'Barely told you anything. One follow-up, then leave it.';

    return { value: value, label: band2.label, tone: band2.tone, parts: parts, flags: flags, advice: advice };
  }

  /** The brief an agent can paste into a CRM or WhatsApp. */
  function briefText(lead) {
    const contact = lead.contact || {};
    const answers = lead.answers || {};
    const h = hotness(lead);
    const f = facets(lead.swipes);
    const lines = [];

    lines.push(contact.name || 'Unnamed lead');
    lines.push([contact.email, contact.phone].filter(Boolean).join(' · '));
    if (lead.area) lines.push('Area they named: ' + lead.area);
    lines.push('Budget: ' + ((opt('budget', answers.budget) || {}).l || 'not given'));
    lines.push('For: ' + ((opt('purpose', answers.purpose) || {}).l || 'not given'));
    lines.push('Funds: ' + ((opt('payment', answers.payment) || {}).l || 'not given'));
    lines.push('Timing: ' + ((opt('timeline', answers.timeline) || {}).l || 'not given'));
    lines.push('Viewing: ' + ((opt('viewing', answers.viewing) || {}).l || 'not given'));
    if (answers.commute) lines.push('Week spent around: ' + ((opt('commute', answers.commute) || {}).l || ''));
    lines.push('Leans towards: ' + (BRANCH_NAME[lead.branch] || 'undecided'));
    lines.push('');
    for (const row of f.want) lines.push(row.key + ': ' + row.values.join(', '));
    if (f.no.length) {
      lines.push('Ruled out: ' + f.no.map((r) => r.values.join(', ')).join(' · '));
    }
    if (lead.note) lines.push('Their note: ' + lead.note);
    lines.push('');
    lines.push('Lead temperature: ' + h.label + ' (' + h.value + '/100)');
    for (const p of h.parts) lines.push('  ' + p.key + ' ' + p.got + '/' + p.of + ' (' + p.note + ')');
    for (const fl of h.flags) lines.push('  ' + (fl.tone === 'good' ? '+' : '!') + ' ' + fl.text);
    return lines.join('\n');
  }

  return {
    CURRENCY: CURRENCY,
    CARDS: CARDS,
    ROUND1: ROUND1,
    ROUND2: ROUND2,
    ROUND3: ROUND3,
    ROUND_NAME: ROUND_NAME,
    BRANCH_NAME: BRANCH_NAME,
    QUESTIONS: QUESTIONS,
    CONTRADICTIONS: CONTRADICTIONS,
    option: opt,
    money: money,
    likes: likes,
    decideBranch: decideBranch,
    buildRound: buildRound,
    facets: facets,
    contradictions: contradictions,
    tasteFloor: tasteFloor,
    hotness: hotness,
    briefText: briefText,
  };
});
