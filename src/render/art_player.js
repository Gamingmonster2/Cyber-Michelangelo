/**
 * HD-2D vector art for the player craft.
 *
 * The game still renders in a 240×420 coordinate space, but the buffer is now
 * rasterised at device resolution (2–4×). These vector paths and gradients
 * therefore produce crisp, detailed ships while gameplay coordinates and
 * hitboxes stay exactly as they were.
 */
import { P } from './palette.js';
import { withAlpha, glow, circle } from './pixel.js';
import { MODULE_BY_ID } from '../game/config.js';

const OUTLINE = P.outline;

function path(ctx, points, close = true) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  if (close) ctx.closePath();
}

function fillPoly(ctx, points, style, stroke = null, lineWidth = 0.5) {
  path(ctx, points);
  ctx.fillStyle = style;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Engines                                                             */
/* ------------------------------------------------------------------ */

function drawEngines(ctx, t, p) {
  const throttle = 0.75 + 0.25 * Math.min(1, Math.hypot(p.vx || 0, p.vy || 0) / 80);
  for (const side of [-1, 1]) {
    const x = side * 4.6;
    const y = 12.5;
    const flick = 0.8 + 0.2 * Math.sin(t * 34 + side * 1.7);
    const len = (9 + 4 * flick) * throttle;
    const grad = ctx.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.18, P.cyanHi);
    grad.addColorStop(0.55, withAlpha(P.cyan, 0.55));
    grad.addColorStop(1, withAlpha(P.cyanSh, 0));
    ctx.fillStyle = grad;
    path(ctx, [
      [x - 2.1, y],
      [x + 2.1, y],
      [x + side * 0.4, y + len],
    ]);
    ctx.fill();
    // Inner white-hot core.
    ctx.fillStyle = withAlpha(P.white, 0.85);
    path(ctx, [
      [x - 0.8, y],
      [x + 0.8, y],
      [x, y + len * 0.45],
    ]);
    ctx.fill();
    glow(ctx, x, y + len * 0.35, 7 * flick, P.cyan, 0.35);
  }
}

/* ------------------------------------------------------------------ */
/* Hull                                                                */
/* ------------------------------------------------------------------ */

