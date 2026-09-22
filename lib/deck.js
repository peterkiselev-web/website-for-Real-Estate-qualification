'use strict';

/**
 * The swipe deck.
 *
 * Every card is one question in disguise. Instead of asking "do you want a
 * private pool or a communal one?", the client swipes on a picture and the
 * answer lands in the agent's dashboard.
 *
 * To use real photography instead of the bundled illustrations, point `image`
 * at any URL (a CDN, an S3 bucket, /img/your-photo.jpg). Nothing else changes.
 */

const CATEGORIES = {
  style: { label: 'The building', blurb: 'Which places make you look twice?' },
  greenery: { label: 'Outdoor space', blurb: 'How much green do you actually want?' },
  layout: { label: 'Inside', blurb: 'How should the space be carved up?' },
  pool: { label: 'Water', blurb: 'Pool person, or not?' },
  extra: { label: 'Lifestyle', blurb: 'The things that quietly decide it.' },
};

const PROPERTY_TYPES = [
  { id: 'apartment', label: 'Apartment', emoji: '🏢' },
  { id: 'house', label: 'House', emoji: '🏡' },
  { id: 'townhouse', label: 'Townhouse', emoji: '🏘️' },
  { id: 'newbuild', label: 'New build', emoji: '✨' },
  { id: 'investment', label: 'Investment', emoji: '📈' },
  { id: 'unsure', label: 'Not sure yet', emoji: '🤷' },
];

const BUDGET_BANDS = [
  { id: 'b1', label: 'Under 300k', min: 0, max: 300000 },
  { id: 'b2', label: '300k - 500k', min: 300000, max: 500000 },
  { id: 'b3', label: '500k - 750k', min: 500000, max: 750000 },
  { id: 'b4', label: '750k - 1M', min: 750000, max: 1000000 },
  { id: 'b5', label: '1M - 2M', min: 1000000, max: 2000000 },
  { id: 'b6', label: '2M+', min: 2000000, max: null },
];

const TIMELINES = [
  { id: 'now', label: 'Ready now', weight: 1 },
  { id: '3m', label: 'Next 3 months', weight: 0.85 },
  { id: '6m', label: '6 to 12 months', weight: 0.6 },
  { id: 'browsing', label: 'Just browsing', weight: 0.3 },
];

/**
 * `only` limits a card to certain property types. Leave it out and the card is
 * shown to everyone. `facet` is what the agent reads: liking this card means
 * facet.key = facet.value.
 */
