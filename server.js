'use strict';

/**
 * SwipeHouse: a qualification funnel an agent can send as a link.
 *
 * No framework, no database, no build step. `node server.js` and it runs.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { LeadStore } = require('./lib/store');
const scoring = require('./lib/scoring');
const {
  buildDeck,
  CARDS_BY_ID,
  PROPERTY_TYPES,
  BUDGET_BANDS,
  TIMELINES,
} = require('./lib/deck');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'leads.json');
const DECK_LIMIT = Number(process.env.DECK_LIMIT) || 20;
const MAX_BODY_BYTES = 64 * 1024;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const BRANDING = {
  agentName: process.env.AGENT_NAME || 'your agent',
  agencyName: process.env.AGENCY_NAME || 'SwipeHouse',
  currency: process.env.CURRENCY_SYMBOL || '$',
};

const store = new LeadStore(DATA_FILE);

/* ------------------------------------------------------------ agent auth */

const AGENT_PASSCODE = process.env.AGENT_PASSCODE || crypto.randomBytes(4).toString('hex');
const PASSCODE_WAS_GENERATED = !process.env.AGENT_PASSCODE;
const sessions = new Map(); // token -> expiry timestamp

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the length does not leak through timing.
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

const hits = new Map(); // key -> { count, resetAt }

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

function oneOf(value, allowed) {
  return allowed.includes(value) ? value : '';
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

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    return fail(res, 403, 'Forbidden');
  }
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

/* ------------------------------------------------------------- routing */

async function handle(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  // ---- public config -----------------------------------------------
  if (method === 'GET' && pathname === '/api/config') {
    return send(res, 200, {
      branding: BRANDING,
      propertyTypes: PROPERTY_TYPES,
      budgetBands: BUDGET_BANDS,
      timelines: TIMELINES,
    });
  }

  // ---- deck ---------------------------------------------------------
  if (method === 'GET' && pathname === '/api/deck') {
    const type = oneOf(url.searchParams.get('type'), PROPERTY_TYPES.map((t) => t.id)) || 'unsure';
    return send(res, 200, { cards: buildDeck(type, DECK_LIMIT) });
  }

  // ---- create a lead --------------------------------------------------
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

    const brief = {
      propertyType: oneOf(str(body.propertyType, 30), PROPERTY_TYPES.map((t) => t.id)) || 'unsure',
      location: str(body.location, 120),
      budget: oneOf(str(body.budget, 10), BUDGET_BANDS.map((b) => b.id)),
      timeline: oneOf(str(body.timeline, 20), TIMELINES.map((t) => t.id)),
    };

    const deck = buildDeck(brief.propertyType, DECK_LIMIT);
    const lead = store.create({ contact, brief, deckSize: deck.length });
    return send(res, 201, { id: lead.id, token: lead.token, cards: deck });
  }

  // ---- lead scoped routes ---------------------------------------------
  const leadMatch = pathname.match(/^\/api\/leads\/(ld_[a-f0-9]{16})(?:\/(swipes|finish|profile))?$/);
  if (leadMatch) {
    const lead = store.get(leadMatch[1]);
    const action = leadMatch[2];
    if (!lead) return fail(res, 404, 'We lost that session. Start again and nothing else breaks.');

    if (method === 'GET' && action === 'profile') {
      if (!timingSafeEqual(url.searchParams.get('token') || '', lead.token)) {
        return fail(res, 403, 'Not your session.');
      }
      return send(res, 200, scoring.clientProfile(lead, { currency: BRANDING.currency }));
    }

    if (method === 'POST' && (action === 'swipes' || action === 'finish')) {
      const body = await readBody(req);
      if (!timingSafeEqual(body.token || '', lead.token)) return fail(res, 403, 'Not your session.');

      if (action === 'swipes') {
        const swipes = Array.isArray(body.swipes) ? body.swipes.slice(0, 200) : [];
        const clean = [];
        const seen = new Set();
        for (const swipe of swipes) {
          const cardId = str(swipe && swipe.cardId, 40);
          if (!CARDS_BY_ID.has(cardId) || seen.has(cardId)) continue;
          seen.add(cardId);
          clean.push({
            cardId,
            direction: swipe.direction === 'right' ? 'right' : 'left',
            ms: Math.max(0, Math.min(Number(swipe.ms) || 0, 10 * 60 * 1000)),
            at: new Date().toISOString(),
          });
        }
        store.update(lead.id, (l) => {
          l.swipes = clean;
          l.stage = clean.length >= l.deckSize && l.deckSize > 0 ? 'done' : 'swiping';
        });
        return send(res, 200, { ok: true, counted: clean.length });
      }

      // finish
      const note = str(body.note, 500);
      const phone = str(body.phone, 40);
      store.update(lead.id, (l) => {
        if (note) l.note = note;
        if (phone) l.contact.phone = phone;
        l.stage = 'done';
        l.completedAt = l.completedAt || new Date().toISOString();
      });
      return send(res, 200, scoring.clientProfile(store.get(lead.id), { currency: BRANDING.currency }));
    }

    return fail(res, 405, 'Method not allowed');
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
        .map((lead) => scoring.summarise(lead, { currency: BRANDING.currency }))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return send(res, 200, { leads, branding: BRANDING });
    }

    if (method === 'GET' && pathname === '/api/agent/leads.csv') {
      const rows = [
        ['name', 'email', 'phone', 'status', 'score', 'temperature', 'type', 'location', 'budget', 'timeline', 'likes', 'seen', 'of', 'created', 'wants'],
      ];
      for (const lead of store.all()) {
        const s = scoring.summarise(lead, { currency: BRANDING.currency });
        rows.push([
          s.contact.name,
          s.contact.email,
          s.contact.phone || '',
          s.status,
          s.score.value,
          s.score.label,
          s.brief.propertyType || '',
          s.brief.location || '',
          s.brief.budgetLabel,
          s.brief.timelineLabel || '',
          s.likes.length,
          s.progress.done,
          s.progress.of,
          s.createdAt,
          s.wants.slice(0, 5).map((w) => w.tag).join(' | '),
        ]);
      }
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      return send(res, 200, csv, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="swipehouse-leads.csv"',
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
      return send(res, 200, scoring.summarise(store.get(lead.id), { currency: BRANDING.currency }));
    }

    return fail(res, 404, 'Unknown endpoint');
  }

  // ---- pages -------------------------------------------------------------
  if (method === 'GET' && (pathname === '/agent' || pathname === '/agent/')) {
    return serveStatic(req, res, '/agent.html');
  }

  if (method === 'GET' || method === 'HEAD') {
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
    console.log(`\n  SwipeHouse is up`);
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
