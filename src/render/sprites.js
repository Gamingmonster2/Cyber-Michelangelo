/**
 * Hand-authored pixel art. Everything is generated at runtime from these
 * character maps, so the game ships with zero image assets.
 *
 * Character → palette colour is supplied per sprite. '.' and ' ' are clear.
 */
import { P } from './palette.js';
import { makeSprite } from './pixel.js';

// Shared palette for the marble/gold player faction.
const SHIP_PAL = {
  w: P.marbleHi,
  m: P.marble,
  d: P.marbleMid,
  s: P.marbleSh,
  o: P.outline,
  G: P.goldHi,
  g: P.gold,
  c: P.cyan,
  C: P.cyanHi,
  e: P.cyanSh,
  v: P.violet,
};

/** Alpha core — the player's base craft (16×20, mirrored from an 8px half). */
const CORE_HALF = [
  '........',
  '.......w',
  '......ow',
  '......om',
  '.....omm',
  '.....omG',
  '....ommG',
  '...owmmG',
  '..owcmmm',
  '.owccmmm',
  'owcccmmm',
  'owcccmmm',
  '.owccmmm',
  '..owcmmm',
  '...owmmm',
  '....ommm',
  '....oomm',
  '.....eCC',
  '.....eee',
  '......ee',
];

/** Docked module art (9×8); colour family differs per module. */
const MODULE_MAPS = {
  beta: {
    pal: { c: P.cyan, C: P.cyanHi, m: P.steel, M: P.steelHi, G: P.white, o: P.outline },
    rows: [
      '..c...c..',
      '..c...c..',
      '..cCCCc..',
      '.cCmmmCc.',
      'cCmmGmmCc',
      'cCmmmmmCc',
      '.cCCCCCc.',
      '..ccccc..',
    ],
  },
  gamma: {
    pal: { m: P.magentaSh, M: P.magenta, G: P.magentaHi, o: P.outline },
    rows: [
      '..mmmmm..',
      '.mMMMMMm.',
      'mMMGGGMMm',
      'mMMGGGMMm',
      '.mMMMMMm.',
      '..m...m..',
      '..m...m..',
      '..m...m..',
    ],
  },
  delta: {
    pal: { G: P.goldHi, g: P.gold, W: P.white, d: P.goldDeep, o: P.outline },
    rows: [
      '....G....',
      '...GGG...',
      '..GgWgG..',
      '.GgggggG.',
      'GggWgWggG',
      '.GgggggG.',
      '..GgggG..',
      '...GGG...',
    ],
  },
  epsilon: {
    pal: { g: P.greenSh, G: P.greenMid, m: P.greenHi, W: P.white, o: P.outline },
    rows: [
      '.........',
      '..gGGGg..',
      '.gGGGGGg.',
      'gGGmWmGGg',
      'gGGmWmGGg',
      '.gGGGGGg.',
      '..gGGGg..',
      '...ggg...',
    ],
  },
};

/** Hostile faction: steel hulls with glowing green / magenta data-eyes. */
const ENEMY_MAPS = {
  striker: {
    pal: { s: P.steelMid, S: P.steel, g: P.green, G: P.greenHi, o: P.outline },
    rows: [
      '......s......',
      '.....sSs.....',
      '..s..sSs..s..',
      '.sSs.sSs.sSs.',
      'sSSSsSSSsSSSs',
      'sSgSSsSsSSgSs',
      '.sSSSSSSSSs..',
      '..sSSsSSSs...',
      '...s.S.S.s...',
      '..s.......s..',
    ],
  },
  wraith: {
    pal: { d: P.steelDeep, M: P.magentaMid, m: P.magentaSh, G: P.magentaHi, o: P.outline },
    rows: [
      '......d......',
      '....dMMMd....',
      '...dMMMMMd...',
      '..dMMMMMMMd..',
      '.dMMGmGmGMMd.',
      'dMMMMmMmMMMMd',
      'dMMmMMMMMmMMd',
      '.dMMMMMMMMMd.',
      '..dMM.M.MMd..',
      '...d..d..d...',
    ],
  },
  sentinel: {
    pal: { s: P.steelMid, S: P.steel, r: P.magentaSh, R: P.magenta, o: P.outline },
    rows: [
      '.....sss.....',
      '....sSSSs....',
      '...sSSSSSs...',
      '..sSSSSSSSs..',
      '.sSSrrrrrSSs.',
      'sSSrRRRRRrSSs',
      '.sSSrrrrrSSs.',
      '..sSSSSSSSs..',
      '...sSSSSSs...',
      '....sSSSs....',
      '..s.s...s.s..',
      '.s...s.s...s.',
    ],
  },
  goliath: {
    pal: { s: P.steelSh, S: P.steel, g: P.greenMid, r: P.magentaSh, R: P.magenta, o: P.outline },
    rows: [
      '......sSSSs......',
      '....sSSSSSSSs....',
      '..sSSSSSSSSSSSs..',
      '.sSSSSgSSSgSSSSs.',
      'sSSSSSSSSSSSSSSSs',
      'sSSrrRRRRRRRrrSSs',
      'sSSSrRRRRRRRrSSSs',
      '.sSSrrRRRRRrrSSs.',
      '..sSSSSSSSSSSSs..',
      '....sSSSSSSSs....',
      '...s..sSSSs..s...',
      '..s....sSs....s..',
      '.s......s......s.',
    ],
  },
  seraph: {
    pal: { s: P.steelSh, S: P.steel, g: P.green, G: P.greenHi, W: P.white, o: P.outline },
    rows: [
      '.....s.....',
      '...s.g.s...',
      '..s.gGg.s..',
      '.sS.gGg.Ss.',
      'sssgGGGgsss',
      '.sSgGWGgSs.',
      'sssgGGGgsss',
      '.sS.gGg.Ss.',
      '..s.gGg.s..',
      '...s.g.s...',
      '.....s.....',
    ],
  },
  vesper: {
    pal: { m: P.magentaSh, M: P.magenta, G: P.magentaHi, o: P.outline },
    rows: [
      '...m...m...',
      '..mMm.mMm..',
      '.mMMMmMMMm.',
      'mMMMMmMMMMm',
      'mMMmGGGmMMm',
      '.mMMMmMMMm.',
      '..mMm.mMm..',
      '...m...m...',
      '..m.....m..',
    ],
  },
  lance: {
    pal: { m: P.violetSh, M: P.violet, G: P.white, d: P.steelDeep, o: P.outline },
    rows: [
      '....m....',
      '...mMm...',
      '..mMMMm..',
      '.mMMMMMm.',
      'mMMmGmMMm',
      'mMMmGmMMm',
      '.mMMMMMm.',
      '..mMMMm..',
      '..mMMMm..',
      '...mMm...',
      '...dMd...',
      '...d.d...',
      '..d...d..',
      '.d.....d.',
    ],
  },
  aegis: {
    pal: { s: P.steelSh, S: P.steel, c: P.cyanSh, C: P.cyan, o: P.outline },
    rows: [
      '......s......',
      '.....sSs.....',
      '....sSSSs....',
      '...sSSSSSs...',
      '..sSSSSSSSs..',
      '.sSScccccSSs.',
      'sSScCCCCCcSSs',
      'sSScCCCCCcSSs',
      '.sSScccccSSs.',
      '..sSSSSSSSs..',
      '...sSSSSSs...',
      '....sSSSs....',
      '.....sSs.....',
    ],
  },
};