function drawHull(ctx, t, p) {
  // Rear stabiliser fins (behind the hull).
  for (const side of [-1, 1]) {
    fillPoly(ctx, [
      [side * 3.4, 6],
      [side * 8.6, 11],
      [side * 8.0, 14.5],
      [side * 3.2, 12.5],
    ], P.steelDeep, withAlpha(OUTLINE, 0.9), 0.5);
    fillPoly(ctx, [
      [side * 4.2, 8.2],
      [side * 7.6, 11.2],
      [side * 6.0, 12.6],
    ], withAlpha(P.goldSh, 0.9));
  }

  // Wings.
  for (const side of [-1, 1]) {
    const wing = [
      [side * 3.2, -4.5],
      [side * 16.5, 1.5],
      [side * 16.0, 7.0],
      [side * 10.5, 9.4],
      [side * 4.5, 7.4],
      [side * 2.6, 2.5],
    ];
    const g = ctx.createLinearGradient(0, -5, 0, 10);
    g.addColorStop(0, P.marbleMid);
    g.addColorStop(0.45, P.steel);
    g.addColorStop(1, P.steelDeep);
    fillPoly(ctx, wing, g, withAlpha(OUTLINE, 0.85), 0.55);
    // Leading edge gold trim.
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(side * 3.2, -4.5);
    ctx.lineTo(side * 16.5, 1.5);
    ctx.stroke();
    // Wingtip navigation light (red port / green starboard).
    circle(ctx, side * 15.8, 1.4, 0.9, side < 0 ? P.red : P.green);
    glow(ctx, side * 15.8, 1.4, 3, side < 0 ? P.red : P.green, 0.4 + 0.3 * Math.sin(t * 6 + side));
    // Panel engraving.
    ctx.strokeStyle = withAlpha(OUTLINE, 0.45);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(side * 7, 0.2);
    ctx.lineTo(side * 13.5, 3.4);
    ctx.stroke();
  }

  // Fuselage.
  const fuselage = [
    [0, -21],
    [2.6, -13],
    [4.6, -5],
    [4.2, 4],
    [3.0, 11],
    [1.6, 13.6],
    [-1.6, 13.6],
    [-3.0, 11],
    [-4.2, 4],
    [-4.6, -5],
    [-2.6, -13],
  ];
  const hullGrad = ctx.createLinearGradient(0, -21, 0, 14);
  hullGrad.addColorStop(0, P.marbleHi);
  hullGrad.addColorStop(0.3, P.marble);
  hullGrad.addColorStop(0.75, P.marbleMid);
  hullGrad.addColorStop(1, P.marbleSh);
  fillPoly(ctx, fuselage, hullGrad, withAlpha(OUTLINE, 0.9), 0.6);
  // Central spine plate.
  fillPoly(ctx, [
    [0, -19],
    [1.4, -10],
    [1.6, 8],
    [0.9, 11.5],
    [-0.9, 11.5],
    [-1.6, 8],
    [-1.4, -10],
  ], withAlpha(P.marbleHi, 0.55), withAlpha(P.goldSh, 0.35), 0.35);

  // Gold nose blade.
  fillPoly(ctx, [
    [0, -23.5],
    [1.5, -15],
    [0.9, -11.5],
    [-0.9, -11.5],
    [-1.5, -15],
  ], P.goldHi, withAlpha(P.goldSh, 0.9), 0.4);

  // Cockpit canopy.
  const canopy = ctx.createLinearGradient(0, -10, 0, 1);
  canopy.addColorStop(0, P.cyanHi);
  canopy.addColorStop(0.45, P.cyan);
  canopy.addColorStop(1, P.cyanSh);
  ctx.beginPath();
  ctx.ellipse(0, -5.5, 2.5, 5.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = canopy;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Canopy glint.
  ctx.beginPath();
  ctx.ellipse(-0.7, -7.4, 0.8, 2.0, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(P.white, 0.8);
  ctx.fill();
  glow(ctx, 0, -5.5, 7, P.cyan, 0.18);

  // Intake grilles.
  for (const side of [-1, 1]) {
    fillPoly(ctx, [
      [side * 2.4, -1.5],
      [side * 4.4, -0.4],
      [side * 4.2, 4.0],
      [side * 2.2, 3.2],
    ], P.steelDeep, withAlpha(OUTLINE, 0.8), 0.4);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = withAlpha(P.cyanHi, 0.35);
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(side * (2.7 + i * 0.3), 0.2 + i * 1.1);
      ctx.lineTo(side * (4.1 - i * 0.1), 0.8 + i * 1.1);
      ctx.stroke();
    }
  }

  // Panel lines along the spine.
  ctx.strokeStyle = withAlpha(OUTLINE, 0.4);
  ctx.lineWidth = 0.35;
  for (const y of [-12.2, -1.2, 6.4]) {
    ctx.beginPath();
    ctx.moveTo(-3.3, y);
    ctx.lineTo(3.3, y);
    ctx.stroke();
  }

  // Engine housings + nozzles.
  for (const side of [-1, 1]) {
    roundedRect(ctx, side * 4.6 - 2.1, 9.4, 4.2, 4.4, 1.4);
    ctx.fillStyle = P.steelSh;
    ctx.fill();
    ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
    ctx.lineWidth = 0.4;
    ctx.stroke();
    circle(ctx, side * 4.6, 13.2, 1.5, P.steelDeep);
    circle(ctx, side * 4.6, 13.2, 0.8, P.cyanHi);
  }

  // Sockets for missing modules (amber dash means "empty slot").
  drawSockets(ctx, t);

  // Hit flash.
  if (p.hitPulse > 0.4) {
    ctx.beginPath();
    ctx.ellipse(0, -2, 15, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(P.white, Math.min(0.6, p.hitPulse * 0.5));
    ctx.fill();
  }
}

function drawSockets(ctx, t) {
  const slots = [
    { x: -13.5, y: 1, color: P.cyan },
    { x: 13.5, y: 1, color: P.magenta },
    { x: 0, y: 13, color: P.gold },
    { x: 0, y: -13, color: P.green },
  ];
  const docked = ctx.__dockedSet || null;
  for (const slot of slots) {
    const isDocked = docked ? docked.has(slot) : false;
    if (isDocked) continue;
    ctx.strokeStyle = withAlpha(slot.color, 0.28 + 0.12 * Math.sin(t * 3));
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1.4, 1.4]);
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 4.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ------------------------------------------------------------------ */
/* Modules                                                            */
/* ------------------------------------------------------------------ */

function moduleBase(ctx, color, glowColor, t) {
  glow(ctx, 0, 0, 9, glowColor, 0.22 + 0.07 * Math.sin(t * 4));
}

function drawBetaPod(ctx, t) {
  moduleBase(ctx, P.cyan, P.cyan, t);
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, P.marbleMid);
  g.addColorStop(1, P.steelDeep);
  roundedRect(ctx, -5.5, -4, 11, 8.5, 2.2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Twin forward barrels.
  for (const off of [-2.2, 2.2]) {
    roundedRect(ctx, off - 0.85, -8.2, 1.7, 5, 0.6);
    ctx.fillStyle = P.steelSh;
    ctx.fill();
    ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
    ctx.lineWidth = 0.35;
    ctx.stroke();
    circle(ctx, off, -8.4, 0.75, P.cyanHi);
    glow(ctx, off, -8.4, 2.6, P.cyan, 0.5);
  }
  // Cyan energy stripe.
  ctx.strokeStyle = P.cyan;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-4.4, 1.2);
  ctx.lineTo(4.4, 1.2);
  ctx.stroke();
  // Thruster nub.
  roundedRect(ctx, -1.4, 4.2, 2.8, 1.8, 0.6);
  ctx.fillStyle = withAlpha(P.cyan, 0.7);
  ctx.fill();
}

function drawGammaPod(ctx, t) {
  moduleBase(ctx, P.magenta, P.magenta, t);
  const g = ctx.createLinearGradient(0, -5, 0, 5);
  g.addColorStop(0, P.marbleMid);
  g.addColorStop(1, P.steelDeep);
  roundedRect(ctx, -5.5, -4, 11, 8.5, 2.2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = withAlpha(OUTLINE, 0.95);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Rear-facing angled barrels.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 2.4, 4.6);
    ctx.rotate(side * 0.42);
    roundedRect(ctx, -0.85, 0, 1.7, 5.2, 0.6);
    ctx.fillStyle = P.steelSh;
    ctx.fill();
    ctx.strokeStyle = withAlpha(OUTLINE, 0.9);
    ctx.lineWidth = 0.35;
    ctx.stroke();
    circle(ctx, 0, 5.4, 0.75, P.magentaHi);
    glow(ctx, 0, 5.4, 2.6, P.magenta, 0.5);
    ctx.restore();
  }
  ctx.strokeStyle = P.magenta;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-4.4, -1.2);
  ctx.lineTo(4.4, -1.2);
  ctx.stroke();
}

