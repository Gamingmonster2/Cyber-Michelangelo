/**
 * HD title / attract screen. Replaces the bitmap-font title with polished
 * canvas typography over the HD gardens backdrop, plus a live hero diorama.
 */
import { P, THEMES } from './palette.js';
import { withAlpha, glow } from './pixel.js';
import { formatScore } from '../core/math.js';
import { drawPlayerCraftHD } from './art_player.js';
import { drawEnemyArt } from './art_enemies.js';
import { TITLE_ITEMS } from '../game/game.js';
import { MODULE_BY_ID } from '../game/config.js';

const TAU = Math.PI * 2;
const FONT = '"Bahnschrift", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Bahnschrift", "Consolas", "Segoe UI", monospace';

function setFont(ctx, size, weight = 700, family = FONT, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  try { ctx.letterSpacing = `${tracking}px`; } catch { /* ignore */ }
}

function label(ctx, str, x, y, opts = {}) {
  const { size = 5, weight = 700, color = P.steel, align = 'center', tracking = 1.2, alpha = 1, family = FONT } = opts;
  setFont(ctx, size, weight, family, tracking);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.lineTo(x + w - q, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + q);
  ctx.lineTo(x + w, y + h - q);
  ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  ctx.lineTo(x + q, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - q);
  ctx.lineTo(x, y + q);
  ctx.quadraticCurveTo(x, y, x + q, y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Fake entities for the attract diorama                               */
/* ------------------------------------------------------------------ */

function makeHero(t) {
  const x = 120 + Math.sin(t * 0.6) * 9;
  const y = 322 + Math.sin(t * 1.4) * 3;
  const ids = ['beta', 'gamma', 'delta', 'epsilon'];
  return {
    x,
    y,
    tilt: Math.cos(t * 0.6) * 0.5,
    vx: Math.cos(t * 0.6) * 40,
    vy: 0,
    hitPulse: 0,
    dockAnims: { beta: 1, gamma: 1, delta: 1, epsilon: 1 },
    modules: ids,
    moduleWorldPositions() {
      return ids.map((id) => {
        const slot = MODULE_BY_ID[id].slot;
        return { id, x: x + slot.x, y: y + slot.y, angle: 0, flying: false, docking: false };
      });
    },
  };
}

const ENEMY_SEEDS = [
  { kind: 'striker', baseX: 42, baseY: 128, ampX: 18, ampY: 12, speed: 0.5 },
  { kind: 'wraith', baseX: 198, baseY: 176, ampX: 14, ampY: 18, speed: 0.4 },
  { kind: 'vesper', baseX: 60, baseY: 226, ampX: 24, ampY: 8, speed: 0.7 },
  { kind: 'striker', baseX: 186, baseY: 96, ampX: 12, ampY: 10, speed: 0.6 },
];

function makeEnemies(t) {
  return ENEMY_SEEDS.map((seed, i) => ({
    kind: seed.kind,
    uid: i + 1,
    flash: 0,
    r: 6,
    x: seed.baseX + Math.sin(t * seed.speed + i * 1.7) * seed.ampX,
    y: seed.baseY + Math.cos(t * seed.speed * 0.8 + i) * seed.ampY,
  }));
}

/* ------------------------------------------------------------------ */
/* Decorative beams fired by the hero                                  */
/* ------------------------------------------------------------------ */

function drawHeroBeams(ctx, t, hero) {
  const phase = (t * 0.9) % 1;
  if (phase > 0.4) return;
  const len = (phase / 0.4) * 96;
  for (const off of [-3, 3]) {
    const x = hero.x + off;
    const y0 = hero.y - 14;
    const y1 = y0 - len;
    const g = ctx.createLinearGradient(x, y1, x, y0);
    g.addColorStop(0, withAlpha(P.cyan, 0));
    g.addColorStop(0.7, withAlpha(P.cyan, 0.5));
    g.addColorStop(1, withAlpha(P.white, 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(x - 0.9, y1, 1.8, len);
    glow(ctx, x, y1, 6, P.cyan, 0.4);
  }
  glow(ctx, hero.x, hero.y - 14, 14, P.cyan, 0.25);
}

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

export function drawTitleHD(ctx, time, opts = {}) {
  const { menuIndex = 0, hiScore = 0, bg = null, scale = 2, backdropOnly = false } = opts;
  const theme = THEMES[0];

  if (bg) {
    bg.draw(ctx, theme, time * 9, time, scale);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, theme.skyTop);
    g.addColorStop(1, theme.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 240, 420);
  }

  // Darken the backdrop slightly so typography reads cleanly.
  const dim = ctx.createLinearGradient(0, 0, 0, 420);
  dim.addColorStop(0, 'rgba(4,3,12,0.28)');
  dim.addColorStop(0.45, 'rgba(4,3,12,0.05)');
  dim.addColorStop(0.75, 'rgba(4,3,12,0.28)');
  dim.addColorStop(1, 'rgba(4,3,12,0.64)');
  ctx.fillStyle = dim;
  ctx.fillRect(0, 0, 240, 420);

  // Attract entities.
  const hero = makeHero(time);
  drawHeroBeams(ctx, time, hero);
  for (const enemy of makeEnemies(time)) {
    drawEnemyArt(ctx, enemy, time);
  }
  ctx.save();
  ctx.globalAlpha = 0.35;
  glow(ctx, hero.x, hero.y + 12, 26, P.cyan, 0.3);
  ctx.restore();
  drawPlayerCraftHD(ctx, hero, time);

  // Lightweight mode for menu overlays: no logo/menu/footer chrome.
  if (backdropOnly) return;

  // Tagline.
  setFont(ctx, 4.6, 700, FONT, 3.2);
  ctx.textAlign = 'center';
  ctx.fillStyle = withAlpha(P.cyanMid, 0.95);
  ctx.fillText('A DIGITAL RENAISSANCE', 120, 40);
  setFont(ctx, 4.2, 600, FONT, 4);
  ctx.fillStyle = withAlpha(P.marbleSh, 0.8);
  ctx.fillText('SHOOT EM UP', 120, 49);

  // Wordmark.
  ctx.save();
  setFont(ctx, 43, 900, FONT, 3.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Dark outline pass.
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,6,16,0.95)';
  ctx.lineWidth = 3.4;
  ctx.strokeText('CYBER', 120, 92);
  // Metal gradient fill.
  const logo = ctx.createLinearGradient(0, 52, 0, 96);
  logo.addColorStop(0, '#fffaf0');
  logo.addColorStop(0.28, P.goldHi);
  logo.addColorStop(0.55, P.gold);
  logo.addColorStop(0.78, '#9a6a1c');
  logo.addColorStop(1, P.goldHi);
  ctx.fillStyle = logo;
  ctx.shadowColor = 'rgba(255,209,102,0.5)';
  ctx.shadowBlur = 14;
  ctx.fillText('CYBER', 120, 92);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Sub-wordmark.
  ctx.save();
  setFont(ctx, 15.5, 800, FONT, 7.2);
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(8,6,16,0.9)';
  ctx.lineWidth = 1.8;
  ctx.strokeText('MICHELANGELO', 120, 112);
  const sub = ctx.createLinearGradient(0, 98, 0, 116);
  sub.addColorStop(0, P.marbleHi);
  sub.addColorStop(0.55, P.gold);
  sub.addColorStop(1, P.goldSh);
  ctx.fillStyle = sub;
  ctx.shadowColor = 'rgba(255,209,102,0.35)';
  ctx.shadowBlur = 8;
  ctx.fillText('MICHELANGELO', 120, 112);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Ornamental rule (Arabic subtitle is drawn by the bootstrap at y=138).
  const y = 154;
  const rule = ctx.createLinearGradient(40, 0, 200, 0);
  rule.addColorStop(0, withAlpha(P.gold, 0));
  rule.addColorStop(0.5, withAlpha(P.gold, 0.65));
  rule.addColorStop(1, withAlpha(P.gold, 0));
  ctx.fillStyle = rule;
  ctx.fillRect(40, y, 160, 0.7);
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  ctx.moveTo(120, y - 2.2);
  ctx.lineTo(122.4, y + 0.4);
  ctx.lineTo(120, y + 3);
  ctx.lineTo(117.6, y + 0.4);
  ctx.closePath();
  ctx.fill();
  glow(ctx, 120, y + 0.4, 7, P.goldHi, 0.3);

  // Menu.
  const itemH = 15.5;
  const itemW = 156;
  const startY = 168;
  const itemGap = 20;
  for (let i = 0; i < TITLE_ITEMS.length; i++) {
    const sel = i === menuIndex;
    const iy = startY + i * itemGap;
    const ix = 120 - itemW / 2;
    rr(ctx, ix, iy - 10.5, itemW, itemH, 4.2);
    ctx.fillStyle = sel ? 'rgba(24,18,10,0.72)' : 'rgba(8,7,18,0.6)';
    ctx.fill();
    const border = ctx.createLinearGradient(ix, 0, ix + itemW, 0);
    if (sel) {
      border.addColorStop(0, withAlpha(P.gold, 0.25));
      border.addColorStop(0.5, P.goldHi);
      border.addColorStop(1, withAlpha(P.gold, 0.25));
    } else {
      border.addColorStop(0, withAlpha(P.steelMid, 0.2));
      border.addColorStop(0.5, withAlpha(P.steelMid, 0.55));
      border.addColorStop(1, withAlpha(P.steelMid, 0.2));
    }
    ctx.strokeStyle = border;
    ctx.lineWidth = sel ? 0.9 : 0.5;
    ctx.stroke();
    if (sel) {
      glow(ctx, 120, iy - 3, 40, P.gold, 0.14);
      // Selection arrows.
      setFont(ctx, 7, 700, FONT, 0);
      ctx.textAlign = 'center';
      ctx.fillStyle = P.goldHi;
      ctx.fillText('◀', ix - 8, iy + 0.5);
      ctx.fillText('▶', ix + itemW + 8, iy + 0.5);
    }
    setFont(ctx, 8.2, 800, FONT, 2.1);
    ctx.textAlign = 'center';
    ctx.fillStyle = sel ? P.goldHi : withAlpha(P.marbleMid, 0.9);
    ctx.fillText(TITLE_ITEMS[i], 120, iy + 2.6);
  }

  // Hi-score.
  label(ctx, 'HI-SCORE', 120, 250, { size: 4.8, color: P.cyanMid, tracking: 2.4 });
  setFont(ctx, 15, 800, MONO, 1.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = (() => {
    const g = ctx.createLinearGradient(0, 256, 0, 272);
    g.addColorStop(0, P.marbleHi);
    g.addColorStop(1, P.marbleSh);
    return g;
  })();
  ctx.fillText(formatScore(hiScore), 120, 269);

  // Footer credit line.
  label(ctx, 'INSPIRED BY TERRA CRESTA (1985) · NICHIBUTSU · AI-ASSISTED', 120, 282, {
    size: 4.2, color: withAlpha(P.marbleSh, 0.85), tracking: 0.8,
  });

  // Hero sits below the footer so nothing overlaps.
  // (drawn before the logo above, so only the beams pass behind the type)

  // Press start.
  if (Math.floor(time * 1.6) % 2 === 0) {
    label(ctx, 'PRESS ENTER OR TAP', 120, 404, { size: 5.2, color: P.cyan, tracking: 2.2 });
    glow(ctx, 120, 401, 26, P.cyan, 0.12);
  }

  // Corner flavour.
  label(ctx, 'EST. 2026', 8, 414, { align: 'left', size: 4, color: withAlpha(P.steelMid, 0.7), tracking: 1.6 });
  label(ctx, 'SECTOR 01', 232, 414, { align: 'right', size: 4, color: withAlpha(P.steelMid, 0.7), tracking: 1.6 });
}
