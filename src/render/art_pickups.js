/**
 * HD-2D vector art for ground pods, module capsules and pickups.
 */
import { P } from './palette.js';
import { withAlpha, glow } from './pixel.js';
import { drawText } from './pixelfont.js';
import { MODULE_DEFS } from '../game/config.js';

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
function colorForNum(num) {
  if (num == null) return { color: P.gold, accent: P.goldHi, deep: P.goldDeep };
  const def = MODULE_DEFS.find((m) => m.num === num);
  if (!def) return { color: P.cyan, accent: P.cyanHi, deep: P.cyanDeep };
  return { color: def.color, accent: def.accent, deep: def.deep || P.steelDeep };
}

/* ------------------------------------------------------------------ */
/* Ground relic pod                                                    */
/* ------------------------------------------------------------------ */

export function drawPodHD(ctx, pod, t) {
  const { color, accent } = colorForNum(pod.num);
  const bob = Math.sin(t * 2 + pod.x * 0.2) * 0.8;
  const x = pod.x;
  const y = pod.y + bob;

  // Shadow on the ground plane.
  ctx.fillStyle = withAlpha(P.black, 0.35);
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 9, 3.2, 0, 0, TAU);
  ctx.fill();

  // Ground glow.
  const groundGlow = ctx.createRadialGradient(x, y + 7, 1, x, y + 7, 16);
  groundGlow.addColorStop(0, withAlpha(color, 0.3));
  groundGlow.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = groundGlow;
  ctx.fillRect(x - 16, y - 9, 32, 32);

  // Marble plinth: stacked slabs with gold trim.
  const plinth = ctx.createLinearGradient(x - 7, 0, x + 7, 0);
  plinth.addColorStop(0, P.marbleSh);
  plinth.addColorStop(0.4, P.marbleHi);
  plinth.addColorStop(0.75, P.marbleMid);
  plinth.addColorStop(1, P.marbleDeep);
  // Base slab.
  rr(ctx, x - 7, y + 3.5, 14, 4.5, 1.2);
  ctx.fillStyle = plinth;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Column shaft.
  const shaft = ctx.createLinearGradient(x - 4.6, 0, x + 4.6, 0);
  shaft.addColorStop(0, P.marbleMid);
  shaft.addColorStop(0.35, P.marbleHi);
  shaft.addColorStop(0.7, P.marble);
  shaft.addColorStop(1, P.marbleSh);
  ctx.fillStyle = shaft;
  ctx.fillRect(x - 4.6, y - 3, 9.2, 7);
  ctx.strokeStyle = withAlpha(OUTLINE, 0.8);
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x - 4.6, y - 3, 9.2, 7);
  // Fluting + gold band.
  ctx.strokeStyle = withAlpha(OUTLINE, 0.22);
  ctx.lineWidth = 0.4;
  for (const ox of [-2.6, -0.2, 2.6]) {
    ctx.beginPath();
    ctx.moveTo(x + ox, y - 2.4);
    ctx.lineTo(x + ox, y + 3.4);
    ctx.stroke();
  }
  ctx.fillStyle = withAlpha(P.gold, 0.55);
  ctx.fillRect(x - 4.6, y - 0.4, 9.2, 0.7);
  // Top cap.
  rr(ctx, x - 5.6, y - 5.2, 11.2, 2.6, 0.9);
  ctx.fillStyle = P.marbleMid;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.85);
  ctx.lineWidth = 0.45;
  ctx.stroke();

  // Relic crystal dome.
  const cy = y - 9.5;
  const dome = ctx.createRadialGradient(x - 2, cy - 3, 0.5, x, cy, 7);
  dome.addColorStop(0, P.marbleHi);
  dome.addColorStop(0.4, withAlpha(accent, 0.95));
  dome.addColorStop(1, withAlpha(color, 0.35));
  ctx.beginPath();
  ctx.arc(x, cy, 6.2, 0, TAU);
  ctx.fillStyle = dome;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Facets.
  ctx.strokeStyle = withAlpha(P.white, 0.35);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(x, cy - 5.4);
  ctx.lineTo(x + 2.4, cy + 0.6);
  ctx.lineTo(x, cy + 5.2);
  ctx.stroke();
  glow(ctx, x, cy, 9, accent, 0.4 + 0.15 * Math.sin(t * 4 + x));

  // Numeral plaque.
  drawText(ctx, pod.num == null ? '*' : String(pod.num), x, y + 12, {
    align: 'center', scale: 1, spacing: 0,
    color: accent,
    shadow: { x: 0.5, y: 0.5, color: 'rgba(0,0,0,0.85)' },
  });

  // Target brackets for the piece the player still needs.
  const bracket = 10.5;
  ctx.strokeStyle = withAlpha(accent, 0.55 + 0.25 * Math.sin(t * 5));
  ctx.lineWidth = 0.8;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * bracket, y + sy * (bracket - 3));
    ctx.lineTo(x + sx * bracket, y + sy * bracket);
    ctx.lineTo(x + sx * (bracket - 3), y + sy * bracket);
    ctx.stroke();
  }

  if (pod.flash > 0) {
    ctx.globalAlpha = Math.min(0.8, pod.flash * 0.6);
    ctx.fillStyle = P.white;
    ctx.beginPath();
    ctx.arc(x, y - 2, 10, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Pickups                                                             */
/* ------------------------------------------------------------------ */

export function drawModulePickupHD(ctx, item, t) {
  const { color, accent } = colorForNum(item.num);
  const pulse = 0.6 + 0.4 * Math.sin(t * 6);
  const x = item.x;
  const y = item.y + Math.sin(t * 3) * 1.2;

  glow(ctx, x, y, 16, color, 0.3 + 0.1 * pulse);
  // Outer energy shell.
  const shell = ctx.createRadialGradient(x, y, 1, x, y, 9);
  shell.addColorStop(0, withAlpha(P.white, 0.9));
  shell.addColorStop(0.35, withAlpha(accent, 0.7));
  shell.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, TAU);
  ctx.fill();
  // Hex capsule.
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 0.6;
    hex.push([x + Math.cos(a) * 5.6, y + Math.sin(a) * 5.6]);
  }
  fillPoly(ctx, hex, withAlpha(P.void, 0.75), withAlpha(accent, 0.8), 0.8);
  // Rotating brackets.
  ctx.strokeStyle = withAlpha(accent, 0.85);
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 2; i++) {
    const a0 = t * 2.2 + i * Math.PI;
    ctx.beginPath();
    ctx.arc(x, y, 8.4, a0, a0 + 1.1);
    ctx.stroke();
  }
  drawText(ctx, String(item.num), x, y - 3, {
    align: 'center', scale: 1, spacing: 0, color: accent,
    shadow: { x: 0.6, y: 0.6, color: 'rgba(0,0,0,0.9)' },
  });
}

