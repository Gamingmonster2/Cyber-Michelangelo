/**
 * Title / attract screen — painted entirely with the pixel toolkit.
 *
 * Layout (240×420 logical):
 *   44/52  taglines       64–106  logo        118 Arabic (HD overlay by main)
 *   136    ornament       168–246 menu        256–332 attract diorama
 *   340    hi-score       364–384 credits     400 press start
 */
import { P, THEMES } from './palette.js';
import {
  rect, hline, vline, circle, ring, bline, glow, drawSprite, mix, withAlpha, frameRect,
} from './pixel.js';
import { drawText, measureText } from './pixelfont.js';
import { RNG, TAU, formatScore } from '../core/math.js';

const THEME = THEMES[0];

const STARS = (() => {
  const rng = new RNG(1985);
  const layers = [[], [], []];
  for (let i = 0; i < 170; i++) {
    const layer = i % 3;
    layers[layer].push({
      x: rng.range(0, 240),
      y: rng.range(0, 420),
      c: rng.pick([P.starBright, P.starMid, P.starDim, P.cyanHi, P.goldHi]),
      tw: rng.range(0, TAU),
    });
  }
  return layers;
})();

const MENU_ITEMS = ['START MISSION', 'HOW TO PLAY', 'CREDITS', 'OPTIONS'];

/* ------------------------------------------------------------------ */
/* Background                                                         */
/* ------------------------------------------------------------------ */

