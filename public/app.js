/* SwipeHouse client. Vanilla JS, no build step. */
(() => {
  'use strict';

  const SESSION_KEY = 'swipehouse.session';
  const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const state = {
    config: null,
    lead: null,          // { id, token }
    cards: [],
    index: 0,
    swipes: [],          // { cardId, direction, ms }
    cardShownAt: 0,
    locked: false,
    syncTimer: null,
    finished: false,
  };

  const nodes = {};
  const cardEls = new Map();

  /* ------------------------------------------------------------ screens */

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------- config */

  async function loadConfig() {
    const res = await fetch('/api/config');
    state.config = await res.json();
    const { agentName, agencyName } = state.config.branding;
    $('#brand-agency').textContent = agencyName;
    document.querySelectorAll('#brand-agent, #brand-agent-2, #brand-agent-3').forEach((n, i) => {
      n.textContent = i === 2 ? capitalise(agentName) : agentName;
    });
    buildChips('#f-type', state.config.propertyTypes.map((t) => ({ value: t.id, label: `${t.emoji} ${t.label}` })));
    buildChips('#f-budget', state.config.budgetBands.map((b) => ({ value: b.id, label: withCurrency(b.label) })));
    buildChips('#f-timeline', state.config.timelines.map((t) => ({ value: t.id, label: t.label })));
  }

  function withCurrency(label) {
    const symbol = state.config.branding.currency;
    return label.replace(/(\d+(?:\.\d+)?(?:k|M)?)/g, (m) => `${symbol}${m}`);
  }

  function capitalise(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function buildChips(selector, items) {
    const wrap = $(selector);
    wrap.innerHTML = '';
    items.forEach((item) => {
      const chip = el('button', 'chip', item.label);
      chip.type = 'button';
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', 'false');
      chip.dataset.value = item.value;
      chip.addEventListener('click', () => {
        wrap.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
        chip.setAttribute('aria-checked', 'true');
      });
      wrap.appendChild(chip);
    });
  }

  function chipValue(selector) {
    const picked = $(selector).querySelector('.chip[aria-checked="true"]');
    return picked ? picked.dataset.value : '';
  }

  /* -------------------------------------------------------------- brief */

  function gotoStep(step) {
    document.querySelectorAll('.brief-step').forEach((s) => {
      s.classList.toggle('is-active', Number(s.dataset.step) === step);
    });
    document.querySelectorAll('#brief-steps .step').forEach((dot, i) => {
      dot.classList.toggle('is-on', i < step);
    });
    const first = document.querySelector(`.brief-step[data-step="${step}"] input`);
    if (first && window.matchMedia('(min-width: 720px)').matches) first.focus();
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }

  function wireBrief() {
    document.querySelectorAll('[data-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.next);
        if (!validateStep(step)) return;
        gotoStep(step + 1);
      });
    });
    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => gotoStep(Number(btn.dataset.back) - 1));
    });

    $('#f-email').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (validateStep(1)) gotoStep(2); }
    });
    $('#f-location').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (validateStep(2)) gotoStep(3); }
    });

    $('#brief-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(3)) return;
      const btn = $('#btn-deck');
      btn.disabled = true;
      btn.textContent = 'Shuffling the deck...';
      try {
        await createLead();
      } catch (err) {
        $('#err-3').textContent = err.message || 'Something went wrong. Try again.';
        btn.disabled = false;
        btn.textContent = 'Deal me in';
      }
    });
  }

  function validateStep(step) {
    if (step === 1) {
      const name = $('#f-name').value.trim();
      const email = $('#f-email').value.trim();
      if (name.length < 2) return setError('#err-1', 'We just need a first name.');
      if (!validEmail(email)) return setError('#err-1', 'That email does not look right.');
      return setError('#err-1', '');
    }
    if (step === 2) {
      if (!chipValue('#f-type')) return setError('#err-2', 'Pick the closest one. You can change your mind later.');
      if ($('#f-location').value.trim().length < 2) return setError('#err-2', 'Even a rough area helps.');
      return setError('#err-2', '');
    }
    if (step === 3) {
      if (!chipValue('#f-budget')) return setError('#err-3', 'Pick a range. Nobody holds you to it.');
      if (!chipValue('#f-timeline')) return setError('#err-3', 'And roughly when?');
      return setError('#err-3', '');
    }
    return true;
  }

  function setError(selector, message) {
    $(selector).textContent = message;
    return !message;
  }

  async function createLead() {
    const payload = {
      name: $('#f-name').value,
      email: $('#f-email').value,
      propertyType: chipValue('#f-type'),
      location: $('#f-location').value,
      budget: chipValue('#f-budget'),
      timeline: chipValue('#f-timeline'),
    };
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not start.');

    state.lead = { id: data.id, token: data.token };
    state.cards = data.cards;
    state.index = 0;
    state.swipes = [];
    state.finished = false;
    saveSession();
    startDeck();
  }

  /* --------------------------------------------------------------- deck */

  function startDeck() {
    showScreen('screen-deck');
    renderStack();
    updateChrome();
  }

  function topCard() {
    const live = nodes.stack.querySelectorAll('.card:not(.is-gone)');
    return live.length ? live[live.length - 1] : null;
  }

  function buildCard(card) {
    const node = el('article', 'card');
    node.dataset.id = card.id;

    const media = el('div', 'card-media');
    const img = el('img');
    img.src = card.image;
    img.alt = card.title;
    img.draggable = false;
    media.appendChild(img);

    const body = el('div', 'card-body');
    body.appendChild(el('span', 'card-cat', card.categoryLabel));
    body.appendChild(el('h3', 'card-title', card.title));
    body.appendChild(el('p', 'card-caption', card.caption));

    const like = el('div', 'stamp stamp-like', 'Love it');
    const nope = el('div', 'stamp stamp-nope', 'Not for me');

    node.append(media, body, like, nope);
    return node;
  }

  function renderStack() {
    const visible = state.cards.slice(state.index, state.index + 3);
    const keep = new Set(visible.map((c) => c.id));

    for (const [id, node] of cardEls) {
      if (!keep.has(id)) {
        node.remove();
        cardEls.delete(id);
      }
    }

    // Back to front, so the current card ends up last in the DOM and on top.
    for (let i = visible.length - 1; i >= 0; i -= 1) {
      const card = visible[i];
      let node = cardEls.get(card.id);
      if (!node) {
        node = buildCard(card);
        cardEls.set(card.id, node);
      }
      node.className = 'card' + (i === 1 ? ' is-behind-1' : i === 2 ? ' is-behind-2' : '');
      node.style.transform = '';
      node.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
      nodes.stack.appendChild(node);
    }

    const preload = state.cards[state.index + 3];
    if (preload) new Image().src = preload.image;

    state.cardShownAt = Date.now();
  }

  function updateChrome() {
    const total = state.cards.length;
    const done = Math.min(state.index, total);
    nodes.progressFill.style.width = `${total ? (done / total) * 100 : 0}%`;
    nodes.counter.textContent = done >= total ? `${total} of ${total}` : `${done + 1} of ${total}`;
    const current = state.cards[state.index];
    if (current) nodes.catPill.textContent = current.categoryLabel;
    nodes.undo.disabled = state.index === 0;
  }

  /* ------------------------------------------------------ swipe physics */

  const drag = { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0, startedAt: 0, node: null };

  function onPointerDown(e) {
    if (state.locked || drag.active) return;
    const top = topCard();
    if (!top || !top.contains(e.target)) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.node = top;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.dx = 0;
    drag.dy = 0;
    drag.startedAt = Date.now();
    top.classList.remove('is-settling');
    top.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.startX;
    drag.dy = e.clientY - drag.startY;
    const rot = Math.max(-16, Math.min(16, drag.dx * 0.055));
    drag.node.style.transform = `translate(${drag.dx}px, ${drag.dy * 0.35}px) rotate(${rot}deg)`;
    const intensity = Math.min(1, Math.abs(drag.dx) / 90);
    const like = drag.node.querySelector('.stamp-like');
    const nope = drag.node.querySelector('.stamp-nope');
    like.style.opacity = drag.dx > 0 ? intensity : 0;
    nope.style.opacity = drag.dx < 0 ? intensity : 0;
    if (e.cancelable) e.preventDefault();
  }

  function onPointerUp(e) {
    if (!drag.active || e.pointerId !== drag.id) return;
    const node = drag.node;
    const dx = drag.dx;
    const elapsed = Math.max(1, Date.now() - drag.startedAt);
    const velocity = dx / elapsed;
    const threshold = Math.max(78, node.offsetWidth * 0.26);
    drag.active = false;
    drag.node = null;

    if (Math.abs(dx) > threshold || (Math.abs(velocity) > 0.55 && Math.abs(dx) > 34)) {
      commit(dx > 0 ? 'right' : 'left', node);
    } else {
      node.classList.add('is-settling');
      node.style.transform = '';
      node.querySelectorAll('.stamp').forEach((s) => { s.style.opacity = 0; });
    }
  }

  const LIKE_LINES = ['Noted.', 'Good taste.', 'Adding that.', 'Yes chef.', 'Filed under yes.'];
  const NOPE_LINES = ['Crossed off.', 'Never again.', 'Fair enough.', 'Not your thing.', 'Struck out.'];

  function commit(direction, node) {
    if (state.locked) return;
    const card = state.cards[state.index];
    if (!card) return;
    state.locked = true;

    const ms = Date.now() - state.cardShownAt;
    state.swipes = state.swipes.filter((s) => s.cardId !== card.id);
    state.swipes.push({ cardId: card.id, direction, ms });
    state.index += 1;

    const sign = direction === 'right' ? 1 : -1;
    cardEls.delete(card.id);
    node.classList.add('is-gone');
    node.style.transform = `translate(${sign * (window.innerWidth + 180)}px, ${-40}px) rotate(${sign * 26}deg)`;
    node.querySelector(direction === 'right' ? '.stamp-like' : '.stamp-nope').style.opacity = 1;
    setTimeout(() => node.remove(), 380);

    navigator.vibrate?.(direction === 'right' ? [14] : 10);
    speak(direction === 'right' ? LIKE_LINES : NOPE_LINES);

    renderStack();
    updateChrome();
    queueSync();

    setTimeout(() => {
      state.locked = false;
      if (state.index >= state.cards.length) completeDeck();
    }, 180);
  }

  function swipeTop(direction) {
    const top = topCard();
    if (top) commit(direction, top);
  }

  function undo() {
    if (state.locked || state.index === 0) return;
    state.index -= 1;
    state.swipes.pop();
    const card = state.cards[state.index];
    cardEls.delete(card.id);
    renderStack();
    const node = cardEls.get(card.id);
    if (node) node.classList.add('is-returning');
    updateChrome();
    queueSync();
    speak(['Rewound.', 'Second look.']);
  }

  let toastTimer = null;
  function speak(lines) {
    const line = Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;
    const left = state.cards.length - state.index;
    const milestone = left === 0 ? null
      : left === 1 ? 'One left.'
      : left === 3 ? 'Three to go.'
      : state.index === Math.floor(state.cards.length / 2) ? 'Halfway. Still fun?'
      : null;
    nodes.toast.textContent = milestone || line;
    nodes.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => nodes.toast.classList.remove('is-on'), 1100);
  }

  /* ---------------------------------------------------------- sync/save */

  function saveSession() {
    if (!state.lead) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        lead: state.lead,
        cards: state.cards,
        index: state.index,
        swipes: state.swipes,
        finished: state.finished,
        savedAt: Date.now(),
      }));
    } catch (_) { /* private mode, no problem */ }
  }

  function queueSync() {
    saveSession();
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(syncSwipes, 500);
  }

  async function syncSwipes() {
    if (!state.lead) return;
    try {
      await fetch(`/api/leads/${state.lead.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.lead.token, swipes: state.swipes }),
        keepalive: true,
      });
    } catch (_) { /* retried on the next swipe */ }
  }

  function beaconSwipes() {
    if (!state.lead || !state.swipes.length) return;
    const body = JSON.stringify({ token: state.lead.token, swipes: state.swipes });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`/api/leads/${state.lead.id}/swipes`, new Blob([body], { type: 'application/json' }));
    } else {
      syncSwipes();
    }
  }

  /* ------------------------------------------------------------ results */

  async function completeDeck() {
    await syncSwipes();
    const profile = await finish({});
    if (profile) renderResult(profile);
    showScreen('screen-result');
    state.finished = true;
    saveSession();
  }

  async function finish(extra) {
    if (!state.lead) return null;
    try {
      const res = await fetch(`/api/leads/${state.lead.id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.lead.token, ...extra }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  const TONE_COLOR = { hot: '#ff6ba6', warm: '#21d0a1', cool: '#ffc46b', cold: '#8b95a6' };
  const TONE_TITLE = {
    hot: 'You are a dream client',
    warm: 'You are officially qualified',
    cool: 'That is a decent start',
    cold: 'We barely know you',
  };

  function renderResult(profile) {
    const value = profile.score ? profile.score.value : 0;
    const tone = profile.score ? profile.score.tone : 'cold';
    $('#score-value').textContent = value;
    const ring = $('#ring-fg');
    ring.style.stroke = TONE_COLOR[tone] || TONE_COLOR.cold;
    requestAnimationFrame(() => { ring.style.strokeDashoffset = String(327 - (327 * value) / 100); });
    $('#result-title').textContent = TONE_TITLE[tone] || TONE_TITLE.cold;

    const likeCount = profile.likes.length;
    const total = profile.progress.of || profile.progress.done;
    $('#result-sub').textContent = likeCount
      ? `${likeCount} yes out of ${total}. Here is the brief we built from that, no typing required.`
      : 'You passed on everything, which is also useful. Your agent will come back with something different.';

    const facets = $('#facets');
    facets.innerHTML = '';
    profile.facets.forEach((facet) => {
      if (!facet.wanted.length && !facet.rejected.length) return;
      const li = el('li');
      li.appendChild(el('span', 'facet-key', facet.key));
      const val = el('span', 'facet-val', facet.wanted.join(', ') || '');
      li.appendChild(val);
      if (!facet.wanted.length) {
        val.remove();
        li.appendChild(el('span', 'facet-no', `passed on ${facet.rejected.join(', ')}`));
      }
      facets.appendChild(li);
    });
    if (!facets.children.length) {
      facets.appendChild(el('li', '', 'Nothing narrowed down yet.'));
    }

    const strip = $('#likes-strip');
    strip.innerHTML = '';
    profile.likes.forEach((like) => {
      const fig = el('figure');
      const img = el('img');
      img.src = like.image;
      img.alt = like.title;
      fig.appendChild(img);
      fig.appendChild(el('figcaption', '', like.title));
      strip.appendChild(fig);
    });
  }

  function wireResult() {
    $('#finish-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-send');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      await finish({ phone: $('#f-phone').value, note: $('#f-note').value });
      $('#finish-form').hidden = true;
      $('#done-panel').hidden = false;
      $('#done-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    $('#btn-restart').addEventListener('click', () => {
      try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* fine */ }
      window.location.reload();
    });
  }

  /* -------------------------------------------------------------- resume */

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || !saved.lead || Date.now() - saved.savedAt > RESUME_WINDOW_MS) return null;
      if (saved.finished) return null;
      if (!Array.isArray(saved.cards) || !saved.cards.length) return null;
      return saved;
    } catch (_) {
      return null;
    }
  }

  function wireResume() {
    const saved = readSession();
    if (!saved) return;
    const btn = $('#btn-resume');
    const left = saved.cards.length - saved.index;
    btn.hidden = false;
    btn.textContent = left > 0 ? `Pick up where I left off (${left} to go)` : 'See my results';
    btn.addEventListener('click', () => {
      state.lead = saved.lead;
      state.cards = saved.cards;
      state.index = saved.index;
      state.swipes = saved.swipes || [];
      if (state.index >= state.cards.length) {
        completeDeck();
      } else {
        startDeck();
      }
    });
  }

  /* ---------------------------------------------------------------- boot */

  function wireDeck() {
    nodes.stack.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    $('#btn-like').addEventListener('click', () => swipeTop('right'));
    $('#btn-nope').addEventListener('click', () => swipeTop('left'));
    $('#btn-undo').addEventListener('click', undo);

    window.addEventListener('keydown', (e) => {
      if (!$('#screen-deck').classList.contains('is-active')) return;
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); swipeTop('right'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); swipeTop('left'); }
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    });

    window.addEventListener('pagehide', beaconSwipes);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') beaconSwipes();
    });
  }

  async function init() {
    nodes.stack = $('#stack');
    nodes.progressFill = $('#progress-fill');
    nodes.counter = $('#counter');
    nodes.catPill = $('#cat-pill');
    nodes.toast = $('#toast');
    nodes.undo = $('#btn-undo');

    $('#btn-start').addEventListener('click', () => { showScreen('screen-brief'); gotoStep(1); });

    wireBrief();
    wireDeck();
    wireResult();

    try {
      await loadConfig();
    } catch (_) {
      $('#brand-agency').textContent = 'SwipeHouse';
    }
    wireResume();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
