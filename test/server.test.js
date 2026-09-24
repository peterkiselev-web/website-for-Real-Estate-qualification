'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA_FILE = path.join(os.tmpdir(), `shortlist-test-${process.pid}.json`);
process.env.DATA_FILE = DATA_FILE;
process.env.AGENT_PASSCODE = 'open-sesame';

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

const post = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function startLead(overrides = {}) {
  const res = await post(`${base}/api/leads`, {
    name: 'Alex Morgan',
    email: 'alex@example.com',
    phone: '+971501234567',
    ...overrides,
  });
  return { res, body: await res.json() };
}

test('the config endpoint hands over the readiness questions', async () => {
  const res = await fetch(`${base}/api/config`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.branding.currency, 'AED');
  assert.ok(body.questions.payment.options.length >= 5);
  assert.ok(body.communities >= 20);
  assert.ok(body.maxCards >= 8);
});

test('a bad email never becomes a lead', async () => {
  const before = store.all().length;
  const { res, body } = await startLead({ email: 'nope' });
  assert.equal(res.status, 400);
  assert.match(body.error, /email/i);
  assert.equal(store.all().length, before);
});

test('starting gives back an id and a private token', async () => {
  const { res, body } = await startLead();
  assert.equal(res.status, 201);
  assert.match(body.id, /^ld_[a-f0-9]{16}$/);
  assert.equal(body.token.length, 32);
});

test('progress is saved as they swipe, and junk is dropped', async () => {
  const { body: lead } = await startLead();
  const res = await post(`${base}/api/leads/${lead.id}/progress`, {
    token: lead.token,
    swipes: [
      { id: 'k-villa', dir: 'y' },
      { id: 'k-villa', dir: 'n' },
      { id: 'not-a-card', dir: 'y' },
      { id: 'l-golf', dir: 'sideways' },
    ],
    answers: { payment: 'cash_uae', budget: 'nonsense' },
    tiebreaks: { 'tb-beach-golf': 'golf', 'tb-made-up': 'x' },
  });
  assert.equal(res.status, 200);

  const stored = store.get(lead.id);
  assert.equal(stored.swipes.length, 2);
  assert.equal(stored.swipes[0].dir, 'y');
  assert.equal(stored.swipes[1].dir, 'n', 'an unknown direction falls back to a pass');
  assert.equal(stored.answers.payment, 'cash_uae');
  assert.ok(!('budget' in stored.answers), 'an answer that is not on the list is ignored');
  assert.equal(stored.tiebreaks['tb-beach-golf'], 'golf');
  assert.ok(!('tb-made-up' in stored.tiebreaks), 'an invented tie-break is ignored');
});

test('a stale beacon cannot shrink a session that moved on', async () => {
  const { body: lead } = await startLead();
  await post(`${base}/api/leads/${lead.id}/progress`, {
    token: lead.token,
    swipes: [
      { id: 'k-villa', dir: 'y' },
      { id: 'l-golf', dir: 'y' },
      { id: 'g-established', dir: 'n' },
    ],
  });
  await post(`${base}/api/leads/${lead.id}/progress`, {
    token: lead.token,
    swipes: [{ id: 'k-villa', dir: 'y' }],
  });
  assert.equal(store.get(lead.id).swipes.length, 3);
});

test('another visitor cannot write to someone else\'s session', async () => {
  const { body: lead } = await startLead();
  const res = await post(`${base}/api/leads/${lead.id}/progress`, { token: 'wrong', swipes: [] });
  assert.equal(res.status, 403);
});

test('finishing returns the client their own read-out and nothing of the agent\'s', async () => {
  const { body: lead } = await startLead();
  const res = await post(`${base}/api/leads/${lead.id}/finish`, {
    token: lead.token,
    swipes: [{ id: 'k-villa', dir: 'y' }, { id: 'l-beachvilla', dir: 'y' }],
    answers: { purpose: 'live', budget: 'b6', payment: 'cash_uae', timeline: 'now', viewing: 'here_now' },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.hotness.value > 60);
  assert.ok(body.areas.top.length, 'the client gets its shortlist back');
  assert.ok(!('agentNotes' in body));
  assert.ok(!('briefText' in body));
  assert.ok(store.get(lead.id).completedAt);
});

test('the dashboard is closed without the passcode', async () => {
  const res = await fetch(`${base}/api/agent/leads`);
  assert.equal(res.status, 401);
});

test('a wrong passcode opens nothing', async () => {
  const res = await post(`${base}/api/agent/session`, { passcode: 'guess' });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('the desk lists leads hottest first, with the scoring shown', async () => {
  const login = await post(`${base}/api/agent/session`, { passcode: 'open-sesame' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const res = await fetch(`${base}/api/agent/leads`, { headers: { cookie } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.leads.length >= 4);
  for (let i = 1; i < body.leads.length; i += 1) {
    assert.ok(body.leads[i - 1].hotness.value >= body.leads[i].hotness.value, 'sorted by hotness');
  }
  const top = body.leads[0];
  assert.ok(top.hotness.parts.length === 6);
  assert.ok(top.briefText.length > 10);
  assert.ok(top.narrowing.from >= 20);
  assert.ok(!('token' in top), 'client tokens stay private');

  const csv = await fetch(`${base}/api/agent/leads.csv`, { headers: { cookie } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const text = await csv.text();
  assert.match(text, /alex@example.com/);
  assert.match(text, /hotness/);
});

test('the client page and the shared engine are both served', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  assert.match(html, /Which area suits you/);

  for (const [path, marker] of [['/qualify.js', /Qualify/], ['/communities.js', /Communities/], ['/funnel.js', /Funnel/]]) {
    const engine = await fetch(`${base}${path}`);
    assert.equal(engine.status, 200, `${path} should be served`);
    assert.match(engine.headers.get('content-type'), /javascript/);
    assert.match(await engine.text(), marker);
  }

  const image = await fetch(`${base}/img/k-townhouse.svg`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /svg/);
});

test('the public directory is not escapable', async () => {
  for (const url of [`${base}/../server.js`, `${base}/%2e%2e/server.js`, `${base}/../lib/store.js`]) {
    const res = await fetch(url, { redirect: 'manual' });
    assert.ok(res.status === 403 || res.status === 404, `${url} should be refused, got ${res.status}`);
  }
});

test('an unknown lead id does not leak a 500', async () => {
  const res = await post(`${base}/api/leads/ld_ffffffffffffffff/finish`, { token: 'x' });
  assert.equal(res.status, 404);
});

test('oversized bodies are refused', async () => {
  const res = await post(`${base}/api/leads`, { name: 'x'.repeat(200000), email: 'a@b.co' })
    .catch(() => ({ status: 413 }));
  assert.ok(res.status === 413 || res.status === 400);
});
