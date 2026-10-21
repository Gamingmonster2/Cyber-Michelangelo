/**
 * HD-2D vector art for hostile craft. Same coordinate space as the game;
 * rendered at device resolution so the ships keep crisp plating details.
 */
import { P } from './palette.js';
import { withAlpha, glow, circle } from './pixel.js';

const OUTLINE = P.outline;
const TAU = Math.PI * 2;

function path(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function fillPoly(ctx, pts, style, stroke = null, lw = 0.5) {
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
function hullGrad(ctx, y0, y1, c0, c1, c2) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(0.55, c1);
  g.addColorStop(1, c2);
  return g;
}
function eye(ctx, x, y, color, r = 1.6, t = 0) {
  circle(ctx, x, y, r, withAlpha(color, 0.95));
  circle(ctx, x - r * 0.3, y - r * 0.3, Math.max(0.4, r * 0.4), P.white);
  glow(ctx, x, y, r * 3.2, color, 0.45 + 0.2 * Math.sin(t * 5 + x));
}
function engine(ctx, x, y, color, t, w = 2.4, len = 4.5) {
  const flick = 0.8 + 0.2 * Math.sin(t * 26 + x);
  const g = ctx.createLinearGradient(x, y, x, y + len * flick);
  g.addColorStop(0, withAlpha(P.white, 0.9));
  g.addColorStop(0.5, withAlpha(color, 0.7));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  path(ctx, [[x - w / 2, y], [x + w / 2, y], [x, y + len * flick]]);
  ctx.fill();
}

/* ------------------------------------------------------------------ */

function striker(ctx, t, e) {
  // Small drone: forward arrow silhouette with a green sensor eye.
  fillPoly(ctx, [
    [-9, -6], [-4, -9], [0, -10.5], [4, -9], [9, -6],
    [6, 2], [2.4, 5], [0, 8], [-2.4, 5], [-6, 2],
  ], hullGrad(ctx, -10, 8, P.steelMid, P.steel, P.steelDeep), withAlpha(OUTLINE, 0.95), 0.6);
  // Wings.
  for (const s of [-1, 1]) {
    fillPoly(ctx, [
      [s * 6, -4], [s * 12, -2], [s * 11, 3], [s * 5, 1],
    ], hullGrad(ctx, -4, 3, P.steel, P.steelMid, P.steelSh), withAlpha(OUTLINE, 0.9), 0.45);
    fillPoly(ctx, [[s * 9.2, -1.6], [s * 11.4, -1.2], [s * 10.8, 2], [s * 8.6, 1.4]], withAlpha(P.greenSh, 0.9));
  }
  // Armour plate lines.
  ctx.strokeStyle = withAlpha(OUTLINE, 0.45);
  ctx.lineWidth = 0.4;
  for (const y of [-5.4, 1.2]) {
    ctx.beginPath(); ctx.moveTo(-4.6, y); ctx.lineTo(4.6, y); ctx.stroke();
  }
  eye(ctx, 0, 1.6, P.greenHi, 2, t + e.uid);
  engine(ctx, -3.2, 6.8, P.green, t, 2, 4);
  engine(ctx, 3.2, 6.8, P.green, t, 2, 4);
}

function wraith(ctx, t, e) {
  // Crescent stealth interceptor, magenta reactor.
  const g = hullGrad(ctx, -12, 10, P.steelDeep, P.magentaSh, '#2a0d20');
  fillPoly(ctx, [
    [0, 9.5], [4.5, 3.5], [11, 0.5], [8, -5], [3, -8.5],
    [0, -10.5], [-3, -8.5], [-8, -5], [-11, 0.5], [-4.5, 3.5],
  ], g, withAlpha(OUTLINE, 0.95), 0.6);
  // Forward blade edges.
  for (const s of [-1, 1]) {
    fillPoly(ctx, [
      [s * 8, -4.4], [s * 12.5, 0.4], [s * 4.6, 4.2],
    ], hullGrad(ctx, -4, 4, P.magenta, P.magentaMid, P.magentaSh), withAlpha(OUTLINE, 0.9), 0.45);
    // Engine strip.
    fillPoly(ctx, [[s * 2, -9.6], [s * 6.5, -6.6], [s * 2.6, -6.2]], withAlpha(P.magentaHi, 0.8));
  }
  // Core.
  circle(ctx, 0, -1.5, 2.5, withAlpha(P.magentaDeep, 0.95));
  circle(ctx, 0, -1.5, 1.5, withAlpha(P.magentaHi, 0.95));
  glow(ctx, 0, -1.5, 7, P.magenta, 0.5 + 0.15 * Math.sin(t * 6));
  eye(ctx, 0, 4.6, P.magentaHi, 1.2, t + e.uid);
  engine(ctx, -4.6, -8.4, P.magenta, t, 2, 3.4);
  engine(ctx, 4.6, -8.4, P.magenta, t, 2, 3.4);
}

function sentinel(ctx, t, e) {
  // Ground turret: armoured dome on a slab, red sensor.
  ctx.fillStyle = withAlpha(P.steelDeep, 0.95);
  rr(ctx, -10, 6.5, 20, 5, 1.6);
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Dome.
  const dome = ctx.createLinearGradient(0, -8, 0, 7);
  dome.addColorStop(0, P.steelHi);
  dome.addColorStop(0.5, P.steel);
  dome.addColorStop(1, P.steelSh);
  ctx.beginPath();
  ctx.arc(0, 0, 9, Math.PI, TAU);
  ctx.fillStyle = dome;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Armour bands.
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = withAlpha(OUTLINE, 0.35);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, 3.6 + i * 3.4, Math.PI + 0.3, TAU - 0.3);
    ctx.stroke();
  }
  // Barrel.
  rr(ctx, -1.6, 3.4, 3.2, 7, 0.8);
  ctx.fillStyle = P.steelMid;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
  ctx.lineWidth = 0.4;
  ctx.stroke();
  eye(ctx, 0, -1.4, P.magentaHi, 2.2, t + e.uid);
  // Rivets.
  for (const x of [-7, -4, 4, 7]) circle(ctx, x, 5.2, 0.5, withAlpha(P.steelDeep, 0.9));
}

