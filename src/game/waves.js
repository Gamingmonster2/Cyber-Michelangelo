/**
 * Endless stage generator.
 *
 * A stage is deterministic for (seed, stageNumber): 5 waves plus a boss.
 * Difficulty scales with the endless loop (every 3 stages) and with the
 * stage index itself.
 *
 * Pure module -> unit-testable without a DOM.
 */
import { RNG, hashSeed } from '../core/math.js';
import {
  ENEMY_TYPES, STAGE, DIFFICULTY, stageInfo, PODS,
} from './config.js';

const WAVE_BLUEPRINTS = [
  {
    tag: 'PATROL',
    budget: 3,
    pool: ['striker', 'wraith', 'vesper'],
    formations: ['line', 'v', 'snake'],
    heavyChance: 0.05,
    pods: true,
  },
  {
    tag: 'STRIKE',
    budget: 4,
    pool: ['wraith', 'vesper', 'striker'],
    formations: ['snake', 'pair', 'line'],
    pods: true,
    heavyChance: 0.12,
  },
  {
    tag: 'BARRAGE',
    budget: 4,
    pool: ['sentinel', 'wraith', 'striker', 'goliath'],
    formations: ['line', 'column', 'v'],
    heavyChance: 0.22,
  },
  {
    tag: 'ELITE',
    budget: 4,
    pool: ['lance', 'aegis', 'wraith', 'sentinel'],
    formations: ['pair', 'line', 'column'],
    pods: true,
    heavyChance: 0.3,
  },
  {
    tag: 'ONSLAUGHT',
    budget: 6,
    pool: ['goliath', 'aegis', 'wraith', 'striker', 'vesper', 'sentinel'],
    formations: ['v', 'line', 'snake', 'column'],
    heavyChance: 0.4,
  },
];

/** Horizontal / vertical offsets for a formation pattern. */
export function expandPattern(pattern, count, gap) {
  const out = [];
  const n = Math.max(1, count | 0);
  switch (pattern) {
    case 'line':
      for (let i = 0; i < n; i++) {
        out.push({ dx: (i - (n - 1) / 2) * gap, dy: 0, delay: 0 });
      }
      break;
    case 'v':
      for (let i = 0; i < n; i++) {
        const mid = (n - 1) / 2;
        out.push({
          dx: (i - mid) * gap * 1.1,
          dy: Math.abs(i - mid) * gap * 0.62,
          delay: 0,
        });
      }
      break;
    case 'snake':
      for (let i = 0; i < n; i++) {
        out.push({
          dx: Math.sin(i * 1.05) * gap * 0.9,
          dy: -i * 5,
          delay: i * 0.16,
        });
      }
      break;
    case 'column':
      for (let i = 0; i < n; i++) {
        out.push({ dx: 0, dy: -i * gap * 0.9, delay: i * 0.3 });
      }
      break;
    case 'pair':
      out.push({ dx: -gap * 0.6, dy: 0, delay: 0 });
      out.push({ dx: gap * 0.6, dy: 0, delay: 0 });
      break;
    default:
      out.push({ dx: 0, dy: 0, delay: 0 });
  }
  return out;
}

/**
 * Build a stage plan.
 * @param {number} stageNumber 1-based endless stage index
 * @param {number} seed run seed
 */
export function createStage(stageNumber, seed = 1985) {
  const stage = Math.max(1, Math.floor(stageNumber));
  const info = stageInfo(stage);
  const rng = new RNG(hashSeed(seed, stage, 'waves'));
  const density = DIFFICULTY.density(stage, info.loop);
  const waves = [];

  for (let w = 0; w < STAGE.waves; w++) {
    const bp = WAVE_BLUEPRINTS[w % WAVE_BLUEPRINTS.length];
    const spawns = [];
    const groups = Math.max(2, Math.round(bp.budget * density));
    // Spread groups across the wave: 0.6s after start then every ~2.2–3.2s.
    let at = 0.7 + rng.range(0, 0.6);
    for (let g = 0; g < groups; g++) {
      const heavy = rng.chance(bp.heavyChance);
      const pool = heavy ? ['goliath', 'aegis'] : bp.pool.filter((t) => t !== 'goliath' && t !== 'aegis');
      const type = rng.pick(pool.length ? pool : bp.pool);
      const pattern = rng.pick(bp.formations);
      const count = pattern === 'pair' ? 2 : rng.int(2, 4 + Math.min(3, info.loop));
      const gap = type === 'goliath' ? 46 : rng.int(20, 30);
      const x = rng.range(52, 188);
      spawns.push({
        type,
        pattern,
        x: Math.round(x),
        at: Math.round(at * 10) / 10,
        count,
        gap,
      });
      at += rng.range(1.9, 3.1);
    }

    waves.push({
      index: w,
      tag: bp.tag,
      spawns,
      pods: Boolean(bp.pods) && w < STAGE.waves,
      duration: Math.round((at + 4.2) * 10) / 10,
    });
  }

  // Boss plan for the stage.
  const bossHp = DIFFICULTY.bossHp(stage, info.loop);
  const boss = {
    type: 'colossus',
    name: info.theme.id === 'catacombs'
      ? 'VANDAL SERAPH'
      : info.theme.id === 'cathedral'
        ? 'THE GRID TITAN'
        : 'COLOSSUS OF THE NULL COURT',
    hp: bossHp,
    handHp: Math.round(bossHp * 0.22),
    score: 5000 * stage,
  };

  return {
    stage,
    loop: info.loop,
    theme: info.theme,
    themeIndex: (stage - 1) % 3,
    name: info.theme.name,
    seed: hashSeed(seed, stage, 'stage'),
    waves,
    boss,
  };
}

/** Total scheduled spawn count — handy for tests / pacing display. */
export function stageSpawnCount(plan) {
  return plan.waves.reduce(
    (sum, wave) => sum + wave.spawns.reduce((s, sp) => s + sp.count, 0),
    0,
  );
}

export function stageDurationEstimate(plan) {
  return plan.waves.reduce((sum, w) => sum + w.duration + STAGE.waveGap, 0);
}

/** Module number a pod cluster should carry: the first missing piece. */
export function nextMissingModule(dockedIds) {
  const order = [2, 3, 4, 5];
  const owned = new Set(dockedIds || []);
  for (const num of order) if (!owned.has(num)) return num;
  return null; // all collected -> relic bonus
}

export const POD_CLUSTER_COUNT = PODS.count;
