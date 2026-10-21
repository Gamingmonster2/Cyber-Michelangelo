/**
 * HD-2D parallax environments.
 *
 * Scenery is prerendered once per (theme, device scale) into large offscreen
 * canvases with vector gradients and glows, then blitted with vertical parallax.
 * This keeps the detailed look cheap enough for 60 fps on phones.
 */
import { P } from './palette.js';
import { makeCanvas, withAlpha } from './pixel.js';
import { RNG, hashSeed, TAU } from '../core/math.js';

const W = 240;
const H = 420;
const TILE_H = 560;
const MAX_BG_SCALE = 3;

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

function gradientV(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function softGlow(ctx, x, y, r, color, alpha = 0.3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.55, withAlpha(color, alpha * 0.4));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function poly(ctx, pts, fill, stroke = null, lw = 0.5) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* Theme painters — each receives a ctx in logical coords with origin  */
/* at the canvas top-left; scenery wraps vertically over TILE_H.       */
/* ------------------------------------------------------------------ */

function paintSky(ctx, theme) {
  gradientV(ctx, 0, 0, W, H, [
    [0, theme.skyTop],
    [0.35, theme.skyMid],
    [0.7, theme.skyLow],
    [1, '#0a0616'],
  ]);
}

function paintNebula(ctx, theme, rng) {
  const tints = [theme.haze, theme.accent2, theme.accent, theme.planet];
  for (let i = 0; i < 7; i++) {
    const x = rng.range(-20, W + 20);
    const y = rng.range(-10, H + 10);
    const r = rng.range(40, 120);
    softGlow(ctx, x, y, r, rng.pick(tints), rng.range(0.08, 0.2));
  }
  // Faint dust stars baked into the sky.
  for (let i = 0; i < 170; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    const r = rng.chance(0.85) ? 0.35 : 0.7;
    ctx.fillStyle = withAlpha(rng.pick([P.starDim, P.starMid, P.starBright, P.cyanHi]), rng.range(0.12, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

/* ---------------------------- gardens ----------------------------- */

function paintGardenFar(ctx, theme, rng) {
  // Distant floating temple islands, hazy blue.
  const far = theme.far;
  for (let i = 0; i < 9; i++) {
    const y = rng.range(0, TILE_H);
    const x = rng.range(-20, W + 20);
    const w = rng.range(26, 52);
    const h = rng.range(8, 18);
    const alpha = rng.range(0.55, 0.85);
    ctx.globalAlpha = alpha;
    // Floating base + rocky underside.
    poly(ctx, [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w / 2 - w * 0.18, y + h * 1.6],
      [x, y + h * 2.6],
      [x - w / 2 + w * 0.2, y + h * 1.6],
    ], far);
    // Temple silhouette: columns + pediment.
    const cH = h * 1.2;
    const cols = 3;
    for (let c = 0; c < cols; c++) {
      const cx = x - w * 0.3 + (c * w * 0.3);
      ctx.fillStyle = far;
      ctx.fillRect(cx - 1, y - cH, 2, cH);
    }
    ctx.fillStyle = far;
    ctx.fillRect(x - w * 0.36, y - cH - 1, w * 0.72, 1.5);
    poly(ctx, [
      [x - w * 0.38, y - cH - 1],
      [x, y - cH - h * 0.75],
      [x + w * 0.38, y - cH - 1],
    ], far);
    // Window lights.
    ctx.fillStyle = withAlpha(theme.accent2, rng.range(0.15, 0.35));
    for (let l = 0; l < 3; l++) {
      ctx.fillRect(x - w * 0.28 + l * (w * 0.28), y - cH * 0.55, 0.8, 2.2);
    }
  }
  ctx.globalAlpha = 1;
  // Ground haze at tile bottom/top seam is hidden by overlap.
  gradientV(ctx, 0, 0, W, 90, [[0, withAlpha(theme.haze, 0.0)], [1, withAlpha(theme.haze, 0.16)]]);
}

function drawColumn(ctx, x, baseY, width, height, theme, style) {
  // Marble shaft with fluting, capital and base.
  const g = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  g.addColorStop(0, theme.mid);
  g.addColorStop(0.35, P.marbleMid);
  g.addColorStop(0.62, P.marble);
  g.addColorStop(1, theme.near);
  ctx.fillStyle = g;
  ctx.fillRect(x - width / 2, baseY - height, width, height);
  // Fluting.
  ctx.strokeStyle = withAlpha(P.outline, 0.14);
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    const fx = x - width / 2 + (i * width) / 4;
    ctx.beginPath();
    ctx.moveTo(fx, baseY - height + 4);
    ctx.lineTo(fx, baseY - 5);
    ctx.stroke();
  }
  // Gold accents.
  ctx.fillStyle = withAlpha(P.gold, 0.35);
  ctx.fillRect(x - width / 2, baseY - height * 0.55, width, 0.6);
  // Capital.
  if (style !== 'broken') {
    const cw = width + 5;
    ctx.fillStyle = P.marbleMid;
    ctx.fillRect(x - cw / 2, baseY - height - 4, cw, 4);
    ctx.fillStyle = withAlpha(P.gold, 0.4);
    ctx.fillRect(x - cw / 2, baseY - height - 4.6, cw, 0.8);
  }
  // Base.
  ctx.fillStyle = P.marbleSh;
  ctx.fillRect(x - width / 2 - 2, baseY - 3, width + 4, 3);
  // Neon moss.
  ctx.fillStyle = withAlpha(theme.accent, 0.25);
  ctx.fillRect(x + width * 0.2, baseY - height * 0.3, 0.8, 3);
}

function paintGardenMid(ctx, theme, rng) {
  // Floating temple fragments across the whole screen width.
  for (let i = 0; i < 5; i++) {
    const y = rng.range(20, TILE_H);
    const x = rng.range(36, W - 36);
    const w = rng.range(40, 74);
    const h = rng.range(22, 38);
    // Base slab with rocky underside.
    ctx.globalAlpha = 0.97;
    const baseGrad = ctx.createLinearGradient(x - w / 2, y - 6, x - w / 2, y + 4);
    baseGrad.addColorStop(0, P.marbleMid);
    baseGrad.addColorStop(1, theme.near);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(x - w / 2, y - 6, w, 6);
    poly(ctx, [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w * 0.3, y + h * 0.4],
      [x, y + h],
      [x - w * 0.32, y + h * 0.4],
    ], theme.near);
    // Gold rim + neon underglow.
    ctx.fillStyle = withAlpha(P.gold, 0.4);
    ctx.fillRect(x - w / 2, y - 6, w, 0.7);
    softGlow(ctx, x, y + 2, w * 0.5, theme.accent, 0.12);
    // Two pillars + broken arch.
    const colH = h * 0.95;
    const left = x - w * 0.3;
    const right = x + w * 0.3;
    drawColumn(ctx, left, y - 5, 4.5, colH, theme, 'full');
    drawColumn(ctx, right, y - 5, 4.5, colH * 0.72, theme, 'broken');
    // Arch segments between the two columns.
    ctx.strokeStyle = P.marbleMid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 5 - colH, w * 0.3, Math.PI, TAU * 0.86);
    ctx.stroke();
    // Hanging vines.
    for (let v = 0; v < 3; v++) {
      const vx = x - w * 0.38 + v * (w * 0.26);
      ctx.strokeStyle = withAlpha(theme.accent2, 0.3);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(vx, y - 5);
      ctx.quadraticCurveTo(vx + 2, y + 8, vx - 1, y + 14 + v * 3);
      ctx.stroke();
      ctx.fillStyle = withAlpha(theme.accent, 0.45);
      ctx.beginPath();
      ctx.arc(vx - 1, y + 14 + v * 3, 0.9, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Columns across the width for depth.
  for (let i = 0; i < 7; i++) {
    const x = rng.range(4, W - 4);
    const y = rng.range(30, TILE_H);
    const h = rng.range(26, 54);
    drawColumn(ctx, x, y, rng.range(3.5, 6), h, theme, rng.chance(0.3) ? 'broken' : 'full');
  }
}

function paintGardenNear(ctx, theme, rng) {
  // Foreground broken arcades framing the play area edges.
  for (const side of [-1, 1]) {
    const x = side < 0 ? rng.range(-6, 16) : rng.range(W - 16, W + 6);
    for (let i = 0; i < 3; i++) {
      const y = rng.range(40, TILE_H - 20);
      const h = rng.range(70, 130);
      const w = rng.range(16, 26);
      // Dark column silhouette with marble rim light.
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, '#120b22');
      g.addColorStop(0.55, theme.near);
      g.addColorStop(1, '#0d0718');
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y - h, w, h + 30);
      // Rim light on the inner edge.
      ctx.fillStyle = withAlpha(theme.accent, 0.13);
      ctx.fillRect(x + side * (w / 2 - 1.4), y - h, 1.2, h);
      // Gold bands.
      ctx.fillStyle = withAlpha(P.gold, 0.2);
      ctx.fillRect(x - w / 2, y - h + 12, w, 1);
      ctx.fillRect(x - w / 2, y - h * 0.55, w, 0.8);
      // Broken capital.
      ctx.fillStyle = theme.near;
      ctx.fillRect(x - w / 2 - 2, y - h - 4, w + 4, 4);
      ctx.fillStyle = withAlpha(theme.accent2, 0.18);
      ctx.fillRect(x - w / 2 - 2, y - h - 4.6, w + 4, 0.8);
    }
  }
  // Hanging chains / vines in the foreground.
  for (let i = 0; i < 4; i++) {
    const x = rng.range(10, W - 10);
    const y = rng.range(0, TILE_H);
    const len = rng.range(14, 34);
    ctx.strokeStyle = withAlpha(P.outline, 0.35);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y - len);
    ctx.quadraticCurveTo(x + rng.range(-5, 5), y - len / 2, x, y);
    ctx.stroke();
  }
}

/* --------------------------- catacombs ---------------------------- */

function paintCatacombFar(ctx, theme, rng) {
  const far = theme.far;
  // Jagged cave silhouettes from both edges.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y = i * (TILE_H / 4) + rng.range(0, 40);
      const depth = rng.range(26, 56);
      ctx.fillStyle = withAlpha(far, 0.9);
      ctx.beginPath();
      ctx.moveTo(side < 0 ? 0 : W, y);
      ctx.lineTo(side < 0 ? depth : W - depth, y + rng.range(10, 30));
      ctx.lineTo(side < 0 ? depth * 0.6 : W - depth * 0.6, y + 80);
      ctx.lineTo(side < 0 ? 0 : W, y + 120);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Rune circles etched into the far wall.
  for (let i = 0; i < 5; i++) {
    const x = rng.range(24, W - 24);
    const y = rng.range(20, TILE_H);
    const r = rng.range(9, 20);
    const color = rng.chance(0.5) ? theme.accent2 : theme.accent;
    ctx.strokeStyle = withAlpha(color, 0.18);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      ctx.strokeStyle = withAlpha(color, 0.16);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 2.5), y + Math.sin(a) * (r - 2.5));
      ctx.lineTo(x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1));
      ctx.stroke();
    }
    softGlow(ctx, x, y, r * 1.8, color, 0.06);
  }
}

