/**
 * Cyber Michelangelo palette — a "digital Renaissance in deep space" scheme.
 * Marble & gold for the player's baroque machines, neon cyan/magenta for
 * hostile data, and the orange of the Nova bomb / phoenix flame.
 */
export const P = {
  // Deep space
  void: '#04030a',
  space1: '#0a0718',
  space2: '#100b22',
  space3: '#191036',
  nebulaMagenta: '#3c1038',
  nebulaCyan: '#0a2b3f',
  nebulaGold: '#3a2a12',
  starDim: '#5d7aa0',
  starMid: '#9fc3e6',
  starBright: '#ffffff',
  dust: '#7a86b8',

  // Marble (player machinery)
  marbleHi: '#fffaf0',
  marble: '#f3ecdb',
  marbleMid: '#d6c9ae',
  marbleSh: '#a99a7d',
  marbleDeep: '#6f634f',
  outline: '#171322',

  // Gold (sacred geometry / trim)
  goldHi: '#ffe9a8',
  gold: '#ffd166',
  goldMid: '#e0a63c',
  goldSh: '#a8751f',
  goldDeep: '#5c3d0d',

  // Cyan (player energy / UI)
  cyanHi: '#d0feff',
  cyan: '#5ef2ff',
  cyanMid: '#28c9e8',
  cyanSh: '#127c99',
  cyanDeep: '#073a4a',

  // Magenta (hostile energy)
  magentaHi: '#ffc4e5',
  magenta: '#ff6fc1',
  magentaMid: '#d93a8f',
  magentaSh: '#8d1f5c',
  magentaDeep: '#3d0c27',

  // Green (heal / aura / epsilon field)
  greenHi: '#d4ffe0',
  green: '#7dffa8',
  greenMid: '#38c96a',
  greenSh: '#1c7a3f',
  greenDeep: '#092b16',

  // Orange / flame (nova, phoenix, explosions)
  orangeHi: '#ffd9a0',
  orange: '#ffb347',
  orangeMid: '#ff8a2a',
  orangeSh: '#cf5f1d',
  red: '#ff4d6d',
  redHi: '#ffb3c0',
  redDeep: '#5c0d1c',

  // Metal / enemies
  steelHi: '#c8d8ee',
  steel: '#8fa8c8',
  steelMid: '#5e7392',
  steelSh: '#3d4f6b',
  steelDeep: '#1d2636',
  violet: '#a97cff',
  violetSh: '#4b2a8f',

  // Utility
  white: '#ffffff',
  black: '#000000',
  shadow: 'rgba(0,0,0,0.5)',
};

/** Theme palettes for the three looping stage backdrops. */
export const THEMES = [
  {
    id: 'gardens',
    name: 'THE MARBLE GARDENS',
    // sky
    skyTop: '#0a0d2a',
    skyMid: '#141a45',
    skyLow: '#2a1c4a',
    haze: '#3b2a66',
    planet: '#d8c9a4',
    planetShade: '#8d7f66',
    ring: '#ffd166',
    // silhouette layers (far → near)
    far: '#101538',
    mid: '#161c42',
    near: '#1d1638',
    accent: '#5ef2ff',
    accent2: '#ffd166',
    ground: '#241a3e',
  },
  {
    id: 'catacombs',
    name: 'NEON CATACOMBS',
    skyTop: '#050818',
    skyMid: '#0b1026',
    skyLow: '#131a33',
    haze: '#123a47',
    planet: '#74d7d0',
    planetShade: '#1d6a72',
    ring: '#5ef2ff',
    far: '#070b1c',
    mid: '#0a1224',
    near: '#0d1628',
    accent: '#ff6fc1',
    accent2: '#7dffa8',
    ground: '#0a1420',
  },
  {
    id: 'cathedral',
    name: 'THE GRID CATHEDRAL',
    skyTop: '#0b0518',
    skyMid: '#1c0a2e',
    skyLow: '#2a0f38',
    haze: '#4a1a52',
    planet: '#ffb347',
    planetShade: '#7a3a12',
    ring: '#ffe9a8',
    far: '#150a26',
    mid: '#1d0f33',
    near: '#25133f',
    accent: '#ffd166',
    accent2: '#a97cff',
    ground: '#2a1440',
  },
];

export function themeForStage(stageNumber) {
  return THEMES[(Math.max(1, stageNumber) - 1) % THEMES.length];
}

/** Loop number (1-based) for an endless stage index. */
export function loopForStage(stageNumber) {
  return Math.floor((Math.max(1, stageNumber) - 1) / THEMES.length) + 1;
}