export function drawGemHD(ctx, item, t) {
  const relic = Boolean(item.relic);
  const color = relic ? P.gold : P.cyan;
  const accent = relic ? P.goldHi : P.cyanHi;
  const deep = relic ? P.goldDeep : P.cyanDeep;
  const x = item.x;
  const y = item.y + Math.sin(t * 5) * 1.4;
  const spin = Math.sin(t * 2.2) * 0.35;
  glow(ctx, x, y, 9, color, 0.3);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  // Faceted diamond.
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, P.white);
  g.addColorStop(0.35, accent);
  g.addColorStop(1, deep);
  fillPoly(ctx, [[0, -5.4], [4.2, -1.2], [2.8, 4.4], [0, 5.6], [-2.8, 4.4], [-4.2, -1.2]], g, withAlpha(OUTLINE, 0.8), 0.5);
  ctx.strokeStyle = withAlpha(P.white, 0.55);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -4.6);
  ctx.lineTo(0, 4.6);
  ctx.moveTo(-3.6, -1);
  ctx.lineTo(3.6, -1);
  ctx.stroke();
  ctx.restore();
}

export function drawNovaHD(ctx, item, t) {
  const x = item.x;
  const y = item.y + Math.sin(t * 4) * 1.4;
  glow(ctx, x, y, 11, P.orange, 0.35);
  const g = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, 7);
  g.addColorStop(0, P.goldHi);
  g.addColorStop(0.5, P.orange);
  g.addColorStop(1, P.orangeSh);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 6.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // Lightning bolt icon.
  fillPoly(ctx, [
    [x + 1.4, y - 4],
    [x - 1.6, y + 0.4],
    [x, y + 0.2],
    [x - 1.2, y + 4.2],
    [x + 2, y - 1],
    [x + 0.4, y - 0.8],
  ], P.marbleHi);
  // Fuse sparks.
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * 2.1;
    ctx.fillStyle = withAlpha(P.goldHi, 0.7);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 0.6, 0, TAU);
    ctx.fill();
  }
}

export function drawHeartHD(ctx, item, t) {
  const x = item.x;
  const y = item.y + Math.sin(t * 4) * 1.4;
  glow(ctx, x, y, 11, P.red, 0.35);
  ctx.save();
  ctx.translate(x, y);
  const s = 5.4;
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, P.redHi);
  g.addColorStop(0.5, P.red);
  g.addColorStop(1, P.redDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.75);
  ctx.bezierCurveTo(-s * 1.15, -s * 0.2, -s * 0.55, -s * 1.05, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.55, -s * 1.05, s * 1.15, -s * 0.2, 0, s * 0.75);
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.85);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Shine.
  ctx.fillStyle = withAlpha(P.white, 0.6);
  ctx.beginPath();
  ctx.ellipse(-1.8, -2.4, 1.1, 0.8, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}