function goliath(ctx, t, e) {
  // Heavy gunship with side cannons and a magenta reactor.
  fillPoly(ctx, [
    [-7, -10], [0, -13.5], [7, -10], [10, -4], [13, 2],
    [9, 9], [4, 12], [0, 10.5], [-4, 12], [-9, 9], [-13, 2], [-10, -4],
  ], hullGrad(ctx, -13, 12, P.steelHi, P.steel, P.steelDeep), withAlpha(OUTLINE, 0.98), 0.7);
  // Armour plating on each side.
  for (const s of [-1, 1]) {
    fillPoly(ctx, [
      [s * 4, -9], [s * 9.5, -6], [s * 12, 1], [s * 8, 7.5], [s * 4, 8.5],
    ], hullGrad(ctx, -9, 9, P.steel, P.steelMid, P.steelSh), withAlpha(OUTLINE, 0.85), 0.45);
    // Side cannon pods.
    rr(ctx, s * 12 - 2.4, -3.4, 4.8, 10, 1.4);
    ctx.fillStyle = P.steelSh;
    ctx.fill();
    ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
    ctx.lineWidth = 0.45;
    ctx.stroke();
    circle(ctx, s * 12, 6.4, 1.2, P.magentaHi);
    glow(ctx, s * 12, 6.4, 4, P.magenta, 0.4);
    // Engine block.
    rr(ctx, s * 6 - 2, -12, 4, 4, 1);
    ctx.fillStyle = withAlpha(P.steelDeep, 0.95);
    ctx.fill();
    engine(ctx, s * 6, -8.2, P.orange, t, 2.6, 5);
  }
  // Reactor.
  circle(ctx, 0, 1.6, 4, withAlpha(P.magentaDeep, 0.95));
  circle(ctx, 0, 1.6, 2.4, withAlpha(P.magenta, 0.95));
  circle(ctx, 0, 1.6, 1.2, P.magentaHi);
  glow(ctx, 0, 1.6, 11, P.magenta, 0.45 + 0.15 * Math.sin(t * 4));
  // Eye strip.
  eye(ctx, -4.4, -4.4, P.magentaHi, 1.1, t + e.uid);
  eye(ctx, 4.4, -4.4, P.magentaHi, 1.1, t + e.uid + 1);
  // Panel lines.
  ctx.strokeStyle = withAlpha(OUTLINE, 0.35);
  ctx.lineWidth = 0.35;
  for (const y of [-1.4, 5.4]) { ctx.beginPath(); ctx.moveTo(-7, y); ctx.lineTo(7, y); ctx.stroke(); }
}

function seraph(ctx, t, e) {
  // Seeded mine: armoured orb with spikes and a green core.
  const spikes = 8;
  ctx.strokeStyle = withAlpha(P.steelSh, 0.95);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU + t * 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 4.4, Math.sin(a) * 4.4);
    ctx.lineTo(Math.cos(a) * 8.6, Math.sin(a) * 8.6);
    ctx.stroke();
    circle(ctx, Math.cos(a) * 8.6, Math.sin(a) * 8.6, 0.8, withAlpha(P.steelMid, 0.9));
  }
  const orb = ctx.createRadialGradient(-2, -2, 1, 0, 0, 6.4);
  orb.addColorStop(0, P.steelHi);
  orb.addColorStop(0.6, P.steelSh);
  orb.addColorStop(1, P.steelDeep);
  circle(ctx, 0, 0, 6.4, orb);
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, 0, TAU);
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Green core eye.
  circle(ctx, 0, 0, 2.6, withAlpha(P.greenDeep, 0.95));
  circle(ctx, 0, 0, 1.5, withAlpha(P.greenHi, 0.95));
  glow(ctx, 0, 0, 9, P.green, 0.5 + 0.2 * Math.sin(t * 5 + e.uid));
}

