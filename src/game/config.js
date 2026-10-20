/**
 * Cyber Michelangelo — game data & tunables.
 * Pure data / pure functions: safe to import from Node tests.
 */
import { P, THEMES, themeForStage, loopForStage } from '../render/palette.js';

export const VIEW = { w: 240, h: 420 };

/** Game version — shown by the browser self-test so deployments can be verified. */
export const VERSION = '1.1.0';

/** Playfield bounds (HUD occupies the top strip). */
export const FIELD = {
  left: 8,
  right: 232,
  top: 36,
  bottom: 412,
};

export const HUD = {
  height: 34,
  row1: 5,
  row2: 13,
  row3: 23,
};

/* ------------------------------------------------------------------ */
/* Player                                                             */
/* ------------------------------------------------------------------ */

export const PLAYER = {
  speed: 122,
  accel: 18, // approach rate (per second, exponential)
  coreR: 4.5, // core hitbox radius (forgiving)
  craftR: 6.5, // used when no modules docked / for pickups
  spawnX: 120,
  spawnY: 356,
  fireInterval: 0.112,
  bulletSpeed: 270,
  bulletDamage: 1,
  invulnTime: 1.9,
  respawnInvuln: 2.6,
  deathPause: 1.4,
  dockTime: 0.22,
  moduleHitPulse: 0.5,
  formationDuration: 3.4,
  formationCooldown: 2.8,
  formationFireBoost: 1.45,
  formationRadius: 28,
  phoenixDuration: 8.5,
  phoenixCooldown: 2.5,
  phoenixContactR: 14,
  phoenixSpeedMul: 1.12,
  phoenixFlameInterval: 0.095,
  novaInvuln: 1.3,
  novaRadius: 140,
  bounds: { left: 12, top: 42, right: 228, bottom: 410 },
};

/* ------------------------------------------------------------------ */
/* Docking modules (Beta, Gamma, Delta, Epsilon)                      */
/* ------------------------------------------------------------------ */

export const MODULE_DEFS = [
  {
    id: 'beta',
    num: 2,
    name: 'BETA',
    title: 'AUXILIARY FIRE',
    color: P.cyan,
    accent: P.cyanHi,
    deep: P.cyanDeep,
    slot: { x: -13.5, y: 1 },
    hitR: 4.5,
    fireInterval: 0.175,
    bulletSpeed: 255,
    bulletDamage: 1,
    line: 'TWIN SIDE CANNONS',
  },
  {
    id: 'gamma',
    num: 3,
    name: 'GAMMA',
    title: 'REAR CANNON',
    color: P.magenta,
    accent: P.magentaHi,
    deep: P.magentaDeep,
    slot: { x: 13.5, y: 1 },
    hitR: 4.5,
    fireInterval: 0.24,
    bulletSpeed: 235,
    bulletDamage: 1,
    line: 'COVERS YOUR SIX',
  },
  {
    id: 'delta',
    num: 4,
    name: 'DELTA',
    title: 'CONCUSSIVE BEAM',
    color: P.gold,
    accent: P.goldHi,
    deep: P.goldDeep,
    slot: { x: 0, y: 13 },
    hitR: 4.5,
    fireInterval: 2.5,
    bulletSpeed: 300,
    bulletDamage: 2,
    pierce: 3,
    line: 'PIERCING LANCE',
  },
  {
    id: 'epsilon',
    num: 5,
    name: 'EPSILON',
    title: 'REAR FORCE FIELD',
    color: P.green,
    accent: P.greenHi,
    deep: P.greenDeep,
    slot: { x: 0, y: -13 },
    hitR: 4.5,
    fireInterval: 0,
    fieldRadius: 27,
    line: 'BULLET-ERASING AURA',
  },
];

export const MODULE_BY_ID = Object.fromEntries(MODULE_DEFS.map((m) => [m.id, m]));
export const MODULE_ORDER = MODULE_DEFS.map((m) => m.id);

export function moduleForNum(num) {
  return MODULE_DEFS.find((m) => m.num === num) || null;
}

/* ------------------------------------------------------------------ */
/* Formations (behaviour in formations.js, names & timing here)       */
/* ------------------------------------------------------------------ */

export const FORMATION_NAMES = {
  1: 'ESCORT',
  2: 'MOON',
  3: 'EXTEND',
};

export function formationStyleForCount(count) {
  if (count >= 3) return 'extend';
  if (count === 2) return 'moon';
  return 'escort';
}

/* ------------------------------------------------------------------ */
/* Enemies                                                            */
/* ------------------------------------------------------------------ */