/** Treasure gem (7×7) — recoloured per tier. */
const GEM_ROWS = [
  '...c...',
  '..cCc..',
  '.cCCCc.',
  'cCCWCCc',
  '.cCCCc.',
  '..cCc..',
  '...c...',
];

const GEM_PALS = {
  magenta: { c: P.magentaSh, C: P.magenta, W: P.magentaHi },
  green: { c: P.greenSh, C: P.greenMid, W: P.greenHi },
  cyan: { c: P.cyanSh, C: P.cyan, W: P.white },
  gold: { c: P.goldSh, C: P.gold, W: P.goldHi },
};

/** Nova bomb pickup (9×9). */
const NOVA_ROWS = [
  '....g....',
  '..ggGgg..',
  '.gGGGGGg.',
  'gGGWWWGGg',
  'gGWWWWWGg',
  'gGGWWWGGg',
  '.gGGGGGg.',
  '..ggGgg..',
  '....g....',
];

/** Ground relic pod (11×16): a marble plinth carrying a glowing module core. */
const POD_ROWS = [
  '....ccc....',
  '...cCCCc...',
  '..cCCWCCc..',
  '.cCCWWWCCc.',
  '..cCCWCCc..',
  '...cCCCc...',
  '....ccc....',
  '.ooooooooo.',
  '.ommmmmmmo.',
  '.omMMMMMmo.',
  '.omMdddMmo.',
  '.omMMMMMmo.',
  '.ommmmmmmo.',
  '.ooooooooo.',
  '..ooooooo..',
  '...ooooo...',
];

export function buildSprites() {
  const sprites = {
    player: makeSprite(CORE_HALF, SHIP_PAL, { mirror: true }),
    modules: {},
    enemies: {},
    gems: {},
    nova: makeSprite(NOVA_ROWS, { g: P.goldSh, G: P.gold, W: P.goldHi }),
    pod: makeSprite(POD_ROWS, {
      c: P.cyanSh,
      C: P.cyan,
      W: P.cyanHi,
      o: P.outline,
      m: P.marble,
      M: P.marbleMid,
      d: P.cyanDeep,
    }),
  };

  for (const key of Object.keys(MODULE_MAPS)) {
    sprites.modules[key] = makeSprite(MODULE_MAPS[key].rows, MODULE_MAPS[key].pal);
  }
  for (const key of Object.keys(ENEMY_MAPS)) {
    sprites.enemies[key] = makeSprite(ENEMY_MAPS[key].rows, ENEMY_MAPS[key].pal);
  }
  for (const key of Object.keys(GEM_PALS)) {
    sprites.gems[key] = makeSprite(GEM_ROWS, GEM_PALS[key]);
  }

  // Recoloured pod variants per module colour (so the numeral's colour matches).
  const podPalettes = {
    2: { c: P.cyanSh, C: P.cyan, W: P.cyanHi, d: P.cyanDeep },
    3: { c: P.magentaSh, C: P.magenta, W: P.magentaHi, d: P.magentaDeep },
    4: { c: P.goldSh, C: P.gold, W: P.goldHi, d: P.goldDeep },
    5: { c: P.greenSh, C: P.green, W: P.greenHi, d: P.greenDeep },
  };
  sprites.pods = {};
  for (const num of Object.keys(podPalettes)) {
    sprites.pods[num] = makeSprite(POD_ROWS, {
      ...podPalettes[num],
      o: P.outline,
      m: P.marble,
      M: P.marbleMid,
    });
  }

  return sprites;
}

export const SPRITE_NAMES = {
  player: 'player',
  modules: Object.keys(MODULE_MAPS),
  enemies: Object.keys(ENEMY_MAPS),
  gems: Object.keys(GEM_PALS),
};