function paintCatacombMid(ctx, theme, rng) {
  // Stalactites & stalagmites with rim light.
  for (const up of [true, false]) {
    for (let i = 0; i < 7; i++) {
      const x = rng.range(6, W - 6);
      const y = rng.range(0, TILE_H);
      const len = rng.range(22, 64);
      const w = rng.range(4, 12);
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, theme.near);
      g.addColorStop(0.7, theme.mid);
      g.addColorStop(1, withAlpha(theme.accent, 0.25));
      ctx.fillStyle = g;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(x - w / 2, y - len);
        ctx.lineTo(x + w / 2, y - len);
        ctx.lineTo(x + w * 0.1, y);
      } else {
        ctx.moveTo(x - w / 2, y + len);
        ctx.lineTo(x + w / 2, y + len);
        ctx.lineTo(x + w * 0.1, y);
      }
      ctx.closePath();
      ctx.fill();
      // Wet highlight.
      ctx.strokeStyle = withAlpha(theme.accent2, 0.18);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(x - w * 0.3, y - len + 2);
        ctx.lineTo(x - w * 0.05, y - 4);
      } else {
        ctx.moveTo(x - w * 0.3, y + len - 2);
        ctx.lineTo(x - w * 0.05, y + 4);
      }
      ctx.stroke();
      // Glowing tip.
      if (rng.chance(0.4)) {
        softGlow(ctx, x, up ? y - 2 : y + 2, 6, theme.accent, 0.16);
      }
    }
  }
  // Crystal clusters (the light sources of the catacombs).
  for (let i = 0; i < 5; i++) {
    const x = rng.range(16, W - 16);
    const y = rng.range(20, TILE_H);
    const accent = rng.chance(0.5) ? theme.accent2 : theme.accent;
    const h = rng.range(14, 30);
    softGlow(ctx, x, y - h * 0.4, h * 1.6, accent, 0.22);
    const shards = [
      { ox: 0, len: h, w: 3.2 },
      { ox: -5, len: h * 0.7, w: 2.4 },
      { ox: 5, len: h * 0.55, w: 2 },
    ];
    for (const s of shards) {
      const g = ctx.createLinearGradient(x + s.ox, y - s.len, x + s.ox, y);
      g.addColorStop(0, withAlpha(accent, 0.95));
      g.addColorStop(0.45, withAlpha(accent, 0.55));
      g.addColorStop(1, withAlpha(theme.near, 0.15));
      poly(ctx, [
        [x + s.ox, y - s.len],
        [x + s.ox + s.w / 2, y - s.len * 0.45],
        [x + s.ox + s.w * 0.3, y],
        [x + s.ox - s.w * 0.3, y],
        [x + s.ox - s.w / 2, y - s.len * 0.45],
      ], g);
      ctx.strokeStyle = withAlpha(P.white, 0.22);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + s.ox, y - s.len + 1);
      ctx.lineTo(x + s.ox, y - 2);
      ctx.stroke();
    }
  }
}