export const ENEMY_TYPES = {
  striker: {
    id: 'striker', sprite: 'striker', hp: 1, r: 5, score: 120, speed: 92,
    fireInterval: 0, isGround: false, drops: 0.07,
  },
  wraith: {
    id: 'wraith', sprite: 'wraith', hp: 2, r: 5, score: 180, speed: 72,
    fireInterval: 2.1, bulletSpeed: 92, aimed: true, drops: 0.1,
  },
  sentinel: {
    id: 'sentinel', sprite: 'sentinel', hp: 3, r: 6, score: 230, speed: 24,
    fireInterval: 2.4, bulletSpeed: 98, spread: 2, isGround: true, drops: 0.12,
  },
  goliath: {
    id: 'goliath', sprite: 'goliath', hp: 9, r: 8, score: 540, speed: 44,
    fireInterval: 1.8, bulletSpeed: 88, spread: 3, drops: 0.35, novaDrop: 0.22,
  },
  seraph: {
    id: 'seraph', sprite: 'seraph', hp: 2, r: 5, score: 170, speed: 38,
    fireInterval: 0, deathRing: 8, ringSpeed: 70, drops: 0.1,
  },
  vesper: {
    id: 'vesper', sprite: 'vesper', hp: 1, r: 4, score: 150, speed: 168,
    fireInterval: 0, dives: true, drops: 0.05,
  },
  lance: {
    id: 'lance', sprite: 'lance', hp: 2, r: 5, score: 270, speed: 54,
    fireInterval: 2.8, bulletSpeed: 150, aimed: true, drops: 0.15,
  },
  aegis: {
    id: 'aegis', sprite: 'aegis', hp: 6, r: 7, score: 400, speed: 40,
    fireInterval: 2.2, bulletSpeed: 82, spread: 2, shielded: true, drops: 0.2,
  },
};

/** Every enemy type gets a display name for the bestiary / boss warning text. */
export const ENEMY_NAMES = {
  striker: 'STRIKER DRONE',
  wraith: 'P-11 WRAITH',
  sentinel: 'SENTINEL POD',
  goliath: 'GOLIATH MK-II',
  seraph: 'SERAPH MINE',
  vesper: 'VESPER WING',
  lance: 'LANCE SNIPER',
  aegis: 'AEGIS WARDEN',
};

/* ------------------------------------------------------------------ */
/* Pods — the ground relics that release docking modules               */
/* ------------------------------------------------------------------ */

export const PODS = {
  count: 4,
  hp: 2,
  r: 7,
  spacing: 33,
  scrollSpeed: 28,
  spawnY: -16,
  score: 80,
  clusterBonus: 60,
  pickupValue: 750,
  pickupR: 7,
  pickupSpeed: 150,
  pickupHoming: 1.9,
  relicScore: 900,
};

/* ------------------------------------------------------------------ */
/* Pickups                                                            */
/* ------------------------------------------------------------------ */

export const PICKUPS = {
  gemScore: 250,
  gemR: 6,
  gemSpeed: 34,
  novaValue: 1,
  novaR: 7,
  heartR: 7,
  dropChances: { gem: 0.16, nova: 0.025, heart: 0.012 },
  lifetime: 12,
};

/* ------------------------------------------------------------------ */
/* Boss                                                               */
/* ------------------------------------------------------------------ */

export const BOSS = {
  names: ['COLOSSUS OF THE NULL COURT', 'VANDAL SERAPH', 'THE GRID TITAN'],
  baseHp: 300,
  handHp: 80,
  hpPerStage: 120,
  hpPerLoop: 160,
  r: 26,
  contactR: 24,
  entryY: 96,
  score: 5000,
  warnTime: 2.4,
  clearTime: 3.2,
  hands: [
    { id: 'left', x: -42, y: 26 },
    { id: 'right', x: 42, y: 26 },
  ],
  patterns: {
    aimedBurst: { count: 3, spread: 0.16, speed: 105, interval: 1.5 },
    ring: { count: 14, speed: 78, interval: 2.4 },
    spiral: { arms: 2, speed: 88, interval: 0.16 },
    wall: { count: 9, gap: 3, speed: 92, interval: 2.8 },
  },
};

export const BOSS_NAMES = BOSS.names;

/* ------------------------------------------------------------------ */
/* Stages, scoring, difficulty                                        */
/* ------------------------------------------------------------------ */

export const STAGE = {
  waves: 5,
  waveGap: 1.1,
  introTime: 2.6,
  podsOnWaves: [2, 4],
  clearBonus: 400,
};

export const SCORING = {
  comboWindow: 2.2,
  comboStep: 5, // kills per multiplier step
  maxMultiplier: 8,
  waveClear: 300,
  stageClear: 2500,
  phoenixBonus: 2500,
  novaKillBonus: 250,
  extraLivesAt: [30000, 80000, 150000, 250000, 400000, 600000, 850000],
  phoenixScoreMul: 2,
};

export const GAME = {
  startingLives: 3,
  maxLives: 5,
  startingNovas: 2,
  maxNovas: 3,
  continueWindow: 9,
  continueLives: 2,
  seed: 1985,
};

/** Endless-loop difficulty curves. */
export const DIFFICULTY = {
  enemyHp(stage, loop) {
    return Math.min(7, 1 + 0.16 * (stage - 1) + 0.4 * (loop - 1));
  },
  bulletSpeed(stage, loop) {
    return Math.min(1.85, 1 + 0.045 * (stage - 1) + 0.13 * (loop - 1));
  },
  density(stage, loop) {
    return Math.min(2.3, 1 + 0.1 * (stage - 1) + 0.28 * (loop - 1));
  },
  fireRate(stage, loop) {
    return Math.min(2.1, 1 + 0.06 * (stage - 1) + 0.16 * (loop - 1));
  },
  bossHp(stage, loop) {
    return Math.round(BOSS.baseHp + BOSS.hpPerStage * (stage - 1) + BOSS.hpPerLoop * (loop - 1));
  },
};

export function stageInfo(stage) {
  const theme = themeForStage(stage);
  const loop = loopForStage(stage);
  return { stage, loop, theme, name: theme.name };
}

export { THEMES, themeForStage, loopForStage };