function drawDeltaPod(ctx, t) {
  moduleBase(ctx, P.gold, P.goldHi, t);
  // Mounting ring.
  ctx.beginPath();
  ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(P.goldSh, 0.9);
  ctx.lineWidth = 1;
  ctx.stroke();
  // Faceted crystal.
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, P.goldHi);
  g.addColorStop(0.5, P.gold);
  g.addColorStop(1, P.goldSh);
  fillPoly(ctx, [
    [0, -9.5],
    [3.6, -3.4],
    [2.6, 4.6],
    [0, 8.4],
    [-2.6, 4.6],
    [-3.6, -3.4],
  ], g, withAlpha(OUTLINE, 0.95), 0.5);
  // Inner charge core.
  fillPoly(ctx, [
    [0, -4.6],
    [1.6, -1],
    [1.1, 3],
    [0, 5.4],
    [-1.1, 3],
    [-1.6, -1],
  ], withAlpha(P.white, 0.8 + 0.2 * Math.sin(t * 5)));
  glow(ctx, 0, 0, 8, P.goldHi, 0.3 + 0.1 * Math.sin(t * 5));
  // Orbiting charge motes.
  for (let i = 0; i < 2; i++) {
    const a = t * 2.6 + i * Math.PI;
    circle(ctx, Math.cos(a) * 6.4, Math.sin(a) * 8, 0.8, P.goldHi);
  }
}