function paintCatacombNear(ctx, theme, rng) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side < 0 ? rng.range(-8, 14) : rng.range(W - 14, W + 8);
      const y = rng.range(30, TILE_H);
      const h = rng.range(60, 120);
      const w = rng.range(14, 24);
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, '#05070d');
      g.addColorStop(0.6, theme.near);
      g.addColorStop(1, '#03040a');
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y - h, w, h + 40);
      ctx.fillStyle = withAlpha(theme.accent, 0.1);
      ctx.fillRect(x + side * (w / 2 - 1.2), y - h, 1, h);
      // Glowing rune marks.
      for (let r = 0; r < 4; r++) {
        const ry = y - h + 12 + r * 16;
        ctx.fillStyle = withAlpha(theme.accent2, rng.range(0.1, 0.28));
        ctx.fillRect(x - 1.5 + rng.range(-1, 1), ry, 3, 0.9);
      }
    }
  }
}

/* --------------------------- cathedral ---------------------------- */

function paintCathedralFar(ctx, theme, rng) {
  // Distant gothic skyline.
  for (let i = 0; i < 10; i++) {
    const x = rng.range(-10, W + 10);
    const y = rng.range(0, TILE_H);
    const w = rng.range(10, 22);
    const h = rng.range(40, 90);
    ctx.fillStyle = withAlpha(theme.far, 0.95);
    ctx.fillRect(x - w / 2, y - h, w, h);
    // Spire.
    poly(ctx, [
      [x - w / 2, y - h],
      [x, y - h - w * 1.7],
      [x + w / 2, y - h],
    ], withAlpha(theme.far, 0.95));
    // Lit lancet windows.
    for (let l = 0; l < 3; l++) {
      const wy = y - h + 12 + l * 16;
      if (rng.chance(0.7)) {
        ctx.fillStyle = withAlpha(theme.accent2, rng.range(0.18, 0.42));
        ctx.fillRect(x - 1, wy, 2, 5);
        softGlow(ctx, x, wy + 2, 4, theme.accent2, 0.1);
      }
    }
  }
}

