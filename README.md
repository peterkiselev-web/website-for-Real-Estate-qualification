# SwipeHouse

A Tinder-style qualification funnel for estate agents. You send a client one link.
They type their name, email, area and budget, then swipe left or right on about
twenty pictures: house styles, gardens, floor plans, a resort-size community pool,
a private lap pool. Sixty seconds later you have a brief that a normal form would
never have got out of them, and they had fun making it.

Every lead is saved the moment they start, so the people who wander off halfway
still show up on your desk with a score and the exact card they quit on.

No frameworks, no database, no build step. Node 18 or newer and one command.

```bash
npm start
# client link:     http://localhost:3000/
# your dashboard:  http://localhost:3000/agent
```

The dashboard passcode is printed in the terminal on first run. Set your own with
`AGENT_PASSCODE` so it survives a restart.

## What the client sees

1. **Welcome.** One button. No wall of fields.
2. **Three quick steps.** Name and email, then what and where, then budget and timing.
   Chips instead of dropdowns, so it is mostly tapping.
3. **The deck.** A card at a time: picture on top, title and one line underneath.
   Drag it, tap the buttons, or use the arrow keys. Z undoes the last swipe.
   Stamps, haptics, a progress bar and a running count of what is left.
4. **The reveal.** A score, the brief their swipes built ("Pool: private pool.
   Greenery: roof terrace. Layout: open plan"), the shortlist of everything they
   liked, and an optional phone number and note.

If they close the tab mid-deck, the answers so far are already saved, and the link
picks up where they left off for 24 hours.

## What you see

`/agent` is the lead desk:

- Every lead scored 0 to 100 and labelled Cold, Warming, Qualified or Hot.
- Status at a glance: opened, swiping now, finished the deck, or dropped out.
  Drop-outs show how far they got and which card they stopped on.
- The answers as facets ("wants a private pool, ruled out the community one"),
  plus the thumbnails they swiped right and left on.
- A plain-text summary sized for a CRM note, a copy button, and a prefilled email.
- Your own notes per lead, archive, delete, and a CSV export of the lot.

### How the score works

The swiping carries the weight, because contact details are what every boring form
already collects and they qualify nobody.

| Signal | Points | Why |
| --- | --- | --- |
| Name, email, phone | 18 | Table stakes |
| Type, area, budget | 20 | The brief |
| Timing | 10 | Ready now beats "just browsing" |
| Cards answered | 42 | The part that actually tells you something |
| Decisiveness | 10 | Swiping right on everything tells you nothing |

80 and up is Hot, 60 is Qualified, 35 is Warming, below that is Cold. Tune the
numbers in `lib/scoring.js` if your market disagrees.

## Make it yours

Everything is environment variables, no code edit needed:

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `AGENT_NAME` | `your agent` | Your name, used throughout the client copy |
| `AGENCY_NAME` | `SwipeHouse` | Shown on the welcome screen |
| `CURRENCY_SYMBOL` | `$` | Used on the budget chips and in summaries |
| `AGENT_PASSCODE` | random per run | Dashboard passcode |
| `DECK_LIMIT` | `20` | Cards per client. Drop to 12 for an even faster funnel |
| `DATA_FILE` | `data/leads.json` | Where leads are written |

```bash
AGENT_NAME="Dana" AGENCY_NAME="Kiselev Property" CURRENCY_SYMBOL="£" \
AGENT_PASSCODE="something-long" npm start
```

### The cards

`lib/deck.js` is the whole questionnaire. A card looks like this:

```js
{
  id: 'pool-private',
  category: 'pool',
  title: 'Private lap pool',
  caption: 'Yours alone, swim before work',
  image: '/img/pool-private.svg',
  facet: { key: 'pool', value: 'private pool' },  // what liking it means
  tags: ['private pool', 'premium', 'outdoor living'],
  only: ['house', 'townhouse'],                   // optional filter by property type
}
```

`facet` is what the dashboard reports as an answer. `tags` feed the want and
deal-breaker chips. `only` hides a card from the wrong buyer, so nobody looking at
apartments is asked about mowing a lawn. Cards are dealt round robin across
categories, so the deck never runs five pools in a row.

**Using real photography.** Point `image` at any URL, including a remote one, and
the card uses it. The bundled SVG illustrations exist so the site works with no
image hosting, no licensing questions and almost no bandwidth. If you replace them,
crop to 4:3 and keep the subject centred: the card shows most of the frame. To edit
an illustration, change `scripts/generate-images.js` and run `npm run images`.

## Data and privacy

Leads live in one JSON file, written atomically. You can read it, back it up, or
delete a line. Client sessions are protected by a per-lead token so one visitor
cannot read or overwrite another's answers, and the dashboard sits behind a
passcode with rate-limited logins and an HttpOnly session cookie.

If you put this on the public internet, put it behind HTTPS (a reverse proxy is
fine, the cookie upgrades itself to `Secure` when it sees `X-Forwarded-Proto`), and
set a long `AGENT_PASSCODE`. You are storing names and email addresses, so keep the
retention short and tell clients who you are, which is the only reason the welcome
screen says the answers go to one agent.

## Development

```bash
npm start     # run it
npm run dev   # run it with auto restart
npm test      # unit and HTTP tests, no network needed
npm run images # redraw the card illustrations
```

```
server.js                 routing, static files, agent auth, rate limits
lib/deck.js               the cards and how a deck is dealt
lib/scoring.js            swipes to score, facets, drop-off, CRM summary
lib/store.js              JSON persistence
public/                   client app, agent dashboard, illustrations
scripts/generate-images.js  draws public/img/*.svg
test/                     node:test suites
```

Swap `lib/store.js` for a database when one file stops being enough. Nothing else
knows how leads are stored.