function drawEpsilonPod(ctx, t) {
  moduleBase(ctx, P.green, P.green, t);
  // Emitter ring.
  ctx.beginPath();
  ctx.arc(0, 0, 5.6, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(P.steelDeep, 0.9);
  ctx.fill();
  ctx.strokeStyle = withAlpha(P.greenSh, 0.95);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // Rotating arc segments.
  for (let i = 0; i < 3; i++) {
    const a0 = t * 1.8 + (i * Math.PI * 2) / 3;
    ctx.strokeStyle = i === 0 ? P.greenHi : withAlpha(P.green, 0.7);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, 7.2, a0, a0 + 0.9);
    ctx.stroke();
  }
  // Central emitter.
  circle(ctx, 0, 0, 2.1, withAlpha(P.greenHi, 0.9));
  glow(ctx, 0, 0, 7, P.green, 0.4);
  circle(ctx, 0, 0, 1.0, P.white);
}

export function drawModuleArt(ctx, m, t, p) {
  const def = MODULE_BY_ID[m.id];
  if (!def) return;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(0.9, 0.9);
  if (m.flying) {
    ctx.rotate(Math.sin(t * 2 + m.x * 0.1) * 0.12);
  } else if (m.docking) {
    ctx.scale(0.85 + 0.15 * Math.min(1, (p.dockAnims && p.dockAnims[m.id]) || 0), 0.85 + 0.15 * Math.min(1, (p.dockAnims && p.dockAnims[m.id]) || 0));
  }
  switch (m.id) {
    case 'beta': drawBetaPod(ctx, t); break;
    case 'gamma': drawGammaPod(ctx, t); break;
    case 'delta': drawDeltaPod(ctx, t); break;
    case 'epsilon': drawEpsilonPod(ctx, t); break;
    default: break;
  }
  // Docking clamps flash.
  if (m.docking) {
    const anim = (p.dockAnims && p.dockAnims[m.id]) || 0;
    const a = Math.max(0, 1 - anim / 0.22);
    ctx.strokeStyle = withAlpha(P.white, a * 0.9);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 5.5 + a * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (p.hitPulse > 0.5) {
    ctx.globalAlpha = p.hitPulse * 0.5;
    ctx.fillStyle = P.white;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function drawPlayerCraftHD(ctx, p, t) {
  const modules = p.moduleWorldPositions();
  const dockedIds = new Set(modules.filter((m) => !m.flying).map((m) => m.id));
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(0.86, 0.86);
  // Bank into horizontal movement for a sense of inertia.
  ctx.rotate((p.tilt || 0) * 0.12);
  // Sockets: reuse the same geometry but mark docked modules.
  const dockedSet = {
    has(slot) {
      if (slot.y === 1 && slot.x < 0) return dockedIds.has('beta');
      if (slot.y === 1 && slot.x > 0) return dockedIds.has('gamma');
      if (slot.y > 6) return dockedIds.has('delta');
      if (slot.y < -6) return dockedIds.has('epsilon');
      return false;
    },
  };
  ctx.__dockedSet = dockedSet;
  drawEngines(ctx, t, p);
  drawHull(ctx, t, p);
  ctx.__dockedSet = null;
  ctx.restore();

  for (const m of modules) drawModuleArt(ctx, m, t, p);
}
