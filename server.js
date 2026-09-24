'use strict';

/**
 * Swipe to Shortlist: a Dubai buyer-qualification funnel an agent sends as a link.
 *
 * No framework, no database, no build step. `node server.js` and it runs.
 * The client page (public/shortlist.html) also runs standalone with no server,
 * so the same file can be hosted as a flat static page; when a server is behind
 * it, every swipe is saved as it happens and lands on the agent's desk.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { LeadStore } = require('./lib/store');
const scoring = require('./lib/scoring');
const Q = require('./lib/qualify');
const C = require('./lib/communities');
const F = require('./lib/funnel');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'leads.json');
const MAX_BODY_BYTES = 64 * 1024;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const BRANDING = {
  agentName: process.env.AGENT_NAME || 'your agent',
  agencyName: process.env.AGENCY_NAME || 'Swipe to Shortlist',
  currency: Q.CURRENCY,
};

const store = new LeadStore(DATA_FILE);

/* ------------------------------------------------------------ agent auth */

const AGENT_PASSCODE = process.env.AGENT_PASSCODE || crypto.randomBytes(4).toString('hex');
const PASSCODE_WAS_GENERATED = !process.env.AGENT_PASSCODE;
const sessions = new Map();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function sessionValid(token) {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > 0) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    return acc;
  }, {});
}

function isAgent(req) {
  return sessionValid(parseCookies(req).agent_session);
}

/* -------------------------------------------------------- rate limiting */

const hits = new Map();

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
  for (const [token, expiry] of sessions) if (expiry < now) sessions.delete(token);
}, 60 * 1000).unref();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

/* ------------------------------------------------------------- helpers */

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function fail(res, status, message) {
  send(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function str(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/** Keep only answers the deck actually offers, so the score cannot be gamed. */
function cleanAnswers(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const group of Object.keys(Q.QUESTIONS)) {
    const value = str(input[group], 30);
    if (value && Q.option(group, value)) out[group] = value;
  }
  return out;
}

function cleanSwipes(input) {
  const list = Array.isArray(input) ? input.slice(0, F.MAX_CARDS * 2) : [];
  const seen = new Set();
  const out = [];
  for (const swipe of list) {
    const id = str(swipe && swipe.id, 40);
    if (!F.BY_ID[id] || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, dir: swipe.dir === 'y' ? 'y' : 'n' });
  }
  return out;
}

/** Only tie-breaks the bank actually offers, and only options it defines. */
function cleanTiebreaks(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const tb of C.TIEBREAKERS) {
    const choice = str(input[tb.id], 30);
    if (choice && tb.options.some((o) => o.id === choice)) out[tb.id] = choice;
  }
  return out;
}

/* ------------------------------------------------------- static serving */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serveFile(req, res, target) {
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) return fail(res, 404, 'Not found');
    const ext = path.extname(target).toLowerCase();
    const isAsset = ext !== '.html';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': isAsset ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  });
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'shortlist.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    return fail(res, 403, 'Forbidden');
  }
  serveFile(req, res, target);
}

/* ------------------------------------------------------------- routing */

