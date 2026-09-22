'use strict';

/**
 * Flat-file lead storage. One JSON file, held in memory, written atomically.
 *
 * Deliberately boring: an agent should be able to run this on a cheap box or
 * read the raw file. Swap this module for a database if you outgrow it; the
 * rest of the app only touches the methods below.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WRITE_DEBOUNCE_MS = 250;

class LeadStore {
  constructor(file) {
    this.file = file;
    this.leads = new Map();
    this.writeTimer = null;
    this.writing = false;
    this.dirty = false;
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed.leads || [];
      for (const lead of list) this.leads.set(lead.id, lead);
    } catch (err) {
      if (err.code === 'ENOENT') return;
      console.error(`[store] could not read ${this.file}: ${err.message}`);
      // Never overwrite a file we failed to understand. Park it and carry on.
      const backup = `${this.file}.unreadable-${Date.now()}`;
      try {
        fs.renameSync(this.file, backup);
        console.error(`[store] moved it to ${backup} and started with an empty set`);
      } catch (renameErr) {
        console.error(`[store] could not move it aside either: ${renameErr.message}`);
      }
    }
  }

  create(fields) {
    const now = new Date().toISOString();
    const lead = {
      id: `ld_${crypto.randomBytes(8).toString('hex')}`,
      token: crypto.randomBytes(16).toString('hex'),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      contact: fields.contact || {},
      area: fields.area || '',
      branch: fields.branch || 'mixed',
      swipes: [],
      answers: {},
      note: '',
      agentNotes: '',
      archived: false,
      source: fields.source || 'link',
    };
    this.leads.set(lead.id, lead);
    this.schedulePersist();
    return lead;
  }

  get(id) {
    return this.leads.get(id) || null;
  }

  update(id, mutate) {
    const lead = this.leads.get(id);
    if (!lead) return null;
    mutate(lead);
    lead.updatedAt = new Date().toISOString();
    this.schedulePersist();
    return lead;
  }

  all() {
    return [...this.leads.values()];
  }

  remove(id) {
    const existed = this.leads.delete(id);
    if (existed) this.schedulePersist();
    return existed;
  }

  schedulePersist() {
    this.dirty = true;
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.persist();
    }, WRITE_DEBOUNCE_MS);
    if (this.writeTimer.unref) this.writeTimer.unref();
  }

  /** Write to a temp file then rename, so a crash mid-write cannot shred the data. */
  persist() {
    if (this.writing) return;
    this.writing = true;
    this.dirty = false;
    const payload = JSON.stringify({ version: 1, leads: this.all() }, null, 2);
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, payload, 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error(`[store] write failed: ${err.message}`);
      try {
        fs.unlinkSync(tmp);
      } catch (_) {
        /* nothing else to do */
      }
    } finally {
      this.writing = false;
      if (this.dirty) this.schedulePersist();
    }
  }

  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.persist();
  }
}

module.exports = { LeadStore };