function paintCathedralMid(ctx, theme, rng) {
  // Flying buttresses and tall stained-glass windows.
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side < 0 ? rng.range(8, 60) : rng.range(W - 60, W - 8);
    const y = rng.range(20, TILE_H);
    const h = rng.range(50, 100);
    // Pier.
    const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    g.addColorStop(0, theme.near);
    g.addColorStop(1, theme.mid);
    ctx.fillStyle = g;
    ctx.fillRect(x - 4, y - h, 8, h);
    // Buttress arm.
    ctx.strokeStyle = withAlpha(theme.mid, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + side * 2, y - h * 0.75);
    ctx.quadraticCurveTo(x + side * 22, y - h * 0.6, x + side * 26, y - h * 0.15);
    ctx.stroke();
    // Stained glass window.
    const wx = x + side * 22;
    const wy = y - h * 0.62;
    const ww = 10;
    const wh = 26;
    const glass = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    glass.addColorStop(0, withAlpha(theme.accent, 0.55));
    glass.addColorStop(0.5, withAlpha(theme.accent2, 0.45));
    glass.addColorStop(1, withAlpha(theme.ring, 0.35));
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(wx - ww / 2, wy + wh);
    ctx.lineTo(wx - ww / 2, wy + ww);
    ctx.quadraticCurveTo(wx, wy - ww * 0.8, wx + ww / 2, wy + ww);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.closePath();
    ctx.fill();
    // Muntins.
    ctx.strokeStyle = withAlpha(theme.near, 0.9);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(wx, wy + 2);
    ctx.lineTo(wx, wy + wh);
    ctx.moveTo(wx - ww / 2, wy + wh * 0.55);
    ctx.lineTo(wx + ww / 2, wy + wh * 0.55);
    ctx.stroke();
    softGlow(ctx, wx, wy + wh / 2, 20, theme.accent2, 0.12);
    // Pinnacle.
    poly(ctx, [
      [x - 5, y - h],
      [x, y - h - 10],
      [x + 5, y - h],
    ], withAlpha(theme.mid, 0.95));
  }
  // Distant spires between the windows.
  for (let i = 0; i < 4; i++) {
    const x = rng.range(20, W - 20);
    const y = rng.range(20, TILE_H);
    const h = rng.range(30, 60);
    const w = rng.range(6, 12);
    ctx.fillStyle = withAlpha(theme.mid, 0.85);
    ctx.fillRect(x - w / 2, y - h, w, h);
    poly(ctx, [
      [x - w / 2, y - h],
      [x, y - h - w * 2.2],
      [x + w / 2, y - h],
    ], withAlpha(theme.mid, 0.85));
    ctx.fillStyle = withAlpha(theme.accent2, 0.2);
    ctx.fillRect(x - 0.6, y - h + 8, 1.2, 3);
  }
}

