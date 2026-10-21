/**
 * Safe persistence wrapper.
 * localStorage can throw (privacy modes, disabled storage, sandboxed iframes),
 * so every call falls back to an in-memory store. Pure enough for Node tests.
 */

const memory = new Map();
let storage = null;
let warned = false;

function detect() {
  if (storage !== null) return storage;
  try {
    const test = '__cm_probe__';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      storage = localStorage;
      return storage;
    }
  } catch {
    /* fall through to memory */
  }
  storage = false;
  return storage;
}

function warnOnce(err) {
  if (warned) return;
  warned = true;
  if (typeof console !== 'undefined') {
    console.warn('[storage] localStorage unavailable, using memory store:', err && err.message);
  }
}

export function getItem(key) {
  const s = detect();
  if (s) {
    try {
      return s.getItem(key);
    } catch (err) {
      warnOnce(err);
    }
  }
  return memory.has(key) ? memory.get(key) : null;
}

export function setItem(key, value) {
  const s = detect();
  if (s) {
    try {
      s.setItem(key, value);
      return true;
    } catch (err) {
      warnOnce(err);
    }
  }
  memory.set(key, String(value));
  return true;
}

export function removeItem(key) {
  const s = detect();
  if (s) {
    try {
      s.removeItem(key);
      return;
    } catch (err) {
      warnOnce(err);
    }
  }
  memory.delete(key);
}

export function getJSON(key, fallback) {
  const raw = getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJSON(key, value) {
  try {
    return setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export const KEYS = {
  hiScore: 'cm.hiscore',
  settings: 'cm.settings',
  stats: 'cm.stats',
};

export const DEFAULT_SETTINGS = Object.freeze({
  music: 7,
  sfx: 8,
  autoFire: false,
  shake: true,
  scanlines: true,
  showFps: false,
  renderStyle: 'hd', // 'hd' (HD-2D) | '3d' (optional WebGL renderer)
  musicStyle: 'chiptune', // 'chiptune' (procedural) | 'cc0' (sampled CC0 soundtrack)
});

export function loadSettings() {
  const saved = getJSON(KEYS.settings, null);
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function saveSettings(settings) {
  return setJSON(KEYS.settings, settings);
}

/** Record a finished run; returns the (possibly new) best score. */
export function recordRun({ score, stage, loop, seconds }) {
  const hi = Number(getItem(KEYS.hiScore)) || 0;
  const stats = getJSON(KEYS.stats, { runs: 0, bestScore: 0, bestStage: 1, totalSeconds: 0, phoenixes: 0 });
  stats.runs += 1;
  stats.bestScore = Math.max(stats.bestScore || 0, Math.floor(score) || 0);
  stats.bestStage = Math.max(stats.bestStage || 1, stage || 1);
  stats.totalSeconds = (stats.totalSeconds || 0) + Math.max(0, seconds || 0);
  stats.phoenixes = (stats.phoenixes || 0) + (stats.phoenixesThisRun || 0);
  setJSON(KEYS.stats, stats);
  if (score > hi) setItem(KEYS.hiScore, String(Math.floor(score)));
  return Math.max(hi, Math.floor(score) || 0);
}

export function loadStats() {
  return getJSON(KEYS.stats, { runs: 0, bestScore: 0, bestStage: 1, totalSeconds: 0, phoenixes: 0 });
}

/** Test helper. */
export function _resetMemoryStore() {
  memory.clear();
  storage = null;
  warned = false;
}