function vesper(ctx, t, e) {
  // Fast dart.
  fillPoly(ctx, [
    [0, 8], [3.4, 2], [6.4, -3], [2.6, -6], [0, -8],
    [-2.6, -6], [-6.4, -3], [-3.4, 2],
  ], hullGrad(ctx, -8, 8, P.magentaHi, P.magentaMid, P.magentaSh), withAlpha(OUTLINE, 0.95), 0.5);
  fillPoly(ctx, [[0, 6.6], [1.6, 1], [0, -5.6], [-1.6, 1]], withAlpha(P.marbleHi, 0.75));
  eye(ctx, 0, 1.8, P.white, 1.1, t + e.uid);
  engine(ctx, 0, -6.6, P.orange, t, 2.2, 4.5);
  engine(ctx, -2.6, -5.6, P.magenta, t, 1.4, 3);
  engine(ctx, 2.6, -5.6, P.magenta, t, 1.4, 3);
}

function lance(ctx, t, e) {
  // Long-barrelled sniper, violet charge core.
  fillPoly(ctx, [
    [-4.4, -9], [0, -11], [4.4, -9], [5.4, -2], [3.2, 8],
    [0, 11], [-3.2, 8], [-5.4, -2],
  ], hullGrad(ctx, -11, 11, P.steelHi, P.steelMid, P.steelDeep), withAlpha(OUTLINE, 0.98), 0.6);
  // Long barrel.
  rr(ctx, -1.1, 6, 2.2, 12, 0.7);
  ctx.fillStyle = P.steelSh;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.4;
  ctx.stroke();
  // Charge coils.
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = withAlpha(P.violet, 0.6);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-2.4, 8 + i * 2.6);
    ctx.lineTo(2.4, 8 + i * 2.6);
    ctx.stroke();
  }
  circle(ctx, 0, -1.6, 3, withAlpha(P.violetSh, 0.9));
  circle(ctx, 0, -1.6, 1.8, withAlpha(P.violet, 0.95));
  glow(ctx, 0, -1.6, 8, P.violet, 0.5 + (e.charging > 0 ? 0.4 : 0.1));
  eye(ctx, 0, 2.4, P.violetSh, 1.1, t + e.uid);
  engine(ctx, -3, -8.4, P.violet, t, 1.6, 3.4);
  engine(ctx, 3, -8.4, P.violet, t, 1.6, 3.4);
}

function aegis(ctx, t, e) {
  // Shield warden: heavy hex hull with cyan barrier plates.
  fillPoly(ctx, [
    [0, -11], [7.5, -7], [10, 0], [7.5, 7], [0, 11], [-7.5, 7], [-10, 0], [-7.5, -7],
  ], hullGrad(ctx, -11, 11, P.steelHi, P.steel, P.steelDeep), withAlpha(OUTLINE, 0.98), 0.65);
  // Inner plate.
  fillPoly(ctx, [
    [0, -7.6], [5, -4.8], [6.8, 0], [5, 4.8], [0, 7.6], [-5, 4.8], [-6.8, 0], [-5, -4.8],
  ], withAlpha(P.steelMid, 0.75));
  // Cyan barrier emitters on the flanks.
  for (const s of [-1, 1]) {
    ctx.strokeStyle = withAlpha(P.cyan, 0.85);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, 9.4, s > 0 ? -0.75 : Math.PI - 0.75, s > 0 ? 0.75 : Math.PI + 0.75);
    ctx.stroke();
    circle(ctx, s * 8.4, -0.6, 1.1, P.cyanHi);
    glow(ctx, s * 8.4, -0.6, 4, P.cyan, 0.5);
  }
  // Core.
  circle(ctx, 0, 0, 3.2, withAlpha(P.cyanDeep, 0.9));
  circle(ctx, 0, 0, 2, withAlpha(P.cyan, 0.95));
  circle(ctx, 0, 0, 0.9, P.white);
  glow(ctx, 0, 0, 10, P.cyan, 0.4 + 0.15 * Math.sin(t * 3 + e.uid));
  eye(ctx, 0, -4.6, P.cyanHi, 0.9, t + e.uid);
}

const DRAWERS = { striker, wraith, sentinel, goliath, seraph, vesper, lance, aegis };

/**
 * Draw one enemy with its per-kind HD vector art.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} e enemy instance
 * @param {number} t global render clock
 */
export function drawEnemyArt(ctx, e, t) {
  const drawer = DRAWERS[e.kind];
  if (!drawer) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  // Slight bank for diving enemies.
  if (e.kind === 'vesper') ctx.rotate(clampAngle((e.vx || 0) * 0.004));
  if (e.flash > 0.7) {
    // Strong hit flash: brighten the whole craft.
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 40);
  }
  drawer(ctx, t, e);
  ctx.globalAlpha = 1;
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(0.75, e.flash * 0.55);
    ctx.fillStyle = P.white;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(7, e.r + 4), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function clampAngle(a) {
  return Math.max(-0.5, Math.min(0.5, a));
}

export const ENEMY_ART_KINDS = Object.keys(DRAWERS);