function paintCathedralNear(ctx, theme, rng) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side < 0 ? rng.range(-6, 16) : rng.range(W - 16, W + 6);
      const y = rng.range(24, TILE_H);
      const h = rng.range(70, 130);
      const w = rng.range(16, 26);
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, '#080411');
      g.addColorStop(0.6, theme.near);
      g.addColorStop(1, '#05020c');
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y - h, w, h + 40);
      ctx.fillStyle = withAlpha(theme.accent, 0.12);
      ctx.fillRect(x + side * (w / 2 - 1.3), y - h, 1.1, h);
      // Stained glass strip on the pier.
      const glass = ctx.createLinearGradient(x, y - h * 0.7, x, y - h * 0.3);
      glass.addColorStop(0, withAlpha(theme.accent2, 0.35));
      glass.addColorStop(1, withAlpha(theme.ring, 0.15));
      ctx.fillStyle = glass;
      ctx.fillRect(x - 2, y - h * 0.7, 4, h * 0.4);
      ctx.strokeStyle = withAlpha(theme.near, 0.9);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.7);
      ctx.lineTo(x, y - h * 0.3);
      ctx.stroke();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pre-render bundle                                                   */
/* ------------------------------------------------------------------ */

const PAINTERS = {
  gardens: { far: paintGardenFar, mid: paintGardenMid, near: paintGardenNear },
  catacombs: { far: paintCatacombFar, mid: paintCatacombMid, near: paintCatacombNear },
  cathedral: { far: paintCathedralFar, mid: paintCathedralMid, near: paintCathedralNear },
};

