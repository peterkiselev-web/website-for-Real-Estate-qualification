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

## Putting it online

The buyer-facing page is deliberately self-contained: it runs with no server
behind it, so it can be hosted anywhere that serves flat files.

**GitHub Pages, free, no account needed anywhere else.** The `docs` folder in
this repo is a complete, ready-to-serve copy of the site. In the repository go to
**Settings**, then **Pages** in the left sidebar, then under **Source** choose
**Deploy from a branch**, pick branch **main** and folder **/docs**, and press
**Save**. A minute later the site is live at

```
https://<your-username>.github.io/<repository-name>/
```

Add your name and email to the end of the link so briefs reach you:

```
https://<your-username>.github.io/<repository-name>/#a=Your%20Name&e=you@agency.ae
```

What you get: the whole funnel, the area shortlist, on any phone. What you do not
get: the agent dashboard and saved leads, because those need a server. On Pages a
buyer's brief reaches you when they press send at the end, and anyone who quits
halfway is invisible to you.

**For the dashboard and the drop-outs**, run `npm start` on a host that can run
Node. The same client page then saves every swipe as it happens.

Rebuild the static copy after changing the client page:

```bash
npm run pages
```

## How the funnel narrows

There is no fixed deck. Every card knows which communities survive a yes and
which survive a no, so an answer removes areas from the running and removes
every question that only mattered to those areas. The engine then asks for the
next question worth asking: the broadest one still open, and among those the one
that splits what is left most evenly.

**Stage 1, what kind of home.** Villa, apartment or townhouse. One answer and
half the map is gone. Say no to a villa and you are never asked about a majlis,
a staff room, a garage, a private pool or a golf course, because none of them
can apply to you any more.

**Stage 2, where.** Only the settings still possible for that kind. A villa
buyer gets golf, beachfront, lagoon, family community. An apartment buyer gets
waterfront, and then either "steps from the sand" or "in the middle of the
city", never both. Yes to golf leaves six communities and the next questions are
about which of those six.

**Stage 3, which community.** Whatever still separates the survivors: the
biggest plots, established streets versus brand new, walk to the metro, gates,
sea view, rental demand. A question nobody left in the running can satisfy is
never asked.

**Stage 4, the details.** Pools, majlis, staff room, office, garage. Only when
they still tell the shortlist apart.

The page shows the count falling as it happens: 28 areas, then 13, then 5, then
2, with a screen between stages naming what just went out. It stops when four or
fewer areas are left, or when no question can separate them, usually after six
to eleven cards.

**Then six taps** for purpose, budget, commute, funds, timing and viewing, and
**one or two tie-breaks** chosen live from wherever the leaders still disagree.
Beach or golf, sea view or skyline, metro or space. A tie-break outranks the
swipes that led to it, so picking greens pushes the beach down rather than only
lifting golf.

**Then the answer:** the communities that survived, ranked, with the reasons from
their own swipes, the entry price for the kind of home they want, the drive to
where they work and the catch. If the funnel narrowed to one or two, the closest
areas it ruled out are shown underneath for comparison, and anything they liked
but cannot afford is named.

A hard filter that would leave fewer than two communities is applied softly
instead, so no combination of answers can ever narrow the map to nothing.

## How the temperature is worked out

| Band | Out of | What moves it |
| --- | --- | --- |
| Funds | 30 | Cash in the UAE 30, pre-approved mortgage 27, cash transferring in 23, mortgage not started 12, needs to sell first 7, no idea 3 |
| Timing | 20 | Buying now 20, within a month 16, one to three months 12, three to six 6, watching 2 |
| Viewing | 15 | In Dubai this week 15, in a few weeks 11, flying in 10, remote only 6 |
| Clarity | 20 | How far the funnel actually narrowed, a real mix of yes and no, and no contradictions |
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
  dropped out. Drop-outs show the card they quit on and how far the funnel had
  narrowed by then, which is useful even when they never came back.
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
npm test       # 47 unit and HTTP tests, no network needed
npm run images # redraw the card illustrations
npm run sync   # copy lib/qualify.js into public/ for flat-file hosting
```

```
server.js                   routing, static files, agent auth, rate limits
lib/funnel.js               the cards, the narrowing engine, the hotness model
lib/communities.js          the 28 communities, the matcher, the tie-break bank
lib/qualify.js              the tap questions and the money vocabulary
lib/scoring.js              shapes a lead for the dashboard
lib/store.js                JSON persistence
public/shortlist.html       the client funnel, standalone capable
public/agent.*              the lead desk
scripts/generate-images.js  draws public/img/*.svg
test/                       node:test suites
```

The three engine files are deliberately universal modules: the server requires
them and the browser loads the same files, so a buyer and their agent always see
the same shortlist and the same score. Everything is replayed from the swipe
history, so nothing about the funnel is stored twice and the two sides cannot
drift. The copies in `public/` are generated by `npm run sync` and kept honest by
a test.

### Editing the tree

A card in `lib/funnel.js` looks like this:

```js
{
  id: 'l-golf', stage: 2, img: 'd1-golf',
  t: 'On a golf course',
  c: 'Greens out of the window, buggy in the garage',
  facet: ['Setting', 'golf community'],
  when: (s) => s.wantsHouse(),                        // when this question applies
  yes: { keep: (c) => (c.attrs.golf || 0) >= 2, hard: true, sig: { golf: 3, quiet: 2 } },
  no:  { keep: () => true, hard: false, sig: { golf: -2 } },
}
```

`hard: true` eliminates everything the `keep` test rejects. `when` is what makes
it a funnel: a question that no longer applies is never dealt. Add a card and the
engine will start using it wherever it discriminates; no ordering to maintain.
