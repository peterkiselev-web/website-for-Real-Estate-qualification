/* The lead desk. Reads the same judgement the client page produced. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const state = { leads: [], filter: 'all', query: '', open: new Set() };

  const TONE_COLOR = { hot: '#c2452c', warm: '#0f6e5c', cool: '#b8892b', cold: '#7d8a91' };
  const STATUS_LABEL = {
    started: 'Opened, no swipes',
    swiping: 'Swiping now',
    answering: 'On the money questions',
    completed: 'Finished',
    abandoned: 'Dropped out',
  };

  /* --------------------------------------------------------------- auth */

  async function load() {
    const res = await fetch('/api/agent/leads');
    if (res.status === 401) {
      $('#gate').hidden = false;
      $('#desk').hidden = true;
      return;
    }
    const data = await res.json();
    state.leads = data.leads || [];
    $('#gate').hidden = true;
    $('#desk').hidden = false;
    render();
  }

  function wireGate() {
    $('#gate-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch('/api/agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: $('#passcode').value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        $('#gate-error').textContent = data.error || 'That did not work.';
        return;
      }
      $('#passcode').value = '';
      $('#gate-error').textContent = '';
      load();
    });

    $('#btn-logout').addEventListener('click', async () => {
      await fetch('/api/agent/session', { method: 'DELETE' });
      window.location.reload();
    });
    $('#btn-refresh').addEventListener('click', load);
  }

  /* ------------------------------------------------------------ filters */

  function wireToolbar() {
    $('#filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.filter = chip.dataset.filter;
      $('#filters').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
      render();
    });
    $('#search').addEventListener('input', (e) => {
      state.query = e.target.value.trim().toLowerCase();
      render();
    });
  }

  function visibleLeads() {
    return state.leads.filter((lead) => {
      if (state.filter === 'archived') {
        if (!lead.archived) return false;
      } else if (lead.archived) {
        return false;
      }
      if (state.filter === 'hot' && lead.hotness.value < 70) return false;
      if (state.filter === 'viewing' && !/here_now|here_soon|flying/.test(viewingId(lead))) return false;
      if (state.filter === 'abandoned' && lead.status !== 'abandoned') return false;
      if (state.query) {
        const hay = [lead.contact.name, lead.contact.email, lead.contact.phone, lead.kindLabel]
          .concat(lead.areas.top.map((a) => a.name))
          .join(' ').toLowerCase();
        if (!hay.includes(state.query)) return false;
      }
      return true;
    });
  }

  function viewingId(lead) {
    const label = lead.answers.viewing || '';
    if (/this week/i.test(label)) return 'here_now';
    if (/few weeks/i.test(label)) return 'here_soon';
    if (/flying/i.test(label)) return 'flying';
    return 'remote';
  }

  /* ------------------------------------------------------------- render */

  function render() {
    renderStats();
    const list = $('#leads');
    list.innerHTML = '';
    const leads = visibleLeads();
    if (!state.leads.length) {
      $('#empty').textContent = 'Nobody here yet. Send someone the link and watch this fill up.';
      $('#empty').hidden = false;
    } else if (!leads.length) {
      $('#empty').textContent = 'No leads match that filter.';
      $('#empty').hidden = false;
    } else {
      $('#empty').hidden = true;
    }
    leads.forEach((lead) => list.appendChild(renderLead(lead)));
  }

  function renderStats() {
    const all = state.leads.filter((l) => !l.archived);
    const ready = all.filter((l) => l.hotness.value >= 85);
    const hot = all.filter((l) => l.hotness.value >= 70);
    const finished = all.filter((l) => l.status === 'completed');
    const stats = [
      { value: all.length, label: 'Leads in the funnel' },
      { value: ready.length, label: 'Ready to proceed' },
      { value: hot.length, label: 'Worth calling today' },
      { value: all.length ? `${Math.round((finished.length / all.length) * 100)}%` : '0%', label: 'Finished the funnel' },
    ];
    const wrap = $('#stats');
    wrap.innerHTML = '';
    stats.forEach((s) => {
      const card = el('div', 'stat');
      card.appendChild(el('div', 'stat-value', String(s.value)));
      card.appendChild(el('div', 'stat-label', s.label));
      wrap.appendChild(card);
    });

    const dropped = all.filter((l) => l.status === 'abandoned').length;
    $('#desk-sub').textContent = dropped
      ? `${all.length} leads, hottest first. ${dropped} dropped out mid-funnel and still told you something.`
      : `${all.length} leads, hottest first.`;
  }

  function renderLead(lead) {
    const wrap = el('article', `lead${lead.archived ? ' is-archived' : ''}${state.open.has(lead.id) ? ' is-open' : ''}`);
    wrap.dataset.id = lead.id;

    const head = el('div', 'lead-head');
    head.setAttribute('role', 'button');
    head.tabIndex = 0;

    const left = el('div');
    const name = el('div', 'lead-name');
    name.appendChild(document.createTextNode(lead.contact.name || 'Unnamed'));
    name.appendChild(el('span', `badge badge-${lead.hotness.tone}`, lead.hotness.label));
    name.appendChild(el('span', 'badge badge-status', STATUS_LABEL[lead.status] || lead.status));
    left.appendChild(name);

    // The headline the agent actually wants: which areas to send them.
    const areas = el('div', 'lead-areas');
    if (lead.areas.top.length) {
      areas.appendChild(el('span', 'areas-key', 'Areas'));
      lead.areas.top.forEach((a) => {
        const pill = el('span', 'area-pill');
        pill.appendChild(el('b', '', a.name));
        pill.appendChild(el('i', '', `${a.match}%`));
        areas.appendChild(pill);
      });
    } else {
      areas.appendChild(el('span', 'areas-key', 'Areas: not enough answers yet'));
    }
    left.appendChild(areas);

    const line = el('div', 'lead-line');
    line.textContent = [
      lead.contact.email,
      lead.contact.phone,
      lead.answers.budget,
      lead.answers.payment,
      lead.answers.commute && `works around ${lead.answers.commute}`,
      `${lead.progress.done} cards`,
      `${lead.narrowing.to} of ${lead.narrowing.from} areas left`,
      timeAgo(lead.updatedAt),
    ].filter(Boolean).join(' · ');
    left.appendChild(line);

    // Worst news first: the collapsed row only has room for three.
    const rank = { bad: 0, warn: 1, good: 2 };
    const flags = el('div', 'lead-tags');
    lead.hotness.flags
      .slice()
      .sort((a, b) => rank[a.tone] - rank[b.tone])
      .slice(0, 3)
      .forEach((f) => flags.appendChild(el('span', `tag tag-${f.tone}`, f.text)));
    if (flags.children.length) left.appendChild(flags);

    if (lead.dropOff) {
      left.appendChild(el('div', 'dropoff', `Left ${lead.dropOff.stage}, ${lead.dropOff.seen} cards in, narrowed to ${lead.dropOff.narrowedTo} areas.`));
    }

    const right = el('div', 'lead-score');
    right.appendChild(el('div', 'score-num', String(lead.hotness.value)));
    const bar = el('div', 'score-bar');
    const fill = el('div', 'score-fill');
    fill.style.width = `${lead.hotness.value}%`;
    fill.style.background = TONE_COLOR[lead.hotness.tone];
    bar.appendChild(fill);
    right.appendChild(bar);

    head.append(left, right);
    head.addEventListener('click', () => toggle(lead.id, wrap));
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(lead.id, wrap); }
    });

    wrap.appendChild(head);
    wrap.appendChild(renderBody(lead));
    return wrap;
  }

  function renderBody(lead) {
    const body = el('div', 'lead-body');

    const advice = el('div', 'advice');
    advice.appendChild(el('strong', '', `${lead.hotness.value}/100 · ${lead.hotness.label}. `));
    advice.appendChild(document.createTextNode(lead.hotness.advice));
    body.appendChild(advice);

    /* the shortlist, which is what you send them */
    if (lead.areas.top.length) {
      const shortlist = el('div', 'detail');
      shortlist.appendChild(el('h4', '', `Send them ${lead.areas.kind === 'any' ? 'property' : lead.areas.kind + 's'} in`));
      const table = el('div', 'areas-table');
      lead.areas.top.forEach((a, i) => {
        const row = el('div', 'area-row');
        row.appendChild(el('span', 'area-n', String(i + 1)));
        const mid = el('div');
        const head = el('div', 'area-name');
        head.appendChild(el('b', '', a.name));
        head.appendChild(el('span', 'area-pct', `${a.match}% match`));
        if (a.budget === 'stretch') head.appendChild(el('span', 'area-stretch', 'stretch'));
        mid.appendChild(head);
        mid.appendChild(el('div', 'area-why', a.reasons.length ? a.reasons.join(' · ') : a.blurb));
        mid.appendChild(el('div', 'area-catch', a.catch));
        row.appendChild(mid);
        const price = el('span', 'area-price');
        price.appendChild(el('b', '', a.fromLabel));
        price.appendChild(el('span', '', ` ${a.kind}s`));
        if (a.minutes) price.appendChild(el('span', '', ` · ${a.minutes} min`));
        row.appendChild(price);
        table.appendChild(row);
      });
      shortlist.appendChild(table);
      if (lead.areas.also.length) {
        shortlist.appendChild(el('p', 'area-also', `Also close: ${lead.areas.also.map((a) => a.name).join(', ')}`));
      }
      if (lead.areas.outOfReach.length) {
        shortlist.appendChild(el('p', 'area-also', `Wants but cannot afford: ${lead.areas.outOfReach.map((a) => `${a.name} (from ${a.fromLabel})`).join(', ')}`));
      }
      body.appendChild(shortlist);
    }

    /* how the score was reached */
    const score = el('div', 'detail');
    score.appendChild(el('h4', '', 'How that number was reached'));
    const meters = el('div', 'meters');
    lead.hotness.parts.forEach((p) => {
      const row = el('div', 'meter');
      row.appendChild(el('span', 'meter-key', p.key));
      const track = el('span', 'meter-track');
      const fill = el('span', 'meter-fill');
      fill.style.width = `${Math.round((p.got / p.of) * 100)}%`;
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'meter-num', `${p.got}/${p.of}`));
      row.appendChild(el('span', 'meter-note', p.note));
      meters.appendChild(row);
    });
    score.appendChild(meters);
    if (lead.hotness.flags.length) {
      const flagList = el('ul', 'flags');
      lead.hotness.flags.forEach((f) => {
        const li = el('li', `flag flag-${f.tone}`, f.text);
        flagList.appendChild(li);
      });
      score.appendChild(flagList);
    }
    body.appendChild(score);

    const grid = el('div', 'detail-grid');

    const answers = el('div', 'detail');
    answers.appendChild(el('h4', '', 'What they told you'));
    const aList = el('ul');
    [
      ['Budget', lead.answers.budget],
      ['Week around', lead.answers.commute],
      ['For', lead.answers.purpose],
      ['Funds', lead.answers.payment],
      ['Timing', lead.answers.timeline],
      ['Viewing', lead.answers.viewing],
      ['Looking for', lead.kindLabel],
    ].forEach(([k, v]) => {
      if (!v) return;
      const li = el('li');
      li.appendChild(el('span', 'facet-key', `${k}: `));
      li.appendChild(document.createTextNode(v));
      aList.appendChild(li);
    });
    answers.appendChild(aList);

    const swipesCol = el('div', 'detail');
    swipesCol.appendChild(el('h4', '', 'What the swipes say'));
    const sList = el('ul');
    lead.facets.want.forEach((row) => {
      const li = el('li');
      li.appendChild(el('span', 'facet-key', `${row.key}: `));
      li.appendChild(document.createTextNode(row.values.join(', ')));
      sList.appendChild(li);
    });
    lead.facets.no.forEach((row) => {
      const li = el('li');
      li.appendChild(el('span', 'facet-key', `${row.key} ruled out: `));
      li.appendChild(el('span', 'facet-no', row.values.join(', ')));
      sList.appendChild(li);
    });
    if (!lead.facets.want.length && !lead.facets.no.length) sList.appendChild(el('li', '', 'No swipes yet.'));
    swipesCol.appendChild(sList);

    grid.append(answers, swipesCol);
    body.appendChild(grid);

    if (lead.likes.length) {
      const liked = el('div', 'detail');
      liked.appendChild(el('h4', '', `Swiped right (${lead.likes.length})`));
      liked.appendChild(thumbs(lead.likes, false));
      body.appendChild(liked);
    }
    if (lead.passes.length) {
      const passed = el('div', 'detail');
      passed.appendChild(el('h4', '', `Swiped left (${lead.passes.length})`));
      passed.appendChild(thumbs(lead.passes, true));
      body.appendChild(passed);
    }

    const summary = el('div', 'detail');
    summary.appendChild(el('h4', '', 'Paste into your CRM'));
    summary.appendChild(el('pre', 'summary', lead.briefText));
    body.appendChild(summary);

    const notesWrap = el('div', 'detail');
    notesWrap.appendChild(el('h4', '', 'Your notes'));
    const notes = el('textarea', 'notes');
    notes.value = lead.agentNotes || '';
    notes.placeholder = 'Called Tuesday, viewing Marina Gate on Saturday.';
    notesWrap.appendChild(notes);
    body.appendChild(notesWrap);

    const actions = el('div', 'lead-actions');
    const saveBtn = el('button', 'btn btn-primary btn-sm', 'Save notes');
    const flag = el('span', 'saved-flag', 'Saved');
    saveBtn.addEventListener('click', async () => {
      await patch(lead.id, { agentNotes: notes.value });
      flag.classList.add('is-on');
      setTimeout(() => flag.classList.remove('is-on'), 1400);
    });

    const copyBtn = el('button', 'btn btn-ghost btn-sm', 'Copy brief');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lead.briefText);
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy brief'; }, 1400);
      } catch (_) {
        copyBtn.textContent = 'Copy failed';
      }
    });

    const mail = el('a', 'btn btn-ghost btn-sm', 'Email them');
    mail.href = `mailto:${encodeURIComponent(lead.contact.email || '')}?subject=${encodeURIComponent('Dubai properties that match what you swiped')}&body=${encodeURIComponent(`Hi ${(lead.contact.name || '').split(' ')[0]},\n\nThanks for going through those. Based on what you picked:\n\n${lead.briefText}\n\nI have a couple of places that fit. When suits you for a viewing?\n`)}`;

    const actionsRight = [];
    if (lead.contact.phone) {
      const wa = el('a', 'btn btn-ghost btn-sm', 'WhatsApp');
      wa.href = `https://wa.me/${lead.contact.phone.replace(/[^\d]/g, '')}`;
      wa.target = '_blank';
      wa.rel = 'noopener';
      actionsRight.push(wa);
    }

    const archiveBtn = el('button', 'btn btn-ghost btn-sm', lead.archived ? 'Unarchive' : 'Archive');
    archiveBtn.addEventListener('click', async () => {
      await patch(lead.id, { archived: !lead.archived });
      await load();
    });

    const delBtn = el('button', 'btn btn-danger btn-sm', 'Delete');
    delBtn.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${lead.contact.name || 'this lead'} permanently?`)) return;
      await fetch(`/api/agent/leads/${lead.id}`, { method: 'DELETE' });
      state.open.delete(lead.id);
      await load();
    });

    actions.append(saveBtn, copyBtn, mail, ...actionsRight, archiveBtn, delBtn, flag);
    body.appendChild(actions);
    return body;
  }

  function thumbs(cards, passed) {
    const wrap = el('div', `thumbs${passed ? ' is-passed' : ''}`);
    cards.forEach((card) => {
      const fig = el('figure');
      const img = el('img');
      img.src = card.image;
      img.alt = card.title;
      img.loading = 'lazy';
      fig.appendChild(img);
      fig.appendChild(el('figcaption', '', card.title));
      wrap.appendChild(fig);
    });
    return wrap;
  }

  async function patch(id, body) {
    const res = await fetch(`/api/agent/leads/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = state.leads.findIndex((l) => l.id === id);
      if (idx > -1) state.leads[idx] = updated;
    }
  }

  function toggle(id, node) {
    if (state.open.has(id)) {
      state.open.delete(id);
      node.classList.remove('is-open');
    } else {
      state.open.add(id);
      node.classList.add('is-open');
    }
  }

  function timeAgo(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  wireGate();
  wireToolbar();
  load();

  // Keep the desk fresh, but never yank a half-typed note out from under the agent.
  setInterval(() => {
    const active = document.activeElement;
    if (active && active.matches('textarea, input')) return;
    load();
  }, 60000);
})();
