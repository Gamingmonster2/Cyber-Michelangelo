/**
 * Formation choreography: where detached modules float while the player
 * holds the transform button's "split" state.
 *
 * Pure functions -> easy to unit test. Positions are offsets from the
 * player's centre, in game pixels.
 */
import { TAU } from '../core/math.js';
import { PLAYER } from './config.js';

/**
 * @param {number} count  number of detached modules (1..3)
 * @param {string} style  'escort' | 'moon' | 'extend'
 * @param {number} time   seconds since the formation started
 * @returns {{x:number,y:number,angle:number}[]} offsets & facing for each module
 */
export function formationPositions(count, style, time) {
  const n = Math.max(0, Math.min(4, count | 0));
  const t = time;
  const out = [];
  const R = PLAYER.formationRadius;

  if (n === 0) return out;

  if (style === 'extend') {
    // A sweeping echelon line in front of the craft — "helicopter fire".
    const sweep = Math.sin(t * 2.4) * 0.55;
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : (i - (n - 1) / 2);
      const angle = -Math.PI / 2 + sweep + spread * 0.34 + Math.sin(t * 3.1 + i) * 0.07;
      const radius = R + (i % 2 === 0 ? 0 : 5) + Math.sin(t * 2.2 + i * 1.3) * 2;
      out.push({
        x: Math.cos(angle) * radius * 1.15,
        y: Math.sin(angle) * radius * 0.85 - 6,
        angle,
      });
    }
    return out;
  }

  if (style === 'moon') {
    // A slowly rotating crescent that guards the player.
    const base = -Math.PI / 2 + Math.sin(t * 1.35) * 0.35;
    const arc = 0.62;
    for (let i = 0; i < n; i++) {
      const a = base + (i === 0 ? -arc : arc) + Math.sin(t * 2 + i) * 0.05;
      const radius = R * (0.95 + 0.08 * Math.sin(t * 2.6 + i));
      out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius, angle: a });
    }
    return out;
  }

  // 'escort' — a single module orbits the craft (or a slow halo for >1).
  for (let i = 0; i < n; i++) {
    const a = t * 2.1 + (TAU * i) / Math.max(1, n);
    out.push({ x: Math.cos(a) * (R - 4), y: Math.sin(a) * (R - 4), angle: a });
  }
  return out;
}

/** How long the split lasts before automatically rejoining. */
export function formationDuration() {
  return PLAYER.formationDuration;
}

/** Fire-rate bonus multiplier while split. */
export function formationFireBoost() {
  return PLAYER.formationFireBoost;
}
