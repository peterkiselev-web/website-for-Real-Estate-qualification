# Swipe to Shortlist

A Tinder-style area finder and qualification funnel for Dubai estate agents. You
send a buyer one link. They swipe through three rounds of property pictures that
get narrower as they go, answer six quick questions, and settle one or two
tie-breaks. They leave knowing the three communities that suit them. You get the
same shortlist, plus a lead temperature out of 100.

A buyer who arrives with no idea whether they want Arabian Ranches or Dubai
Marina leaves with a ranked answer and the reasons behind it. That is the point
of the thing: the swipes decide the area, not a drop-down.

The temperature is not a completion meter. 100 means the buyer can proceed today:
money already in the UAE or a mortgage pre-approved, in Dubai and free to view
this week, and a brief with no contradictions in it. Someone who finishes every
card but has not spoken to a bank and is "watching the market" lands in the
thirties, which is exactly where they belong.

Two ways to run it:

```bash
npm start      # full app: client funnel, lead storage, agent dashboard
```

```
public/        # or host this folder as flat files, no server at all
```

The single page works either way. With a server behind it, every swipe is saved
as it happens, so the people who wander off halfway still land on your desk. As
flat files, the buyer's brief arrives by email when they press send.

- Client link: `http://localhost:3000/`
- Agent dashboard: `http://localhost:3000/agent`

The dashboard passcode is printed in the terminal on first run. Set your own with
`AGENT_PASSCODE` so it survives a restart.

## How the funnel narrows

**Round 1, the wide net.** Six places with nothing in common: a Marina tower, a
Downtown high-rise, a villa in a gated community, a beachfront villa, a golf
community villa, off-plan with a payment plan. What they swipe right on decides
which corner of the market they are in.

**Round 2, narrowing.** Six cards picked for that corner. A villa buyer is asked
about a majlis, a staff room, landscaping and a garage. An apartment buyer is
asked about sea views, high floors, balconies and the podium pool. Nobody is
asked about mowing a lawn they will never own.

**Round 3, the fussy bit.** The water question is always settled here: shared
pool, private pool, plunge pool or none. Plus home office, metro, gym, security,
whatever is still undecided for their corner.

**Then six taps.** What it is for, budget, where their week happens, how it gets
paid for, when they are moving, and whether they can view in person. Budget comes
after the pictures on purpose: by then they have already shown you their taste, so
the answer is honest rather than aspirational. The commute question does more work
than any other single answer, because in Dubai it decides half the map.

**Then the tie-breaks, which are chosen live.** The page ranks the communities,
finds where the leaders actually disagree, and asks only about that. Someone torn
between the beach and the golf gets "Sand or greens?". Someone torn between
Downtown and the Marina gets "Sea view or skyline?". Someone whose shortlist is
already decided gets asked nothing. A tie-break outranks the swipes that led to
it: picking greens pushes the beach down, not just golf up.

**Then the answer: three communities.** Ranked, with a match percentage, the
reasons drawn from their own swipes, the entry price for the kind of home they
want, the drive to where they work, and the catch. Plus two runners-up, and an
honest "out of reach on this budget" line naming what they liked but cannot
afford.

## How the temperature is worked out

| Band | Out of | What moves it |
| --- | --- | --- |
| Funds | 30 | Cash in the UAE 30, pre-approved mortgage 27, cash transferring in 23, mortgage not started 12, needs to sell first 7, no idea 3 |
| Timing | 20 | Buying now 20, within a month 16, one to three months 12, three to six 6, watching 2 |
| Viewing | 15 | In Dubai this week 15, in a few weeks 11, flying in 10, remote only 6 |
| Clarity | 20 | Rounds played, a real mix of yes and no, and no contradictions |
| Budget | 10 | Given at all, plus whether it actually reaches what they liked |
| Contact | 5 | Name, email, phone |

85 and up is Ready to proceed, 70 is Hot, 50 is Warm, 30 is Cool, below that is
Cold. Every lead shows its own arithmetic on the dashboard, so you can argue with
the number instead of trusting it.

**Flags** are the part worth reading. The dashboard raises them automatically:

- *Budget will not reach the taste.* Someone who swiped right on a beachfront
  villa (from AED 15M) with a budget of AED 1M to 2M gets flagged before you
  spend a Saturday on them.
- *Finance not arranged yet*, *buying depends on selling first*, *overseas buyer,
  video tours only*, *says they are only watching the market*.
- *Wants both sides of an either/or.* Swiping right on both a private pool and no
  pool means they have not decided, and the clarity score drops.
- The good ones too: cash already in the UAE, free to view this week, consistent
  brief.

## What the agent sees

`/agent`, behind a passcode:

- The three matched communities on every lead row, so you know what to send
  before you open anything.
