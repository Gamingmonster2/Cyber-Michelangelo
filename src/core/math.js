/**
 * Small math / RNG toolkit shared by logic and rendering.
 * Pure functions only — safe to import from Node tests.
 */

export const TAU = Math.PI * 2;
export const PI = Math.PI;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const saturate = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => {
  t = saturate(t);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - saturate(t), 3);
export const easeInCubic = (t) => Math.pow(saturate(t), 3);
export const easeInOutQuad = (t) => {
  t = saturate(t);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};
export const easeOutBack = (t) => {
  const c = 1.70158;
  const x = saturate(t) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (fromX, fromY, toX, toY) => Math.atan2(toY - fromY, toX - fromX);
export const vecLen = (x, y) => Math.sqrt(x * x + y * y);
export const normalize = (x, y) => {
  const l = vecLen(x, y);
  return l > 0.00001 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
};
export const moveToward = (value, target, maxDelta) => {
  if (Math.abs(target - value) <= maxDelta) return target;
  return value + sign(target - value) * maxDelta;
};

/** Circle-vs-circle test. */
export const hitsCircle = (ax, ay, ar, bx, by, br) => dist2(ax, ay, bx, by) <= (ar + br) * (ar + br);

/** Axis-aligned rectangle-vs-circle test. */
export function circleHitsRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return dist2(cx, cy, nx, ny) <= cr * cr;
}

/** Axis-aligned rectangle overlap (bounds: x, y, w, h). */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Deterministic 32-bit seed from any number of ints / strings. */
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = Math.imul(h ^ (h >>> 13), 2654435761);
  }
  return h >>> 0;
}

/** Mulberry32 — small, fast, deterministic PRNG. */
export class RNG {
  constructor(seed = 0x9e3779b9) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    return Math.floor(min + (max - min + 1) * this.next());
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

/** Format a score with zero-padded arcade digits. */
export function formatScore(value, pad = 7) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return String(n).padStart(pad, '0');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Shortest signed angle difference between two radians. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > PI) d -= TAU;
  if (d < -PI) d += TAU;
  return d;
}

/** Advance an angle toward another by maxStep radians. */
export function angleToward(a, b, maxStep) {
  const d = angleDelta(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}