const CARDS = [
  // ---------------------------------------------------------------- style
  {
    id: 'style-modern',
    category: 'style',
    title: 'Glass-front new build',
    caption: 'Sharp lines, floor to ceiling glazing',
    image: '/img/style-modern.svg',
    facet: { key: 'style', value: 'modern' },
    tags: ['modern', 'new build', 'lots of light'],
  },
  {
    id: 'style-period',
    category: 'style',
    title: 'Period terrace',
    caption: 'Original features, high ceilings, a bit of history',
    image: '/img/style-period.svg',
    facet: { key: 'style', value: 'period' },
    tags: ['period features', 'character', 'renovation possible'],
  },
  {
    id: 'style-warehouse',
    category: 'style',
    title: 'Converted warehouse loft',
    caption: 'Exposed brick, steel windows, open volume',
    image: '/img/style-warehouse.svg',
    facet: { key: 'style', value: 'industrial' },
    tags: ['loft', 'industrial', 'open volume'],
  },
  {
    id: 'style-cottage',
    category: 'style',
    title: 'Country cottage',
    caption: 'Out of town, quiet lane, log burner',
    image: '/img/style-cottage.svg',
    facet: { key: 'style', value: 'rural' },
    tags: ['rural', 'quiet', 'countryside'],
  },
  {
    id: 'style-tower',
    category: 'style',
    title: 'High-floor city apartment',
    caption: 'Twentieth floor, skyline in every window',
    image: '/img/style-tower.svg',
    facet: { key: 'style', value: 'tower' },
    tags: ['city centre', 'views', 'high floor'],
    only: ['apartment', 'newbuild', 'investment', 'unsure'],
  },

  // ------------------------------------------------------------- greenery
  {
    id: 'green-lawn',
    category: 'greenery',
    title: 'Manicured lawn and hedges',
    caption: 'Striped grass, clipped edges, someone mows it',
    image: '/img/green-lawn.svg',
    facet: { key: 'greenery', value: 'manicured lawn' },
    tags: ['lawn', 'family garden', 'upkeep needed'],
    only: ['house', 'townhouse', 'newbuild', 'unsure', 'investment'],
  },
  {
    id: 'green-wild',
    category: 'greenery',
    title: 'Wild cottage garden',
    caption: 'Loose planting, pollinators, deliberately untidy',
    image: '/img/green-wild.svg',
    facet: { key: 'greenery', value: 'wild garden' },
    tags: ['garden', 'informal planting', 'privacy'],
    only: ['house', 'townhouse', 'newbuild', 'unsure'],
  },
  {
    id: 'green-balcony',
    category: 'greenery',
    title: 'Balcony jungle',
    caption: 'Pots, climbers, room for two chairs',
    image: '/img/green-balcony.svg',
    facet: { key: 'greenery', value: 'planted balcony' },
    tags: ['balcony', 'small outdoor space', 'low upkeep'],
  },
  {
    id: 'green-roof',
    category: 'greenery',
    title: 'Roof terrace with planters',
    caption: 'Entertaining space above the street',
    image: '/img/green-roof.svg',
    facet: { key: 'greenery', value: 'roof terrace' },
    tags: ['roof terrace', 'entertaining', 'views'],
  },
  {
    id: 'green-courtyard',
    category: 'greenery',
    title: 'Shaded courtyard',
    caption: 'Mature trees, walled, cool in summer',
    image: '/img/green-courtyard.svg',
    facet: { key: 'greenery', value: 'courtyard' },
    tags: ['courtyard', 'mature trees', 'private'],
  },
  {
    id: 'green-paved',
    category: 'greenery',
    title: 'Paved yard, zero upkeep',
    caption: 'Nothing to mow, nothing to water',
    image: '/img/green-paved.svg',
    facet: { key: 'greenery', value: 'no maintenance' },
    tags: ['low maintenance', 'no garden', 'practical'],
  },

  // --------------------------------------------------------------- layout
  {
    id: 'layout-open',
    category: 'layout',
    title: 'Open-plan everything',
    caption: 'Kitchen, dining and living in one room',
    image: '/img/layout-open.svg',
    facet: { key: 'layout', value: 'open plan' },
    tags: ['open plan', 'sociable', 'island kitchen'],
  },
  {
    id: 'layout-separate',
    category: 'layout',
    title: 'Separate kitchen and dining',
    caption: 'Doors that close, mess that hides',
    image: '/img/layout-separate.svg',
    facet: { key: 'layout', value: 'separate rooms' },
    tags: ['separate rooms', 'formal dining', 'quiet'],
  },
  {
    id: 'layout-broken',
    category: 'layout',
    title: 'Broken-plan with a snug',
    caption: 'Open, but with one room to hide in',
    image: '/img/layout-broken.svg',
    facet: { key: 'layout', value: 'broken plan' },
    tags: ['broken plan', 'snug', 'flexible'],
  },
  {
    id: 'layout-atrium',
    category: 'layout',
    title: 'Double-height atrium',
    caption: 'Galleried landing, light from above',
    image: '/img/layout-atrium.svg',
    facet: { key: 'layout', value: 'double height' },
    tags: ['double height', 'statement space', 'light'],
  },
  {
    id: 'layout-office',
    category: 'layout',
    title: 'Dedicated home office',
    caption: 'A door, a desk, no one behind you on calls',
    image: '/img/layout-office.svg',
    facet: { key: 'layout', value: 'home office' },
    tags: ['home office', 'works from home', 'extra room'],
  },
  {
    id: 'layout-loft',
    category: 'layout',
    title: 'Loft conversion up top',
    caption: 'Whole floor to yourself, sloped ceilings',
    image: '/img/layout-loft.svg',
    facet: { key: 'layout', value: 'loft conversion' },
    tags: ['loft room', 'extra floor', 'main suite'],
    only: ['house', 'townhouse', 'unsure'],
  },

  // ----------------------------------------------------------------- pool
  {
    id: 'pool-community',
    category: 'pool',
    title: 'Resort-size community pool',
    caption: 'Shared with the development, loungers, gym next door',
    image: '/img/pool-community.svg',
    facet: { key: 'pool', value: 'community pool' },
    tags: ['community pool', 'shared amenities', 'service charge'],
  },
  {
    id: 'pool-private',
    category: 'pool',
    title: 'Private lap pool',
    caption: 'Yours alone, swim before work',
    image: '/img/pool-private.svg',
    facet: { key: 'pool', value: 'private pool' },
    tags: ['private pool', 'premium', 'outdoor living'],
  },
  {
    id: 'pool-plunge',
    category: 'pool',
    title: 'Courtyard plunge pool',
    caption: 'Small, private, more for cooling off than laps',
    image: '/img/pool-plunge.svg',
    facet: { key: 'pool', value: 'plunge pool' },
    tags: ['plunge pool', 'compact', 'private'],
  },
  {
    id: 'pool-none',
    category: 'pool',
    title: 'No pool, bigger garden',
    caption: 'Trade the water for lawn and trees',
    image: '/img/pool-none.svg',
    facet: { key: 'pool', value: 'no pool' },
    tags: ['no pool', 'more garden', 'lower running costs'],
  },

    // ---------------------------------------------------------------- extra
  {
    id: 'extra-garage',
    category: 'extra',
    title: 'Garage and driveway',
    caption: 'Two cars off the street, space for bikes',
    image: '/img/extra-garage.svg',
    facet: { key: 'parking', value: 'garage and driveway' },
    tags: ['parking', 'garage', 'storage'],
  },
  {
    id: 'extra-station',
    category: 'extra',
    title: 'Five minutes from the station',
    caption: 'Commute measured in minutes, not hours',
    image: '/img/extra-station.svg',
    facet: { key: 'location priority', value: 'transport links' },
    tags: ['transport links', 'commuter', 'walkable'],
  },
  {
    id: 'extra-gated',
    category: 'extra',
    title: 'Gated with a concierge',
    caption: 'Someone takes the parcels, gate stays shut',
    image: '/img/extra-gated.svg',
    facet: { key: 'security', value: 'gated and staffed' },
    tags: ['gated', 'concierge', 'security'],
  },
  {
    id: 'extra-gym',
    category: 'extra',
    title: 'Home gym and spa room',
    caption: 'A room that never becomes a spare bedroom',
    image: '/img/extra-gym.svg',
    facet: { key: 'wellness', value: 'gym at home' },
    tags: ['home gym', 'wellness', 'extra room'],
  },
];