async function handle(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === 'GET' && pathname === '/api/config') {
    return send(res, 200, {
      branding: BRANDING,
      questions: Q.QUESTIONS,
      communities: C.COMMUNITIES.length,
      maxCards: F.MAX_CARDS,
    });
  }

  // ---- a client starts ------------------------------------------------
  if (method === 'POST' && pathname === '/api/leads') {
    if (!rateLimit(`lead:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
      return fail(res, 429, 'Too many submissions from this address. Try again later.');
    }
    const body = await readBody(req);
    const contact = {
      name: str(body.name, 80),
      email: str(body.email, 120),
      phone: str(body.phone, 40),
    };
    if (!contact.name) return fail(res, 400, 'Tell us your name.');
    if (!scoring.validEmail(contact.email)) return fail(res, 400, 'That email does not look right.');

    const lead = store.create({ contact, swipes: [], answers: {} });
    return send(res, 201, { id: lead.id, token: lead.token });
  }

  // ---- that client's own session --------------------------------------
  const leadMatch = pathname.match(/^\/api\/leads\/(ld_[a-f0-9]{16})\/(progress|finish)$/);
  if (leadMatch) {
    if (method !== 'POST') return fail(res, 405, 'Method not allowed');
    const lead = store.get(leadMatch[1]);
    if (!lead) return fail(res, 404, 'We lost that session. Start again and nothing else breaks.');
    const body = await readBody(req);
    if (!timingSafeEqual(body.token || '', lead.token)) return fail(res, 403, 'Not your session.');

    const swipes = cleanSwipes(body.swipes);
    const answers = cleanAnswers(body.answers);
    const tiebreaks = cleanTiebreaks(body.tiebreaks);
    const note = str(body.note, 500);
    const phone = str(body.phone, 40);

    store.update(lead.id, (l) => {
      if (swipes.length >= (l.swipes || []).length) l.swipes = swipes;
      l.answers = { ...(l.answers || {}), ...answers };
      l.tiebreaks = { ...(l.tiebreaks || {}), ...tiebreaks };
      if (note) l.note = note;
      if (phone) l.contact.phone = phone;
      if (leadMatch[2] === 'finish') l.completedAt = l.completedAt || new Date().toISOString();
    });

    const updated = store.get(lead.id);
    if (leadMatch[2] === 'finish') {
      const summary = scoring.summarise(updated);
      // The client sees its own read-out, never the agent's notes.
      return send(res, 200, {
        hotness: summary.hotness,
        facets: summary.facets,
        progress: summary.progress,
        areas: summary.areas,
      });
    }
    return send(res, 200, { ok: true, counted: updated.swipes.length });
  }

  // ---- agent session ----------------------------------------------------
  if (method === 'POST' && pathname === '/api/agent/session') {
    if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
      return fail(res, 429, 'Too many attempts. Wait fifteen minutes.');
    }
    const body = await readBody(req);
    if (!timingSafeEqual(str(body.passcode, 200), AGENT_PASSCODE)) {
      return fail(res, 401, 'Wrong passcode.');
    }
    const token = createSession();
    const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? ' Secure;' : '';
    return send(res, 200, { ok: true }, {
      'Set-Cookie': `agent_session=${token}; HttpOnly; Path=/; SameSite=Lax;${secure} Max-Age=${SESSION_TTL_MS / 1000}`,
    });
  }

  if (method === 'DELETE' && pathname === '/api/agent/session') {
    const token = parseCookies(req).agent_session;
    if (token) sessions.delete(token);
    return send(res, 200, { ok: true }, {
      'Set-Cookie': 'agent_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
    });
  }

  if (pathname.startsWith('/api/agent/')) {
    if (!isAgent(req)) return fail(res, 401, 'Sign in first.');

    if (method === 'GET' && pathname === '/api/agent/leads') {
      const leads = store
        .all()
        .map((lead) => scoring.summarise(lead))
        .sort((a, b) => b.hotness.value - a.hotness.value || new Date(b.updatedAt) - new Date(a.updatedAt));
      return send(res, 200, { leads, branding: BRANDING });
    }

    if (method === 'GET' && pathname === '/api/agent/leads.csv') {
      const rows = [[
        'name', 'email', 'phone', 'areas', 'status', 'hotness', 'temperature',
        'budget', 'funds', 'timing', 'viewing', 'purpose', 'commute', 'looking for',
        'cards', 'narrowed to', 'flags', 'created',
      ]];
      for (const lead of store.all()) {
        const s = scoring.summarise(lead);
        rows.push([
          s.contact.name, s.contact.email, s.contact.phone || '',
          s.areas.top.map((a) => a.name).join(' | '),
          s.status, s.hotness.value, s.hotness.label,
          s.answers.budget, s.answers.payment, s.answers.timeline, s.answers.viewing,
          s.answers.purpose, s.answers.commute,
          s.kindLabel, s.progress.done,
          s.narrowing.to + ' of ' + s.narrowing.from,
          s.hotness.flags.map((f) => f.text).join(' | '),
          s.createdAt,
        ]);
      }
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return send(res, 200, csv, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dubai-leads.csv"',
      });
    }

    const agentLead = pathname.match(/^\/api\/agent\/leads\/(ld_[a-f0-9]{16})$/);
    if (agentLead && (method === 'POST' || method === 'DELETE')) {
      const lead = store.get(agentLead[1]);
      if (!lead) return fail(res, 404, 'No such lead.');
      if (method === 'DELETE') {
        store.remove(lead.id);
        return send(res, 200, { ok: true });
      }
      const body = await readBody(req);
      store.update(lead.id, (l) => {
        if (typeof body.agentNotes === 'string') l.agentNotes = str(body.agentNotes, 2000);
        if (typeof body.archived === 'boolean') l.archived = body.archived;
      });
      return send(res, 200, scoring.summarise(store.get(lead.id)));
    }

    return fail(res, 404, 'Unknown endpoint');
  }

  // ---- pages -------------------------------------------------------------
  if (method === 'GET' || method === 'HEAD') {
    if (pathname === '/agent' || pathname === '/agent/') return serveStatic(req, res, '/agent.html');
    // One copy of the engine, served straight from lib so it cannot drift.
    if (pathname === '/qualify.js') return serveFile(req, res, path.join(__dirname, 'lib', 'qualify.js'));
    if (pathname === '/communities.js') return serveFile(req, res, path.join(__dirname, 'lib', 'communities.js'));
    if (pathname === '/funnel.js') return serveFile(req, res, path.join(__dirname, 'lib', 'funnel.js'));
    return serveStatic(req, res, pathname);
  }

  return fail(res, 404, 'Not found');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  handle(req, res, url).catch((err) => {
    const status = err.status || 500;
    if (status >= 500) console.error(`[server] ${req.method} ${url.pathname}:`, err);
    if (!res.headersSent) fail(res, status, status >= 500 ? 'Something broke on our side.' : err.message);
  });
});

function shutdown() {
  store.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('\n  Swipe to Shortlist is up');
    console.log(`  Client link:      http://localhost:${PORT}/`);
    console.log(`  Agent dashboard:  http://localhost:${PORT}/agent`);
    if (PASSCODE_WAS_GENERATED) {
      console.log(`  Dashboard passcode (this run only): ${AGENT_PASSCODE}`);
      console.log('  Set AGENT_PASSCODE in the environment to keep one passcode across restarts.\n');
    } else {
      console.log('  Dashboard passcode: from AGENT_PASSCODE\n');
    }
  });
}

module.exports = { server, store, handle };