function drawSky(ctx, time) {
  const stops = [THEME.skyTop, THEME.skyMid, THEME.skyLow, '#160d24'];
  for (let y = 0; y < 420; y += 4) {
    const t = y / 419;
    const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const local = t * (stops.length - 1) - seg;
    ctx.fillStyle = mix(stops[seg], stops[seg + 1], local);
    ctx.fillRect(0, y, 240, 4);
  }
  glow(ctx, 44, 110, 86, P.nebulaMagenta, 0.5);
  glow(ctx, 198, 52, 64, P.nebulaCyan, 0.55);
  glow(ctx, 170, 300, 100, P.nebulaGold, 0.16);

  for (let l = 0; l < STARS.length; l++) {
    const speed = 1.2 + l * 2.2;
    for (const s of STARS[l]) {
      const y = (s.y - time * speed * 4) % 420;
      const yy = y < 0 ? y + 420 : y;
      const twinkle = 0.55 + 0.45 * Math.sin(time * 2.2 + s.tw);
      ctx.globalAlpha = (l === 0 ? 0.5 : l === 1 ? 0.78 : 1) * twinkle;
      rect(ctx, s.x, yy, 1, 1, s.c);
      if (l === 2 && twinkle > 0.93) {
        rect(ctx, s.x - 1, yy, 3, 1, withAlpha(s.c, 0.4));
        rect(ctx, s.x, yy - 1, 1, 3, withAlpha(s.c, 0.4));
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(ctx) {
  const cx = 211;
  const cy = 38;
  const r = 12;
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU;
    const px = cx + Math.cos(a) * 21;
    const py = cy + Math.sin(a) * 5 + 2;
    if (Math.sin(a) > -0.2) rect(ctx, px, py, 1, 1, withAlpha(THEME.ring, 0.7));
  }
  circle(ctx, cx, cy, r, THEME.planet);
  circle(ctx, cx + 2, cy - 2, r - 1, withAlpha('#ffffff', 0.14));
  ctx.fillStyle = THEME.planetShade;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -0.35, 1.8);
  ctx.fill();
  circle(ctx, cx - 4, cy + 3, 2, withAlpha(THEME.planetShade, 0.6));
  circle(ctx, cx + 4, cy + 4, 1, withAlpha(THEME.planetShade, 0.55));
  glow(ctx, cx, cy, 18, THEME.haze, 0.3);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU;
    if (Math.sin(a) > 0.15) {
      rect(ctx, cx + Math.cos(a) * 21, cy + Math.sin(a) * 5 + 2, 1, 1, withAlpha(THEME.ring, 0.9));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Logo                                                               */
/* ------------------------------------------------------------------ */

function drawLogo(ctx, time) {
  const goldGrad = [P.goldHi, P.goldHi, P.gold, P.gold, P.goldMid, P.goldSh, P.goldSh];
  glow(ctx, 120, 84, 76, P.gold, 0.2 + 0.04 * Math.sin(time * 1.6));
  glow(ctx, 120, 90, 42, P.orange, 0.1);

  drawText(ctx, 'A DIGITAL RENAISSANCE', 120, 42, {
    align: 'center', scale: 1, spacing: 1, color: P.cyanMid, alpha: 0.95,
  });
  drawText(ctx, 'SHOOT EM UP', 120, 51, {
    align: 'center', scale: 1, spacing: 2, color: P.marbleSh, alpha: 0.8,
  });

  drawText(ctx, 'CYBER', 120, 63, {
    align: 'center', scale: 4, spacing: 2, color: goldGrad, outline: true,
    outlineColor: P.outline, shadow: { x: 0, y: 2, color: 'rgba(0,0,0,0.55)' },
  });
  drawText(ctx, 'MICHELANGELO', 120, 97, {
    align: 'center', scale: 2, spacing: 1, color: goldGrad, outline: true,
    outlineColor: P.outline, shadow: { x: 0, y: 1, color: 'rgba(0,0,0,0.5)' },
  });

  const y = 136;
  hline(ctx, 40, y, 160, withAlpha(P.goldSh, 0.55));
  rect(ctx, 118, y - 1, 4, 3, P.gold);
  rect(ctx, 119, y - 2, 2, 1, P.goldHi);
  rect(ctx, 46, y, 1, 1, P.cyan);
  rect(ctx, 193, y, 1, 1, P.cyan);
}

/* ------------------------------------------------------------------ */
/* Menu                                                               */
/* ------------------------------------------------------------------ */

function drawMenu(ctx, time, menuIndex) {
  const startY = 158;
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const y = startY + i * 21;
    const sel = i === menuIndex;
    if (sel) {
      glow(ctx, 120, y + 5, 36, P.gold, 0.13 + 0.05 * Math.sin(time * 4));
      drawText(ctx, MENU_ITEMS[i], 120, y, {
        align: 'center', scale: 2, spacing: 1, color: P.goldHi,
        outline: true, outlineColor: P.outline,
      });
      if (Math.floor(time * 3) % 2 === 0) {
        const w = measureText(MENU_ITEMS[i], { scale: 2, spacing: 1 }).w;
        drawText(ctx, '▶', 120 - w / 2 - 11, y + 1, { scale: 1, color: P.gold });
      }
    } else {
      drawText(ctx, MENU_ITEMS[i], 120, y, {
        align: 'center', scale: 2, spacing: 1, color: P.marbleMid,
        outline: true, outlineColor: 'rgba(10,8,20,0.85)',
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Attract diorama — a live little window of the game                 */
/* ------------------------------------------------------------------ */

const DIORAMA = { x: 44, y: 258, w: 152, h: 74 };

function drawDiorama(ctx, sprites, time) {
  const { x, y, w, h } = DIORAMA;
  // Frame.
  rect(ctx, x - 2, y - 2, w + 4, h + 4, withAlpha(P.outline, 0.9));
  frameRect(ctx, x - 1, y - 1, w + 2, h + 2, withAlpha(P.goldSh, 0.8));
  rect(ctx, x, y, w, h, '#070614');

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Mini starfield.
  const rng = new RNG(7);
  for (let i = 0; i < 34; i++) {
    const sx = x + rng.range(0, w);
    const sy = y + ((rng.range(0, h) + time * (6 + (i % 3) * 8)) % h);
    rect(ctx, sx, sy, 1, 1, withAlpha(i % 4 === 0 ? P.cyanHi : P.starMid, 0.5 + (i % 3) * 0.16));
  }
  glow(ctx, x + w / 2, y + h - 8, 30, P.cyanDeep, 0.8);

  // Drifting drones.
  const d1 = x + ((time * 14 + 20) % (w + 20)) - 10;
  const d2 = x + w - ((time * 10 + 60) % (w + 24)) + 6;
  drawSprite(ctx, sprites.enemies.striker, d1, y + 16 + Math.sin(time * 1.7) * 3);
  drawSprite(ctx, sprites.enemies.wraith, d2, y + 30 + Math.cos(time * 1.3) * 4);

  // Player craft with docked modules.
  const shipX = x + w / 2;
  const shipY = y + h - 17 + Math.sin(time * 1.9) * 1.5;
  const flick = 1 + Math.sin(time * 24) * 0.35;
  glow(ctx, shipX, shipY + 8, 8, P.cyan, 0.4);
  rect(ctx, shipX - 3, shipY + 8, 2, Math.round(3 * flick), P.cyan);
  rect(ctx, shipX + 2, shipY + 8, 2, Math.round(3 * flick), P.cyan);
  for (const [key, ox, oy] of [['beta', -8, 1], ['gamma', 8, 1], ['epsilon', -4, -7], ['delta', 4, -7]]) {
    drawSprite(ctx, sprites.modules[key], shipX + ox, shipY + oy + Math.sin(time * 2 + ox) * 0.5);
  }
  drawSprite(ctx, sprites.player, shipX, shipY);

  // Beams — clipped by the diorama, so they never touch the menu.
  const phase = (time * 1.1) % 1;
  if (phase < 0.5) {
    const top = y + 2;
    for (const off of [-2, 2]) {
      rect(ctx, shipX + off, top, 1, shipY - 9 - top, withAlpha(P.cyan, 0.5));
      rect(ctx, shipX + off, top, 1, shipY - 9 - top, withAlpha(P.cyanHi, 0.6));
    }
    glow(ctx, shipX - 2, shipY - 10, 4, P.white, 0.5);
    glow(ctx, shipX + 2, shipY - 10, 4, P.white, 0.5);
  }
  // Tiny score ticker.
  drawText(ctx, formatScore(745320 + Math.floor(time * 130) % 9999), x + 3, y + 3, {
    scale: 1, spacing: 0, color: P.cyanHi, alpha: 0.85,
  });
  drawText(ctx, 'ATTRACT MODE', x + w - 3, y + 3, {
    align: 'right', scale: 1, spacing: 0, color: P.goldMid, alpha: 0.8,
  });

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Footer                                                             */
/* ------------------------------------------------------------------ */

function drawFooter(ctx, time, hiScore) {
  drawText(ctx, 'HI-SCORE', 120, 340, { align: 'center', scale: 1, spacing: 2, color: P.cyanMid });
  drawText(ctx, formatScore(hiScore), 120, 350, {
    align: 'center', scale: 2, spacing: 2, color: P.marbleHi,
    outline: true, outlineColor: P.outline,
  });

  drawText(ctx, 'INSPIRED BY TERRA CRESTA (1985)', 120, 372, {
    align: 'center', scale: 1, spacing: 0, color: P.marbleSh, alpha: 0.85,
  });
  drawText(ctx, 'AI-ASSISTED · ZERO-ASSET PIXEL ENGINE', 120, 381, {
    align: 'center', scale: 1, spacing: 0, color: P.goldSh, alpha: 0.75,
  });

  if (Math.floor(time * 1.6) % 2 === 0) {
    drawText(ctx, 'PRESS ENTER OR TAP', 120, 400, {
      align: 'center', scale: 1, spacing: 1, color: P.cyan, alpha: 0.92,
    });
  }
}

export function drawTitle(ctx, time, opts = {}) {
  const { menuIndex = 0, hiScore = 0, sprites } = opts;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawSky(ctx, time);
  drawPlanet(ctx);
  drawLogo(ctx, time);
  drawMenu(ctx, time, menuIndex);
  drawDiorama(ctx, sprites, time);
  drawFooter(ctx, time, hiScore);

  // Slow light sweep across the title.
  const sweep = ((time * 26) % 340) - 40;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = withAlpha(P.goldHi, 0.022);
  for (let y = 0; y < 420; y += 2) ctx.fillRect(sweep + y * 0.1, y, 14, 2);
  ctx.globalCompositeOperation = 'source-over';
}

export { MENU_ITEMS };
