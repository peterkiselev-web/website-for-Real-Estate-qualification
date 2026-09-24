/**
 * Dubai communities, and the matcher that turns a buyer's swipes into a
 * shortlist of areas.
 *
 * Universal module, like lib/qualify.js: the server and the browser run this
 * same file so a buyer and their agent always see the same shortlist.
 *
 * PRICES ARE ENTRY ESTIMATES, in AED, for the cheapest honest example of that
 * unit type in that community. They move with the market. Keep them roughly
 * right and the budget check stays useful; let them rot and it lies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./qualify'));
  else root.Communities = factory(root.Qualify);
})(typeof self !== 'undefined' ? self : this, function (Qualify) {
  'use strict';

  /* ------------------------------------------------------- vocabulary */

  /** What each attribute means in a sentence, for the "why this area" lines. */
  const PHRASE = {
    beach: 'the beach is walkable',
    waterfront: 'water on the doorstep',
    golf: 'golf on the doorstep',
    gated: 'gated, with security on the entrance',
    quiet: 'quiet, away from the noise',
    family: 'built around families',
    schools: 'schools inside the community',
    park: 'parks and green space',
    metro: 'metro within walking distance',
    central: 'close to Downtown and DIFC',
    buzz: 'nightlife and weekends on the doorstep',
    dining: 'somewhere to walk to for dinner',
    newBuild: 'newly built stock',
    offplan: 'off-plan with payment plans',
    yield: 'rents well between visits',
    prime: 'a prime address',
    privatePool: 'private pools are normal here',
    communityPool: 'shared pools and gyms included',
    highRise: 'tower living',
    lowRise: 'low-rise, no lifts',
    seaView: 'sea views',
    skylineView: 'skyline views',
    staffRoom: 'staff rooms are standard',
    majlis: 'villas laid out with a majlis',
    garage: 'garages and driveways',
    established: 'established, the trees have grown in',
  };

  /* ------------------------------------------------------ communities */

  const COMMUNITIES = [
    {
      id: 'dubai-marina', name: 'Dubai Marina', kinds: ['apartment'],
      from: { apartment: 1100000 },
      attrs: { waterfront: 3, buzz: 3, dining: 3, metro: 3, highRise: 3, seaView: 2, central: 2, yield: 3, communityPool: 2, beach: 2 },
      drive: { downtown: 25, marina: 5, jebelali: 20, deira: 40 },
      blurb: 'Tower living on the water, with everything walkable.',
      catch: 'Weekend traffic and tourists, and older towers carry heavy service charges.',
    },
    {
      id: 'jbr', name: 'Jumeirah Beach Residence', kinds: ['apartment'],
      from: { apartment: 1800000 },
      attrs: { beach: 3, waterfront: 3, buzz: 3, dining: 3, seaView: 3, highRise: 3, yield: 3, metro: 2, communityPool: 2 },
      drive: { downtown: 27, marina: 5, jebelali: 22, deira: 42 },
      blurb: 'The beach is the front garden, and The Walk is downstairs.',
      catch: 'Busy all year, and the buildings are twenty years old now.',
    },
    {
      id: 'emaar-beachfront', name: 'Emaar Beachfront', kinds: ['apartment'],
      from: { apartment: 2600000 },
      attrs: { beach: 3, waterfront: 3, seaView: 3, newBuild: 3, prime: 2, highRise: 3, communityPool: 3, gated: 2, offplan: 2 },
      drive: { downtown: 28, marina: 10, jebelali: 25, deira: 45 },
      blurb: 'A private-beach island of new towers between the Marina and the Palm.',
      catch: 'Still building out, and no metro of its own.',
    },
    {
      id: 'bluewaters', name: 'Bluewaters Island', kinds: ['apartment'],
      from: { apartment: 3600000 },
      attrs: { beach: 3, waterfront: 3, prime: 3, dining: 3, seaView: 3, newBuild: 2, highRise: 2, buzz: 2, communityPool: 3 },
      drive: { downtown: 28, marina: 8, jebelali: 24, deira: 44 },
      blurb: 'Low-density island living with the wheel, the beach and good restaurants.',
      catch: 'Premium prices and very little stock comes up.',
    },
    {
      id: 'palm-jumeirah', name: 'Palm Jumeirah', kinds: ['apartment', 'villa'],
      from: { apartment: 2400000, villa: 16000000 },
      attrs: { beach: 3, waterfront: 3, prime: 3, seaView: 3, dining: 3, privatePool: 2, quiet: 2, staffRoom: 2, communityPool: 2, gated: 2 },
      drive: { downtown: 30, marina: 15, jebelali: 30, deira: 45 },
      blurb: 'Beach at the end of the garden, hotels and restaurants on the Crescent.',
      catch: 'One road on and off, and the service charges match the postcode.',
    },
    {
      id: 'downtown', name: 'Downtown Dubai', kinds: ['apartment'],
      from: { apartment: 1600000 },
      attrs: { central: 3, skylineView: 3, buzz: 3, dining: 3, metro: 3, highRise: 3, prime: 2, yield: 3, communityPool: 2 },
      drive: { downtown: 5, marina: 25, jebelali: 35, deira: 20 },
      blurb: 'Burj views, the mall and the metro, all on foot.',
      catch: 'Noise, traffic and tourists, with small balconies for the money.',
    },
    {
      id: 'business-bay', name: 'Business Bay', kinds: ['apartment'],
      from: { apartment: 1000000 },
      attrs: { central: 3, skylineView: 2, metro: 2, highRise: 3, yield: 3, dining: 2, newBuild: 2, buzz: 2 },
      drive: { downtown: 8, marina: 25, jebelali: 35, deira: 22 },
      blurb: 'Downtown prices without the Downtown premium, on the canal.',
      catch: 'Cranes on three sides, and the view depends entirely on the tower.',
    },
    {
      id: 'difc', name: 'DIFC', kinds: ['apartment'],
      from: { apartment: 2000000 },
      attrs: { central: 3, prime: 2, dining: 3, metro: 3, highRise: 3, buzz: 2, yield: 2 },
      drive: { downtown: 5, marina: 25, jebelali: 38, deira: 18 },
      blurb: 'Walk to the office, the galleries and the best restaurants in the city.',
      catch: 'You pay for the postcode, and there is almost no green.',
    },
    {
      id: 'city-walk', name: 'City Walk and Jumeirah', kinds: ['apartment'],
      from: { apartment: 2200000 },
      attrs: { central: 3, lowRise: 3, dining: 3, newBuild: 2, prime: 2, park: 1, buzz: 2, beach: 1 },
      drive: { downtown: 10, marina: 22, jebelali: 35, deira: 20 },
      blurb: 'Low-rise city living, a short drive from both Downtown and the sea.',
      catch: 'Service charges are high and the metro is not on the doorstep.',
    },
    {
      id: 'jlt', name: 'Jumeirah Lake Towers', kinds: ['apartment'],
      from: { apartment: 900000 },
      attrs: { metro: 3, highRise: 3, yield: 3, dining: 2, park: 1, communityPool: 2, central: 1, waterfront: 1 },
      drive: { downtown: 25, marina: 8, jebelali: 18, deira: 40 },
      blurb: 'The Marina next door, for noticeably less money, right on the metro.',
      catch: 'Towers vary wildly in quality, and parking is tight.',
    },
    {
      id: 'jvc', name: 'Jumeirah Village Circle', kinds: ['apartment', 'townhouse'],
      from: { apartment: 650000, townhouse: 2200000 },
      attrs: { yield: 3, newBuild: 2, family: 2, quiet: 1, communityPool: 2, lowRise: 2, park: 1 },
      drive: { downtown: 25, marina: 15, jebelali: 22, deira: 40 },
      blurb: 'Where the yields are, and where a first purchase actually adds up.',
      catch: 'Half-finished in places, no metro, and roadworks somewhere most months.',
    },
    {
      id: 'al-furjan', name: 'Al Furjan', kinds: ['apartment', 'townhouse'],
      from: { apartment: 900000, townhouse: 2600000 },
      attrs: { metro: 2, family: 2, yield: 2, newBuild: 2, quiet: 2, garage: 2, communityPool: 2, lowRise: 2 },
      drive: { downtown: 30, marina: 15, jebelali: 12, deira: 45 },
      blurb: 'Townhouses and new towers with a metro station, out towards Jebel Ali.',
      catch: 'Bare in stretches, and the highway is always close.',
    },
    {
      id: 'sports-motor-city', name: 'Sports City and Motor City', kinds: ['apartment', 'townhouse'],
      from: { apartment: 700000, townhouse: 2400000 },
      attrs: { yield: 3, family: 2, golf: 2, quiet: 2, park: 1, communityPool: 2, lowRise: 2, garage: 1 },
      drive: { downtown: 28, marina: 20, jebelali: 25, deira: 45 },
      blurb: 'Space and a golf course for the price of a Marina studio.',
      catch: 'A long drive to the beach, and the buildings are ageing unevenly.',
    },
    {
      id: 'dubai-hills', name: 'Dubai Hills Estate', kinds: ['apartment', 'townhouse', 'villa'],
      from: { apartment: 1400000, townhouse: 3400000, villa: 7000000 },
      attrs: { golf: 3, park: 3, family: 3, schools: 3, gated: 2, newBuild: 3, central: 2, dining: 3, privatePool: 2, garage: 2, quiet: 2, communityPool: 2 },
      drive: { downtown: 15, marina: 20, jebelali: 30, deira: 30 },
      blurb: 'A golf course, a park, a mall and three schools, fifteen minutes from Downtown.',
      catch: 'Villas rarely come cheap, and parts of it are still going up.',
    },
    {
      id: 'arabian-ranches', name: 'Arabian Ranches', kinds: ['villa', 'townhouse'],
      from: { townhouse: 2600000, villa: 3200000 },
      attrs: { gated: 3, family: 3, schools: 3, quiet: 3, golf: 2, garage: 3, privatePool: 2, lowRise: 3, majlis: 2, staffRoom: 2, established: 3, park: 2 },
      drive: { downtown: 28, marina: 30, jebelali: 30, deira: 45 },
      blurb: 'The family villa community everyone compares the others to.',
      catch: 'You will live in the car, and the beach is half an hour away.',
    },
    {
      id: 'emirates-living', name: 'Emirates Living', kinds: ['villa', 'townhouse'],
      aka: 'The Springs, The Meadows, The Lakes',
      from: { townhouse: 2800000, villa: 5500000 },
      attrs: { gated: 2, family: 3, schools: 3, quiet: 3, established: 3, garage: 2, privatePool: 2, lowRise: 3, park: 2, golf: 1, central: 2, majlis: 1, staffRoom: 2 },
      drive: { downtown: 25, marina: 12, jebelali: 20, deira: 42 },
      blurb: 'Mature villa streets and lakes, twelve minutes from the Marina.',
      catch: 'The stock is twenty years old, so budget for a renovation.',
    },
    {
      id: 'emirates-hills', name: 'Emirates Hills', kinds: ['villa'],
      from: { villa: 22000000 },
      attrs: { prime: 3, golf: 3, gated: 3, quiet: 3, privatePool: 3, staffRoom: 3, majlis: 3, established: 2, schools: 2, garage: 3, park: 2 },
      drive: { downtown: 25, marina: 12, jebelali: 22, deira: 42 },
      blurb: 'The address people mean when they say Beverly Hills of Dubai, on the golf course.',
      catch: 'Entry is eight figures and the upkeep is a second mortgage.',
    },
    {
      id: 'jumeirah-golf-estates', name: 'Jumeirah Golf Estates', kinds: ['villa'],
      from: { villa: 4500000 },
      attrs: { golf: 3, gated: 3, quiet: 3, privatePool: 2, family: 2, garage: 2, staffRoom: 2, park: 2, established: 1, schools: 1 },
      drive: { downtown: 30, marina: 20, jebelali: 18, deira: 48 },
      blurb: 'Two championship courses and silence, built for people who actually play.',
      catch: 'Far from the beach, and a golf-view plot costs a lot more than a garden one.',
    },
    {
      id: 'damac-hills', name: 'Damac Hills', kinds: ['apartment', 'villa'],
      from: { apartment: 900000, villa: 3200000 },
      attrs: { golf: 3, gated: 2, family: 2, park: 2, communityPool: 2, privatePool: 2, yield: 2, quiet: 2, garage: 2 },
      drive: { downtown: 30, marina: 25, jebelali: 25, deira: 48 },
      blurb: 'A golf community where the entry price is still reasonable.',
      catch: 'Build quality is mixed and owners argue about the service charge.',
    },
    {
      id: 'tilal-al-ghaf', name: 'Tilal Al Ghaf', kinds: ['villa', 'townhouse'],
      from: { townhouse: 3000000, villa: 4500000 },
      attrs: { waterfront: 2, newBuild: 3, gated: 3, quiet: 3, family: 3, privatePool: 3, park: 2, offplan: 2, garage: 2, staffRoom: 2 },
      drive: { downtown: 30, marina: 25, jebelali: 22, deira: 48 },
      blurb: 'A swimmable lagoon, new villas, and a community built in one go.',
      catch: 'Young, so the amenities and the neighbours arrive in stages.',
    },
    {
      id: 'district-one', name: 'District One, MBR City', kinds: ['villa'],
      from: { villa: 12000000 },
      attrs: { waterfront: 3, prime: 3, gated: 3, quiet: 2, central: 3, privatePool: 3, newBuild: 3, staffRoom: 3, majlis: 2, garage: 3 },
      drive: { downtown: 12, marina: 25, jebelali: 35, deira: 22 },
      blurb: 'A crystal lagoon and big modern villas, ten minutes from Downtown.',
      catch: 'Prices have run hard, and some handovers have slipped.',
    },
    {
      id: 'al-barari', name: 'Al Barari', kinds: ['villa'],
      from: { villa: 14000000 },
      attrs: { quiet: 3, park: 3, prime: 3, privatePool: 3, gated: 3, established: 2, staffRoom: 3, majlis: 2, garage: 2 },
      drive: { downtown: 22, marina: 30, jebelali: 35, deira: 30 },
      blurb: 'The greenest address in the city, and the quietest.',
      catch: 'Very few homes, rarely available, and the service charge reflects the botany.',
    },
    {
      id: 'creek-harbour', name: 'Dubai Creek Harbour', kinds: ['apartment'],
      from: { apartment: 1500000 },
      attrs: { waterfront: 3, newBuild: 3, offplan: 3, skylineView: 3, park: 2, family: 2, yield: 2, communityPool: 2, highRise: 3 },
      drive: { downtown: 15, marina: 35, jebelali: 45, deira: 12 },
      blurb: 'Creek and skyline views from brand new towers, on a payment plan.',
      catch: 'A building site for a few more years, and no metro yet.',
    },
    {
      id: 'sobha-hartland', name: 'Sobha Hartland and MBR', kinds: ['apartment', 'villa'],
      from: { apartment: 1300000, villa: 8000000 },
      attrs: { central: 2, newBuild: 3, offplan: 2, park: 2, schools: 2, quiet: 2, yield: 2, waterfront: 1, communityPool: 2 },
      drive: { downtown: 12, marina: 28, jebelali: 38, deira: 22 },
      blurb: 'Green, central and new, with two international schools inside it.',
      catch: 'Construction noise is part of the deal for now.',
    },
    {
      id: 'town-square-valley', name: 'Town Square and The Valley', kinds: ['townhouse', 'villa'],
      from: { townhouse: 1600000, villa: 2400000 },
      attrs: { family: 3, quiet: 3, gated: 2, newBuild: 3, park: 2, communityPool: 2, garage: 2, yield: 2, schools: 1, lowRise: 3 },
      drive: { downtown: 35, marina: 35, jebelali: 30, deira: 50 },
      blurb: 'The most house you can buy in Dubai for the money, if you do not mind the drive.',
      catch: 'A long way out, and you are dependent on the car for everything.',
    },
    {
      id: 'umm-suqeim', name: 'Umm Suqeim and Al Wasl', kinds: ['villa'],
      from: { villa: 9000000 },
      attrs: { beach: 3, quiet: 2, established: 3, privatePool: 2, central: 2, schools: 3, lowRise: 3, garage: 2, prime: 2 },
      drive: { downtown: 15, marina: 18, jebelali: 32, deira: 28 },
      blurb: 'Old Jumeirah villas a street or two from the sea, with the best schools nearby.',
      catch: 'Mostly older houses, few gated options, and plot prices keep climbing.',
    },
    {
      id: 'dubai-south', name: 'Dubai South', kinds: ['apartment', 'townhouse'],
      from: { apartment: 600000, townhouse: 1500000 },
      attrs: { yield: 3, offplan: 3, newBuild: 3, quiet: 2, family: 1, communityPool: 1 },
      drive: { downtown: 45, marina: 30, jebelali: 10, deira: 55 },
      blurb: 'The cheapest way into new-build Dubai, next to the new airport and Expo City.',
      catch: 'A long way from the city, and the upside depends on the airport actually happening.',
    },
    {
      id: 'silicon-oasis', name: 'Dubai Silicon Oasis', kinds: ['apartment', 'townhouse'],
      from: { apartment: 550000, townhouse: 1900000 },
      attrs: { yield: 3, quiet: 2, family: 2, schools: 2, communityPool: 1, garage: 1 },
      drive: { downtown: 25, marina: 35, jebelali: 40, deira: 25 },
      blurb: 'Unglamorous, well served, and the rent covers the mortgage.',
      catch: 'Nobody moves here for the lifestyle.',
    },
  ];

  /* ------------------------------------------------ extra signals */

  const PURPOSE_SIGNALS = {
    live: { family: 1, schools: 1 },
    invest: { yield: 3, newBuild: 1, prime: -1 },
    holiday: { beach: 2, prime: 1, communityPool: 1, yield: 1 },
    flip: { offplan: 2, newBuild: 2, yield: 2 },
  };

  /* ------------------------------------------------ tie-break bank */

  /**
   * Asked only when the leading areas actually disagree about it. `split` is
   * the attribute that separates them; the options push the shortlist apart.
   */
  const TIEBREAKERS = [
    {
      id: 'tb-beach-golf', split: ['beach', 'golf'],
      q: 'Sand or greens?',
      sub: 'Both are twenty minutes from the other one. Which do you want out of the window?',
      options: [
        { id: 'beach', l: 'Beach and water', s: { beach: 3, waterfront: 2, seaView: 1, golf: -2 } },
        { id: 'golf', l: 'Golf and green', s: { golf: 3, quiet: 1, park: 1, beach: -2, waterfront: -1 } },
      ],
    },
    {
      id: 'tb-buzz-quiet', split: ['buzz', 'quiet'],
      q: 'Weekends at home?',
      sub: 'Walk out to dinner, or hear nothing but the garden.',
      options: [
        { id: 'buzz', l: 'Out for dinner, walking', s: { buzz: 3, dining: 2, central: 1, quiet: -2 } },
        { id: 'quiet', l: 'Peace and a big garden', s: { quiet: 3, park: 1, lowRise: 1, buzz: -2, dining: -1 } },
      ],
    },
    {
      id: 'tb-metro-space', split: ['metro', 'family'],
      q: 'Metro, or more space for the money?',
      sub: 'In Dubai you rarely get both.',
      options: [
        { id: 'metro', l: 'Walk to the metro', s: { metro: 3, central: 1, highRise: 1, garage: -1 } },
        { id: 'space', l: 'More space, I will drive', s: { family: 2, quiet: 2, garage: 2, lowRise: 1, metro: -2 } },
      ],
    },
    {
      id: 'tb-schools', split: ['schools'],
      q: 'Is the school run part of your day?',
      sub: '',
      options: [
        { id: 'yes', l: 'Yes, schools matter', s: { schools: 3, family: 2, gated: 1 } },
        { id: 'no', l: 'No school run', s: { buzz: 1, central: 1, prime: 1, schools: -2 } },
      ],
    },
    {
      id: 'tb-new-established', split: ['newBuild', 'established'],
      q: 'Brand new, or grown in?',
      sub: 'New means warranties and dust. Established means trees and a renovation.',
      options: [
        { id: 'new', l: 'Brand new', s: { newBuild: 3, offplan: 1, communityPool: 1, established: -2 } },
        { id: 'established', l: 'Established, with trees', s: { established: 3, quiet: 1, park: 1, newBuild: -2, offplan: -1 } },
      ],
    },
    {
      id: 'tb-view', split: ['seaView', 'skylineView'],
      q: 'Sea view or skyline?',
      sub: 'The premium is similar. The mood is not.',
      options: [
        { id: 'sea', l: 'Sea', s: { seaView: 3, waterfront: 2, beach: 1, skylineView: -2 } },
        { id: 'skyline', l: 'Skyline', s: { skylineView: 3, central: 2, highRise: 1, seaView: -2, beach: -1 } },
      ],
    },
    {
      id: 'tb-handover', split: ['offplan'],
      q: 'Move in now, or wait for handover?',
      sub: 'Off-plan usually buys more for the money, two years later.',
      options: [
        { id: 'now', l: 'Ready, move in now', s: { offplan: -3, newBuild: -1, established: 1 } },
        { id: 'wait', l: 'Happy to wait for new', s: { offplan: 3, newBuild: 2 } },
      ],
    },
    {
      id: 'tb-prime', split: ['prime', 'yield'],
      q: 'Best address, or best value?',
      sub: 'The same money buys a small prime flat or a big one elsewhere.',
      options: [
        { id: 'prime', l: 'Best address, smaller home', s: { prime: 3, beach: 1, central: 1, yield: -1 } },
        { id: 'value', l: 'More home, quieter postcode', s: { yield: 2, family: 2, quiet: 1, prime: -2 } },
      ],
    },
  ];

  /* ------------------------------------------------------- matching */

  function addTo(vector, signals, weight) {
    if (!signals) return;
    for (const key of Object.keys(signals)) {
      vector[key] = (vector[key] || 0) + signals[key] * (weight === undefined ? 1 : weight);
    }
  }

  /**
   * Everything the buyer has told us, as one attribute vector. The card
   * signals come from the funnel (it owns the cards); this adds what the
   * answers and the tie-breaks say.
   */
  function signalsFor(lead, base) {
    const vector = {};
    addTo(vector, base || lead.signals || {});
    const answers = lead.answers || {};
    addTo(vector, PURPOSE_SIGNALS[answers.purpose]);
    if (answers.commute === 'wfh') addTo(vector, { quiet: 1 });
    for (const key of Object.keys(vector)) vector[key] = Math.max(-3, Math.min(3, vector[key]));
    // A tie-break is a decision, so it outranks the swipes that led to it.
    for (const id of Object.keys(lead.tiebreaks || {})) {
      const tb = TIEBREAKERS.find((t) => t.id === id);
      const option = tb && tb.options.find((o) => o.id === lead.tiebreaks[id]);
      if (option) addTo(vector, option.s);
    }
    return vector;
  }

  /** The funnel decides the kind; fall back to whatever is cheapest. */
  function kindFor(lead, opts) {
    return (opts && opts.kind) || lead.kind || 'any';
  }

  /** The cheapest honest entry for the kind of home they want. */
  function entryPrice(community, kind) {
    const prices = community.from;
    if (kind === 'villa') {
      const villa = prices.villa || prices.townhouse;
      return villa ? { price: villa, kind: prices.villa ? 'villa' : 'townhouse' } : null;
    }
    if (kind === 'apartment') {
      return prices.apartment ? { price: prices.apartment, kind: 'apartment' } : null;
    }
    const best = Object.keys(prices).reduce((lo, k) => (prices[k] < prices[lo] ? k : lo), Object.keys(prices)[0]);
    return { price: prices[best], kind: best };
  }

  function budgetMaxFor(lead) {
    return Qualify.budgetMax((lead.answers || {}).budget);
  }

  function driveScore(community, commute) {
    if (!commute || commute === 'wfh') return 0;
    const minutes = (community.drive || {})[commute];
    if (minutes === undefined) return 0;
    if (minutes <= 12) return 0.16;
    if (minutes <= 20) return 0.1;
    if (minutes <= 30) return 0.02;
    if (minutes <= 40) return -0.08;
    return -0.16;
  }

  /**
   * Cosine similarity between what they said and what the area is, then
   * adjusted for the commute and for whether they can afford the door.
   */
  function match(lead, options) {
    const opts = options || {};
    const signals = opts.signals || signalsFor(lead);
    const kind = kindFor(lead, opts);
    const pool = opts.alive && opts.alive.length ? opts.alive : COMMUNITIES;
    const budgetMax = budgetMaxFor(lead);
    const commute = (lead.answers || {}).commute;

    const keys = Object.keys(signals).filter((k) => signals[k] > 0);
    const signalLength = Math.sqrt(keys.reduce((sum, k) => sum + signals[k] * signals[k], 0)) || 1;

    const scored = [];
    for (const community of pool) {
      const entry = entryPrice(community, kind);
      if (!entry) continue;                        // they want a villa, this place has none

      const attrKeys = Object.keys(community.attrs);
      const commLength = Math.sqrt(attrKeys.reduce((sum, k) => sum + community.attrs[k] * community.attrs[k], 0)) || 1;
      let dot = 0;
      for (const key of Object.keys(signals)) {
        if (community.attrs[key]) dot += signals[key] * community.attrs[key];
      }
      let score = dot / (signalLength * commLength);
      score += driveScore(community, commute);

      let budget = 'unknown';
      if (budgetMax !== null) {
        if (entry.price <= budgetMax) budget = 'fits';
        else if (entry.price <= budgetMax * 1.25) budget = 'stretch';
        else budget = 'over';
      }
      if (budget === 'stretch') score *= 0.82;
      if (budget === 'over') score *= 0.3;

      const reasons = Object.keys(signals)
        .filter((k) => signals[k] >= 1.5 && (community.attrs[k] || 0) >= 2)
        .sort((a, b) => (signals[b] * community.attrs[b]) - (signals[a] * community.attrs[a]))
        .slice(0, 3)
        .map((k) => PHRASE[k])
        .filter(Boolean);

      scored.push({
        id: community.id,
        name: community.name,
        aka: community.aka || '',
        blurb: community.blurb,
        catch: community.catch,
        kind: entry.kind,
        from: entry.price,
        fromLabel: Qualify && Qualify.money ? Qualify.money(entry.price) : String(entry.price),
        budget: budget,
        reasons: reasons,
        minutes: commute && commute !== 'wfh' ? (community.drive || {})[commute] : null,
        raw: score,
      });
    }

    scored.sort((a, b) => b.raw - a.raw);
    const best = scored.length ? scored[0].raw : 1;
    for (const row of scored) {
      row.match = Math.max(35, Math.min(99, Math.round((row.raw / (best || 1)) * 97)));
    }

    const affordable = scored.filter((c) => c.budget !== 'over');
    const outOfReach = scored
      .filter((c) => c.budget === 'over')
      .sort((a, b) => b.raw - a.raw)
      .slice(0, 2);

    return {
      top: affordable.slice(0, opts.limit || 3),
      also: affordable.slice(opts.limit || 3, (opts.limit || 3) + 2),
      outOfReach: outOfReach,
      kind: kind,
      signals: signals,
    };
  }

  /**
   * Which questions are still worth asking: the ones where the leading areas
   * genuinely disagree and the buyer has not already answered.
   */
  function pickTiebreakers(lead, limit, opts) {
    const answered = lead.tiebreaks || {};
    const signals = (opts && opts.signals) || signalsFor(lead);
    const ranked = match(lead, { signals: signals, limit: 6, alive: opts && opts.alive, kind: opts && opts.kind });
    const contenders = ranked.top.concat(ranked.also).slice(0, 6);
    if (contenders.length < 2) return [];

    const scored = TIEBREAKERS
      .filter((tb) => !(tb.id in answered))
      .map((tb) => {
        let spread = 0;
        for (const attr of tb.split) {
          const values = contenders.map((c) => {
            const community = COMMUNITIES.find((x) => x.id === c.id);
            return (community.attrs[attr] || 0);
          });
          const high = Math.max(...values);
          const low = Math.min(...values);
          spread += high - low;
          // Asking about something nobody in the running offers is wasted breath.
          if (high < 2) spread -= 1;
        }
        // A question they have already answered by swiping is also wasted.
        const known = tb.split.reduce((sum, attr) => sum + Math.abs(signals[attr] || 0), 0);
        return { tb: tb, score: spread - known * 0.45 };
      })
      .filter((row) => row.score > 0.6)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit || 2).map((row) => row.tb);
  }

  /** One line per area for the agent's brief. */
  function shortlistText(lead, opts) {
    const result = match(lead, opts || {});
    const lines = [];
    result.top.forEach((c, i) => {
      lines.push(
        (i + 1) + '. ' + c.name + ' (' + c.match + '% match, ' + c.kind + 's from ' + c.fromLabel
        + (c.budget === 'stretch' ? ', a stretch' : '') + ')'
        + (c.reasons.length ? ' - ' + c.reasons.join(', ') : '')
      );
    });
    if (result.also.length) lines.push('Also: ' + result.also.map((c) => c.name).join(', '));
    if (result.outOfReach.length) {
      lines.push('Out of reach on this budget: ' + result.outOfReach.map((c) => c.name + ' (from ' + c.fromLabel + ')').join(', '));
    }
    return lines.join('\n');
  }

  return {
    COMMUNITIES: COMMUNITIES,
    PHRASE: PHRASE,
    TIEBREAKERS: TIEBREAKERS,
    signalsFor: signalsFor,
    kindFor: kindFor,
    match: match,
    pickTiebreakers: pickTiebreakers,
    shortlistText: shortlistText,
  };
});
