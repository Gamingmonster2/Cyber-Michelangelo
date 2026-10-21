/**
 * HD-2D vector art for the Colossus boss: a baroque marble war-mask flanked
 * by floating fists. Gradients, engravings, animated eyes and damage states.
 */
import { P } from './palette.js';
import { withAlpha, glow } from './pixel.js';

const OUTLINE = P.outline;
const TAU = Math.PI * 2;

function path(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function fillPoly(ctx, pts, style, stroke = null, lw = 0.6) {
  path(ctx, pts);
  ctx.fillStyle = style;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
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

function phaseColors(boss) {
  const phase = boss.phase || 1;
  if (phase >= 3) return { eye: P.red, iris: P.redHi, aura: P.red, glowColor: P.orange };
  if (phase === 2) return { eye: P.magenta, iris: P.magentaHi, aura: P.magenta, glowColor: P.magenta };
  return { eye: P.cyan, iris: P.cyanHi, aura: P.cyan, glowColor: P.cyan };
}

/* ------------------------------------------------------------------ */
/* Floating fist                                                      */
/* ------------------------------------------------------------------ */

function drawFist(ctx, h, boss, colors, t, game) {
  ctx.save();
  ctx.translate(h.x, h.y);
  const hover = Math.sin(t * 1.8 + (h.id === 'left' ? 0 : Math.PI)) * 1.6;
  ctx.translate(0, hover);

  glow(ctx, 0, 4, 24, colors.aura, 0.13);
  // Wrist thruster flames.
  const flick = 0.8 + 0.2 * Math.sin(t * 22 + (h.id === 'left' ? 1 : 3));
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(s * 4, -13, s * 4, -13 - 8 * flick);
    g.addColorStop(0, withAlpha(P.white, 0.8));
    g.addColorStop(0.4, withAlpha(colors.glowColor, 0.6));
    g.addColorStop(1, withAlpha(colors.glowColor, 0));
    ctx.fillStyle = g;
    path(ctx, [[s * 2.4, -13], [s * 5.6, -13], [s * 4, -13 - 8 * flick]]);
    ctx.fill();
  }

  // Dark silhouette.
  fillPoly(ctx, [
    [-12, -11], [12, -11], [14, 3], [8, 13], [-8, 13], [-14, 3],
  ], P.outline, null, 0);
  // Armoured fist plates.
  const plate = ctx.createLinearGradient(0, -10, 0, 12);
  plate.addColorStop(0, P.marbleHi);
  plate.addColorStop(0.45, P.marble);
  plate.addColorStop(1, P.marbleSh);
  fillPoly(ctx, [
    [-10.5, -9], [10.5, -9], [12, 2], [6.5, 11], [-6.5, 11], [-12, 2],
  ], plate, withAlpha(OUTLINE, 0.85), 0.6);
  // Side shadow plate.
  fillPoly(ctx, [
    [2, -8.5], [9.5, -8], [11.5, 2], [6, 10], [2, 9],
  ], withAlpha(P.marbleSh, 0.55));
  // Knuckle plates.
  for (let i = 0; i < 3; i++) {
    rr(ctx, -7.6 + i * 5.2, -6.6, 4, 3.2, 1);
    ctx.fillStyle = P.marbleMid;
    ctx.fill();
    ctx.strokeStyle = withAlpha(OUTLINE, 0.7);
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.fillStyle = withAlpha(P.marbleHi, 0.8);
    ctx.fillRect(-7.2 + i * 5.2, -6.2, 3.2, 0.7);
  }
  // Gold cuff.
  const cuff = ctx.createLinearGradient(0, -12.5, 0, -8.5);
  cuff.addColorStop(0, P.goldHi);
  cuff.addColorStop(0.5, P.gold);
  cuff.addColorStop(1, P.goldSh);
  ctx.fillStyle = cuff;
  ctx.fillRect(-10.5, -12.5, 21, 3.4);
  ctx.strokeStyle = withAlpha(OUTLINE, 0.85);
  ctx.lineWidth = 0.45;
  ctx.strokeRect(-10.5, -12.5, 21, 3.4);
  // Cuff jewels.
  ctx.fillStyle = colors.iris;
  for (let i = 0; i < 3; i++) {
    circle(ctx, -6 + i * 6, -10.8, 0.8);
  }
  // Eye socket + iris that tracks the player.
  circle(ctx, 0, 3.4, 3.6, withAlpha(P.outline, 0.95));
  circle(ctx, 0, 3.4, 2.6, withAlpha(colors.eye, 0.55));
  const p = game && game.player;
  let px = 0;
  let py = 0;
  if (p) {
    const a = Math.atan2(p.y - h.y, p.x - h.x);
    px = Math.cos(a) * 0.9;
    py = Math.sin(a) * 0.9;
  }
  circle(ctx, px, 3.4 + py, 1.4, withAlpha(colors.iris, 0.95));
  circle(ctx, px - 0.3, 3.1 + py, 0.6, P.white);
  glow(ctx, 0, 3.4, 9, colors.glowColor, 0.4 + 0.15 * Math.sin(t * 5));
  // Damage cracks.
  if (h.hp / h.maxHp < 0.6) {
    ctx.strokeStyle = withAlpha(OUTLINE, 0.7);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(-3, -2);
    ctx.lineTo(-5, 2);
    ctx.stroke();
  }
  if (h.flash > 0) {
    ctx.globalAlpha = Math.min(0.8, h.flash * 0.6);
    ctx.fillStyle = P.white;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Head                                                               */
/* ------------------------------------------------------------------ */

function drawHead(ctx, boss, colors, t, game) {
  glow(ctx, 0, 0, 62, colors.aura, 0.16);

  // Outer dark silhouette.
  fillPoly(ctx, [
    [-36, -26], [-22, -40], [0, -45], [22, -40], [36, -26],
    [38, -2], [26, 24], [0, 36], [-26, 24], [-38, -2],
  ], OUTLINE, null, 0);
  // Back shell plates.
  fillPoly(ctx, [
    [-31, -23], [-18, -35], [0, -40], [18, -35], [31, -23], [33, -3],
    [22, 21], [0, 31], [-22, 21], [-33, -3],
  ], P.marbleSh, withAlpha(OUTLINE, 0.8), 0.6);
  // Main face plate with gradient.
  const face = ctx.createLinearGradient(0, -32, 0, 26);
  face.addColorStop(0, P.marbleHi);
  face.addColorStop(0.4, P.marble);
  face.addColorStop(0.8, P.marbleMid);
  face.addColorStop(1, P.marbleSh);
  fillPoly(ctx, [
    [-25, -18], [-14, -28], [0, -32], [14, -28], [25, -18], [27, -2],
    [18, 16], [0, 25], [-18, 16], [-27, -2],
  ], face, withAlpha(OUTLINE, 0.75), 0.6);
  // Sculpted shadow on the right side.
  ctx.globalAlpha = 0.32;
  fillPoly(ctx, [
    [3, -30], [14, -27], [24, -17], [26, -2], [18, 15], [3, 24],
  ], P.marbleSh);
  ctx.globalAlpha = 1;

  // Brow ridge.
  fillPoly(ctx, [
    [-20, -16], [20, -16], [20, -12], [0, -9], [-20, -12],
  ], P.marbleHi, withAlpha(P.marbleSh, 0.8), 0.4);

  // Eyes: deep sockets, glowing irises tracking the player.
  const p = game && game.player;
  for (const s of [-1, 1]) {
    const ex = s * 11.5;
    const ey = -6.5;
    rr(ctx, ex - 7, ey - 5.5, 14, 10, 3);
    ctx.fillStyle = P.outline;
    ctx.fill();
    rr(ctx, ex - 6, ey - 4.5, 12, 8, 2.5);
    ctx.fillStyle = '#0d0916';
    ctx.fill();
    // Iris.
    let ix = 0;
    let iy = 0;
    if (p) {
      const a = Math.atan2(p.y - boss.y - ey, p.x - boss.x - ex);
      ix = Math.cos(a) * 1.3;
      iy = Math.sin(a) * 1.1;
    }
    const iris = ctx.createRadialGradient(ex + ix, ey + iy, 0.4, ex, ey, 4.4);
    iris.addColorStop(0, P.white);
    iris.addColorStop(0.35, colors.iris);
    iris.addColorStop(1, colors.eye);
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ex + ix, ey + iy, 3.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = withAlpha(P.outline, 0.9);
    ctx.beginPath();
    ctx.ellipse(ex + ix, ey + iy, 1.1, 2.6, 0, 0, TAU);
    ctx.fill();
    glow(ctx, ex + ix, ey + iy, 11, colors.glowColor, 0.35 + 0.12 * Math.sin(t * 5 + s));
    // Gold ceremonial line under the eye.
    ctx.strokeStyle = withAlpha(P.gold, 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ex - 7, ey + 7);
    ctx.lineTo(ex + 7, ey + 7);
    ctx.stroke();
  }

  // Nose ridge.
  const nose = ctx.createLinearGradient(-2, 0, 2, 0);
  nose.addColorStop(0, P.marbleHi);
  nose.addColorStop(1, P.marbleSh);
  fillPoly(ctx, [
    [0, -11], [2.6, -3], [3, 7], [0, 9], [-3, 7], [-2.6, -3],
  ], nose, withAlpha(OUTLINE, 0.55), 0.4);

  // Cheek plates + engravings.
  for (const s of [-1, 1]) {
    fillPoly(ctx, [
      [s * 16, -1], [s * 24, -2], [s * 26, 5], [s * 20, 12], [s * 12, 9],
    ], withAlpha(P.marbleMid, 0.9), withAlpha(OUTLINE, 0.4), 0.4);
    // Gold filigree.
    ctx.strokeStyle = withAlpha(P.gold, 0.55);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(s * 14, 10);
    ctx.quadraticCurveTo(s * 20, 8, s * 22, 2);
    ctx.stroke();
    // Glowing circuit dots.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = withAlpha(colors.aura, 0.4 + 0.2 * Math.sin(t * 4 + i + s));
      ctx.beginPath();
      ctx.arc(s * (17 + i * 2.5), 5 + i * 2, 0.7, 0, TAU);
      ctx.fill();
    }
  }

  // Mouth grille with glowing teeth.
  rr(ctx, -13, 13, 26, 8, 2.4);
  ctx.fillStyle = P.outline;
  ctx.fill();
  const teeth = ctx.createLinearGradient(0, 13, 0, 21);
  teeth.addColorStop(0, withAlpha(colors.eye, 0.8));
  teeth.addColorStop(1, withAlpha(colors.glowColor, 0.25));
  for (let i = 0; i < 6; i++) {
    const tx = -12 + i * 4;
    ctx.fillStyle = teeth;
    ctx.fillRect(tx, 14, 2, 6);
  }
  // Chin plate.
  fillPoly(ctx, [
    [-7, 23], [7, 23], [5, 28], [-5, 28],
  ], P.marbleMid, withAlpha(OUTLINE, 0.5), 0.4);

  // Crown band + spikes with jewels.
  const band = ctx.createLinearGradient(0, -38, 0, -31);
  band.addColorStop(0, P.goldHi);
  band.addColorStop(0.5, P.gold);
  band.addColorStop(1, P.goldSh);
  ctx.fillStyle = band;
  ctx.fillRect(-25, -38, 50, 6);
  ctx.strokeStyle = withAlpha(OUTLINE, 0.8);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-25, -38, 50, 6);
  for (let i = 0; i < 5; i++) {
    const sx = -20 + i * 10;
    const rise = i === 2 ? 13 : i % 2 === 0 ? 7 : 10;
    const g = ctx.createLinearGradient(sx, -38 - rise, sx, -38);
    g.addColorStop(0, P.goldHi);
    g.addColorStop(1, P.goldSh);
    fillPoly(ctx, [
      [sx - 3.4, -38], [sx, -38 - rise], [sx + 3.4, -38],
    ], g, withAlpha(OUTLINE, 0.7), 0.4);
    // Jewel.
    ctx.fillStyle = i % 2 === 0 ? P.cyanHi : colors.iris;
    ctx.beginPath();
    ctx.arc(sx, -34.6, 1.1, 0, TAU);
    ctx.fill();
  }
  glow(ctx, 0, -42, 22, P.gold, 0.18);

  // Cracks (grow as HP drops).
  const hpFrac = boss.hp / boss.maxHp;
  ctx.strokeStyle = withAlpha(OUTLINE, 0.75);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-16, -24);
  ctx.lineTo(-11, -17);
  ctx.lineTo(-13, -13);
  ctx.stroke();
  if (hpFrac < 0.66) {
    ctx.beginPath();
    ctx.moveTo(18, -21);
    ctx.lineTo(13, -14);
    ctx.stroke();
  }
  if (hpFrac < 0.33) {
    ctx.beginPath();
    ctx.moveTo(6, 25);
    ctx.lineTo(2, 18);
    ctx.lineTo(-2, 20);
    ctx.stroke();
  }

  // Phase aura overlay.
  if (boss.phase >= 2) {
    ctx.globalAlpha = boss.phase >= 3 ? 0.08 : 0.05;
    fillPoly(ctx, [
      [-25, -18], [-14, -28], [0, -32], [14, -28], [25, -18], [27, -2],
      [18, 16], [0, 25], [-18, 16], [-27, -2],
    ], colors.aura);
    ctx.globalAlpha = 1;
  }

  if (boss.flash > 0) {
    ctx.globalAlpha = Math.min(0.65, boss.flash * 0.5);
    fillPoly(ctx, [
      [-25, -18], [-14, -28], [0, -32], [14, -28], [25, -18], [27, -2],
      [18, 16], [0, 25], [-18, 16], [-27, -2],
    ], P.white);
    ctx.globalAlpha = 1;
  }
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/* ------------------------------------------------------------------ */

export function drawBossHD(ctx, boss, t, game) {
  const colors = phaseColors(boss);
  const dying = boss.state === 'dying';
  const flicker = dying && Math.floor(t * 20) % 2 === 0;

  // Rotating halo rings behind the mask.
  for (let i = 0; i < 2; i++) {
    const r = boss.r + 26 + i * 14;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.strokeStyle = withAlpha(colors.aura, 0.18 - i * 0.05);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    const a0 = t * (i % 2 ? -0.35 : 0.45) + i;
    for (let k = 0; k < 8; k++) {
      const a = a0 + (k / 8) * TAU;
      ctx.fillStyle = withAlpha(colors.aura, 0.5);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.96, 0.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Hands.
  for (const h of boss.hands) {
    if (h.alive) {
      drawFist(ctx, h, boss, colors, t, game);
    } else {
      ctx.save();
      ctx.translate(h.x, h.y);
      // Charred wrist stump with sparks.
      fillPoly(ctx, [[-8, -6], [8, -6], [6, 6], [-6, 6]], withAlpha(P.steelDeep, 0.9), withAlpha(OUTLINE, 0.9), 0.5);
      for (let i = 0; i < 5; i++) {
        const px = -7 + i * 3.4;
        const py = -2 + Math.sin(t * 4 + i) * 2;
        ctx.fillStyle = withAlpha(P.orange, 0.5 + 0.3 * Math.sin(t * 7 + i));
        ctx.beginPath();
        ctx.arc(px, py, 0.8, 0, TAU);
        ctx.fill();
      }
      glow(ctx, 0, 0, 12, P.orange, 0.2);
      ctx.restore();
    }
  }

  if (flicker) return;

  ctx.save();
  ctx.translate(boss.x, boss.y);
  // Slow breathing scale.
  const breathe = 1 + Math.sin(t * 1.6) * 0.008;
  ctx.scale(breathe, breathe);
  drawHead(ctx, boss, colors, t, game);
  ctx.restore();

  // Core glow bleeding through the mouth grille.
  glow(ctx, boss.x, boss.y + 9, 20, colors.aura, 0.14 + 0.05 * Math.sin(t * 3));
}

export const BOSS_PHASE_COLORS = phaseColors;
