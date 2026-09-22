'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA_FILE = path.join(os.tmpdir(), `swipehouse-test-${process.pid}.json`);
process.env.DATA_FILE = DATA_FILE;
process.env.AGENT_PASSCODE = 'open-sesame';
process.env.CURRENCY_SYMBOL = '£';

const { server, store } = require('../server');

let base;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  try { fs.unlinkSync(DATA_FILE); } catch (_) { /* never created */ }
});

async function createLead(overrides = {}) {
  const res = await fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      propertyType: 'house',
      location: 'Shoreditch',
      budget: 'b4',
      timeline: 'now',
      ...overrides,
    }),
  });
  return { res, body: await res.json() };
}

test('the config endpoint feeds the form', async () => {
  const res = await fetch(`${base}/api/config`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.branding.currency, '£');
  assert.ok(body.propertyTypes.length);
  assert.ok(body.budgetBands.length);
});

test('a bad email is rejected before a lead is stored', async () => {
  const before = store.all().length;
  const { res, body } = await createLead({ email: 'not-an-email' });
  assert.equal(res.status, 400);
  assert.match(body.error, /email/i);
  assert.equal(store.all().length, before);
});

test('a missing name is rejected', async () => {
  const { res } = await createLead({ name: '  ' });
  assert.equal(res.status, 400);
});

test('creating a lead returns a deck and a private token', async () => {
  const { res, body } = await createLead();
  assert.equal(res.status, 201);
  assert.match(body.id, /^ld_[a-f0-9]{16}$/);
  assert.equal(body.token.length, 32);
  assert.ok(body.cards.length > 5);
  assert.ok(!('facet' in body.cards[0]), 'scoring internals stay on the server');
});

test('swipes are stored, deduped and filtered to real cards', async () => {
  const { body: lead } = await createLead();
  const res = await fetch(`${base}/api/leads/${lead.id}/swipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: lead.token,
      swipes: [
        { cardId: 'style-modern', direction: 'right', ms: 800 },
        { cardId: 'style-modern', direction: 'left', ms: 300 },
        { cardId: 'not-a-real-card', direction: 'right' },
        { cardId: 'pool-private', direction: 'sideways' },
      ],
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.counted, 2);

  const stored = store.get(lead.id);
  assert.equal(stored.swipes.length, 2);
  assert.equal(stored.swipes[0].direction, 'right');
  assert.equal(stored.swipes[1].direction, 'left', 'an unknown direction falls back to a pass');
});

test('another visitor cannot write to someone else\'s session', async () => {
  const { body: lead } = await createLead();
  const res = await fetch(`${base}/api/leads/${lead.id}/swipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'wrong-token', swipes: [] }),
  });
  assert.equal(res.status, 403);
});

test('finishing marks the lead complete and returns the profile', async () => {
  const { body: lead } = await createLead();
  await fetch(`${base}/api/leads/${lead.id}/swipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: lead.token,
      swipes: [{ cardId: 'pool-private', direction: 'right', ms: 500 }],
    }),
  });
  const res = await fetch(`${base}/api/leads/${lead.id}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: lead.token, phone: '+44 7700 900000', note: 'Near a school' }),
  });
  const profile = await res.json();
  assert.equal(res.status, 200);
  assert.ok(profile.score.value > 0);
  assert.ok(profile.likes.some((l) => l.id === 'pool-private'));

  const stored = store.get(lead.id);
  assert.ok(stored.completedAt);
  assert.equal(stored.contact.phone, '+44 7700 900000');
  assert.equal(stored.note, 'Near a school');
});

test('the dashboard is closed without the passcode', async () => {
  const res = await fetch(`${base}/api/agent/leads`);
  assert.equal(res.status, 401);
});

test('a wrong passcode does not open a session', async () => {
  const res = await fetch(`${base}/api/agent/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'guess' }),
  });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('the passcode opens the dashboard and the leads come back scored', async () => {
  const login = await fetch(`${base}/api/agent/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'open-sesame' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);

  const res = await fetch(`${base}/api/agent/leads`, { headers: { cookie } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.leads.length >= 3);
  assert.ok(body.leads[0].summaryText.length > 10);
  assert.ok(!('token' in body.leads[0]), 'client tokens stay private');

  const csv = await fetch(`${base}/api/agent/leads.csv`, { headers: { cookie } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const text = await csv.text();
  assert.match(text, /alex@example.com/);
});

test('static files are served and the public directory is not escapable', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);

  const image = await fetch(`${base}/img/pool-private.svg`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /svg/);

  const escape = await fetch(`${base}/../server.js`, { redirect: 'manual' });
  assert.ok(escape.status === 403 || escape.status === 404, `expected a refusal, got ${escape.status}`);

  const dotdot = await fetch(`${base}/%2e%2e/server.js`, { redirect: 'manual' });
  assert.ok(dotdot.status === 403 || dotdot.status === 404);
});

test('oversized bodies are refused', async () => {
  const res = await fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x'.repeat(200000), email: 'a@b.co' }),
  }).catch(() => ({ status: 413 }));
  assert.ok(res.status === 413 || res.status === 400);
});

test('an unknown lead id does not leak a 500', async () => {
  const res = await fetch(`${base}/api/leads/ld_ffffffffffffffff/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'x' }),
  });
  assert.equal(res.status, 404);
});