const CARDS_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

/**
 * Build a deck for one client. Cards are filtered by property type, then dealt
 * round robin across categories so the client never sees five pools in a row.
 */
function buildDeck(propertyType, limit) {
  const type = propertyType || 'unsure';
  const eligible = CARDS.filter((card) => !card.only || card.only.includes(type));

  const buckets = new Map();
  for (const card of eligible) {
    if (!buckets.has(card.category)) buckets.set(card.category, []);
    buckets.get(card.category).push(card);
  }

  const order = ['style', 'greenery', 'layout', 'pool', 'extra'].filter((c) => buckets.has(c));
  const dealt = [];
  let dealtSomething = true;
  while (dealtSomething) {
    dealtSomething = false;
    for (const category of order) {
      const bucket = buckets.get(category);
      if (bucket.length) {
        dealt.push(bucket.shift());
        dealtSomething = true;
      }
    }
  }

  const max = Number.isFinite(limit) && limit > 0 ? limit : dealt.length;
  return dealt.slice(0, max).map(publicCard);
}

/** Strip the scoring internals before sending a card to the browser. */
function publicCard(card) {
  return {
    id: card.id,
    category: card.category,
    categoryLabel: CATEGORIES[card.category].label,
    title: card.title,
    caption: card.caption,
    image: card.image,
    tags: card.tags,
  };
}

module.exports = {
  CARDS,
  CARDS_BY_ID,
  CATEGORIES,
  PROPERTY_TYPES,
  BUDGET_BANDS,
  TIMELINES,
  buildDeck,
  publicCard,
};