- Every lead scored and sorted hottest first, with the six bands that produced
  the number and the flags underneath.
- Status at a glance: opened, swiping now, on the money questions, finished, or
  dropped out. Drop-outs show the round and the card they quit on, or which
  readiness question they baulked at.
- Every card they swiped right and left, so you can see the brief rather than
  read it.
- A plain-text brief sized for WhatsApp or a CRM note, a copy button, a prefilled
  email, and a WhatsApp link when they left a number.
- Notes per lead, archive, delete, CSV export of the lot.

## Make it yours

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `AGENT_NAME` | `your agent` | Your name, used in the client copy |
| `AGENCY_NAME` | `Swipe to Shortlist` | Shown on the dashboard |
| `AGENT_PASSCODE` | random per run | Dashboard passcode |
| `DATA_FILE` | `data/leads.json` | Where leads are written |

The client page also reads the agent's name and email from the link itself, so
one hosted copy can serve a whole team:

```
https://your-host/#a=Peter%20Kiselev&e=peter@agency.ae
```

Open the page, expand "Are you the agent? Build your link", and it writes that
link for you.

## The communities

`lib/communities.js` holds the map: 28 Dubai communities, what each one is,
entry prices per unit type, drive times to the four places people work, and the
honest catch. A community looks like this:

```js
{
  id: 'arabian-ranches', name: 'Arabian Ranches', kinds: ['villa', 'townhouse'],
  from: { townhouse: 2600000, villa: 3200000 },
  attrs: { gated: 3, family: 3, schools: 3, quiet: 3, golf: 2, garage: 3,
           privatePool: 2, majlis: 2, staffRoom: 2, established: 3 },
  drive: { downtown: 28, marina: 30, jebelali: 30, deira: 45 },
  blurb: 'The family villa community everyone compares the others to.',
  catch: 'You will live in the car, and the beach is half an hour away.',
}
```

Matching is a cosine similarity between what the buyer's swipes say and what the
community is, adjusted for the commute and for whether they can afford the door.
A villa hunter is never shown an apartment-only tower community. `CARD_SIGNALS`
maps each card to attributes, so adding a card means adding one line there.

**Keep the prices roughly current.** They drive the shortlist and the
budget-versus-taste flag. Stale prices make both lie. Same for `drive`: those are
off-peak estimates, not Google's.

## The cards

`lib/qualify.js` is the whole questionnaire, the rounds, and the scoring. A card
looks like this:

```js
'd1-beach': {
  t: 'Beachfront villa',
  c: 'Sand at the end of the garden, sea out every window',
  f: ['Location', 'beachfront villa'],   // the answer the agent reads
  b: { prime: 2, villa: 1 },             // which corner liking it points to
  from: 15000000,                        // realistic entry price, in AED
  g: ['beachfront', 'prime', 'villa'],
}
```

`from` is what powers the budget-versus-taste flag, so keep it roughly honest for
your patch of the market. `ROUND2` and `ROUND3` map each corner to the cards worth
asking about next: that is where you change how the funnel narrows.

**Using real photography.** The illustrations are drawn by
`scripts/generate-images.js` so the site needs no image hosting and no licensing
questions. To use photos of your own stock instead, drop them in `public/img`
with the same file names, crop to 4:3 and keep the subject centred.

## Data and privacy

Leads live in one JSON file, written atomically. Each client session is protected
by a per-lead token so one buyer cannot read or overwrite another's answers, and
the dashboard sits behind a passcode with rate-limited logins and an HttpOnly
cookie.

If you put this on the public internet, put it behind HTTPS (the cookie upgrades
itself to `Secure` when it sees `X-Forwarded-Proto`) and set a long
`AGENT_PASSCODE`. You are storing names, phone numbers and email addresses, so
keep retention short and tell buyers who you are.

## Development

```bash
npm start      # run it
npm run dev    # run it with auto restart
npm test       # 48 unit and HTTP tests, no network needed
npm run images # redraw the card illustrations
npm run sync   # copy lib/qualify.js into public/ for flat-file hosting
```

```
server.js                   routing, static files, agent auth, rate limits
lib/qualify.js              the deck, the rounds, the questions, the hotness model
lib/communities.js          the 28 communities, the matcher, the tie-break bank
lib/scoring.js              shapes a lead for the dashboard
lib/store.js                JSON persistence
public/shortlist.html       the client funnel, standalone capable
public/agent.*              the lead desk
scripts/generate-images.js  draws public/img/*.svg
test/                       node:test suites
```

`lib/qualify.js` and `lib/communities.js` are deliberately universal modules: the
server requires them and the browser loads the same files, so a buyer and their
agent always see the same shortlist and the same score. The copies in `public/`
are generated by `npm run sync` and kept honest by a test.