function paintLayer(theme, layer, scale, seed) {
  const canvas = makeCanvas(W * scale, TILE_H * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const rng = new RNG(hashSeed(seed, theme.id, layer));
  const painter = PAINTERS[theme.id] ? PAINTERS[theme.id][layer] : paintGardenMid;
  painter(ctx, theme, rng);
  return canvas;
}

const PLANETS = {
  gardens: { x: 196, y: 66, r: 27, style: 'ringed' },
  catacombs: { x: 120, y: 42, r: 16, style: 'crystalEye' },
  cathedral: { x: 120, y: 88, r: 38, style: 'rose' },
};

export class BackgroundHD {
  constructor() {
    this.key = '';
    this.data = null;
  }

  ensure(theme, scale) {
    const bgScale = Math.min(scale, MAX_BG_SCALE);
    const key = `${theme.id}@${bgScale}`;
    if (this.key === key && this.data) return this.data;
    const rng = new RNG(hashSeed(theme.id, 'hd-bg'));
    const sky = makeCanvas(W * bgScale, H * bgScale);
    const sctx = sky.getContext('2d');
    sctx.setTransform(bgScale, 0, 0, bgScale, 0, 0);
    paintSky(sctx, theme);
    paintNebula(sctx, theme, new RNG(hashSeed(theme.id, 'nebula')));

    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: rng.range(0, W),
        y: rng.range(0, H),
        r: rng.chance(0.8) ? 0.3 : 0.6,
        phase: rng.range(0, TAU),
        color: rng.pick([P.starBright, P.starMid, P.cyanHi, P.goldHi]),
      });
    }
    const dust = [];
    for (let i = 0; i < 34; i++) {
      dust.push({
        x: rng.range(0, W),
        y: rng.range(0, H),
        speed: rng.range(6, 20),
        r: rng.chance(0.75) ? 0.4 : 0.9,
        color: rng.chance(0.6) ? theme.accent : theme.accent2,
        alpha: rng.range(0.15, 0.45),
        phase: rng.range(0, TAU),
      });
    }

    this.data = {
      theme,
      bgScale,
      sky,
      stars,
      dust,
      planet: PLANETS[theme.id] || PLANETS.gardens,
      far: paintLayer(theme, 'far', bgScale, 11),
      mid: paintLayer(theme, 'mid', bgScale, 22),
      near: paintLayer(theme, 'near', bgScale, 33),
    };
    this.key = key;
    return this.data;
  }

  /** Draw the full parallax backdrop. `ctx` is in logical (240×420) space. */
  draw(ctx, theme, scroll, time, scale = 2) {
    const data = this.ensure(theme, scale);
    ctx.drawImage(data.sky, 0, 0, W, H);

    // Twinkling stars.
    for (const s of data.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.6 + s.phase));
      ctx.globalAlpha = tw;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.7 + tw * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.drawCelestial(ctx, data, time);

    const layers = [
      { canvas: data.far, speed: 0.22, alpha: 0.9 },
      { canvas: data.mid, speed: 0.55, alpha: 1 },
      { canvas: data.near, speed: 1.12, alpha: 1 },
    ];
    for (const layer of layers) {
      const offset = -((scroll * layer.speed) % TILE_H);
      ctx.globalAlpha = layer.alpha;
      ctx.drawImage(layer.canvas, 0, offset, W, TILE_H);
      ctx.drawImage(layer.canvas, 0, offset + TILE_H, W, TILE_H);
      ctx.globalAlpha = 1;
    }

    // Theme-specific atmosphere.
    if (theme.id === 'cathedral') this.drawGridFloor(ctx, theme, scroll, time);
    if (theme.id === 'gardens') this.drawLightRays(ctx, theme, time);
    if (theme.id === 'catacombs') this.drawDrips(ctx, theme, time);

    // Drifting dust motes.
    for (const d of data.dust) {
      const y = ((d.y - time * d.speed) % H + H) % H;
      const tw = 0.5 + 0.5 * Math.sin(time * 2 + d.phase);
      ctx.globalAlpha = d.alpha * tw;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x + Math.sin(time * 0.6 + d.phase) * 2, y, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawCelestial(ctx, data, time) {
    const { planet, theme } = data;
    const pulse = 0.6 + 0.4 * Math.sin(time * 1.1);
    const x = planet.x;
    const y = planet.y + Math.sin(time * 0.25) * 2;

    if (planet.style === 'rose') {
      // Cathedral rose window.
      softGlow(ctx, x, y, planet.r * 1.9, theme.ring, 0.22 * pulse);
      ctx.fillStyle = withAlpha(theme.planetShade, 0.35);
      ctx.beginPath();
      ctx.arc(x, y, planet.r, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + time * 0.05;
        const rx = x + Math.cos(a) * planet.r * 0.6;
        const ry = y + Math.sin(a) * planet.r * 0.6;
        const petal = ctx.createRadialGradient(rx, ry, 0, rx, ry, planet.r * 0.28);
        petal.addColorStop(0, withAlpha(theme.ring, 0.75));
        petal.addColorStop(1, withAlpha(theme.planet, 0.05));
        ctx.fillStyle = petal;
        ctx.beginPath();
        ctx.arc(rx, ry, planet.r * 0.24, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = withAlpha(theme.ring, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, planet.r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(theme.planet, 0.4);
      ctx.beginPath();
      ctx.arc(x, y, planet.r * 0.74, 0, TAU);
      ctx.stroke();
      // Center jewel.
      const jewel = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, planet.r * 0.2);
      jewel.addColorStop(0, P.white);
      jewel.addColorStop(0.4, theme.ring);
      jewel.addColorStop(1, withAlpha(theme.ring, 0));
      ctx.fillStyle = jewel;
      ctx.beginPath();
      ctx.arc(x, y, planet.r * 0.2, 0, TAU);
      ctx.fill();
      // Slow orbit sparks.
      for (let i = 0; i < 8; i++) {
        const a = time * 0.2 + (i / 8) * TAU;
        ctx.fillStyle = withAlpha(theme.ring, 0.6);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * planet.r * 1.12, y + Math.sin(a) * planet.r * 1.12, 0.7, 0, TAU);
        ctx.fill();
      }
    } else if (planet.style === 'crystalEye') {
      // Catacombs crystal heart.
      softGlow(ctx, x, y, planet.r * 2.4, theme.accent, 0.2 * pulse);
      poly(ctx, [
        [x, y - planet.r],
        [x + planet.r * 0.7, y - planet.r * 0.2],
        [x, y + planet.r],
        [x - planet.r * 0.7, y - planet.r * 0.2],
      ], withAlpha(theme.planet, 0.5));
      poly(ctx, [
        [x, y - planet.r * 0.7],
        [x + planet.r * 0.4, y - planet.r * 0.1],
        [x, y + planet.r * 0.7],
        [x - planet.r * 0.4, y - planet.r * 0.1],
      ], withAlpha(theme.planetShade, 0.8));
      ctx.strokeStyle = withAlpha(theme.accent, 0.6);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y - planet.r);
      ctx.lineTo(x, y + planet.r);
      ctx.stroke();
      softGlow(ctx, x, y, planet.r * 0.5, P.white, 0.25);
    } else {
      // Gardens ringed moon.
      softGlow(ctx, x, y, planet.r * 2.1, theme.ring, 0.16 * pulse);
      // Ring behind.
      ctx.strokeStyle = withAlpha(theme.ring, 0.55);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(x, y + 3, planet.r * 1.9, planet.r * 0.42, -0.18, Math.PI * 1.02, Math.PI * 1.98);
      ctx.stroke();
      // Body.
      const g = ctx.createRadialGradient(x - planet.r * 0.35, y - planet.r * 0.4, planet.r * 0.2, x, y, planet.r);
      g.addColorStop(0, P.marbleHi);
      g.addColorStop(0.55, theme.planet);
      g.addColorStop(1, theme.planetShade);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, planet.r, 0, TAU);
      ctx.fill();
      // Craters.
      ctx.fillStyle = withAlpha(theme.planetShade, 0.5);
      for (const [cx, cy, cr] of [[-8, 6, 3.6], [7, 9, 2.4], [-4, -9, 2], [11, -5, 1.6]]) {
        ctx.beginPath();
        ctx.arc(x + cx, y + cy, cr, 0, TAU);
        ctx.fill();
      }
      // Ring in front.
      ctx.strokeStyle = withAlpha(theme.ring, 0.75);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(x, y + 3, planet.r * 1.9, planet.r * 0.42, -0.18, -0.1, Math.PI * 0.98);
      ctx.stroke();
    }
  }

  drawLightRays(ctx, theme, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 80;
      const alpha = 0.03 + 0.012 * Math.sin(time * 0.7 + i);
      const g = ctx.createLinearGradient(x, 0, x + 40, H);
      g.addColorStop(0, withAlpha(theme.ring, alpha));
      g.addColorStop(0.6, withAlpha(theme.ring, alpha * 0.4));
      g.addColorStop(1, withAlpha(theme.ring, 0));
      ctx.fillStyle = g;
      poly(ctx, [
        [x - 12, 0],
        [x + 26, 0],
        [x + 70, H],
        [x + 20, H],
      ], g);
    }
    ctx.restore();
  }

  drawDrips(ctx, theme, time) {
    // Occasional falling drop glints.
    for (let i = 0; i < 6; i++) {
      const t = (time * 0.35 + i * 0.37) % 1;
      const x = 30 + ((i * 47) % 180);
      const y = t * H;
      ctx.globalAlpha = 0.25 * (1 - t);
      ctx.fillStyle = withAlpha(theme.accent2, 0.7);
      ctx.beginPath();
      ctx.arc(x, y, 0.7, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawGridFloor(ctx, theme, scroll, time) {
    const horizon = 250;
    const grad = ctx.createLinearGradient(0, horizon, 0, H);
    grad.addColorStop(0, withAlpha(theme.ground, 0.15));
    grad.addColorStop(1, withAlpha('#05020c', 0.75));
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizon, W, H - horizon);
    // Receding horizontal lines.
    ctx.strokeStyle = withAlpha(theme.accent2, 0.18);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 16; i++) {
      const t = ((i / 16) + ((scroll * 0.6) % 14) / 14 / 16) % 1;
      const y = horizon + Math.pow(t, 2.0) * (H - horizon);
      ctx.globalAlpha = 0.1 + t * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Converging verticals.
    ctx.strokeStyle = withAlpha(theme.accent2, 0.16);
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath();
      ctx.moveTo(120 + i * 44, horizon);
      ctx.lineTo(120 + i * 20, H);
      ctx.stroke();
    }
    // Glow at the horizon.
    softGlow(ctx, 120, horizon, 70, theme.accent, 0.16);
    ctx.strokeStyle = withAlpha(theme.accent, 0.3);
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(W, horizon);
    ctx.stroke();
    // Rose reflection on the floor.
    for (let i = 0; i < 5; i++) {
      const y = horizon + 10 + i * 15;
      ctx.globalAlpha = 0.09 - i * 0.012;
      ctx.strokeStyle = theme.ring;
      ctx.beginPath();
      ctx.moveTo(120 - 16 + i * 2, y);
      ctx.lineTo(120 + 16 - i * 2, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
