/**
 * HD-2D UI: HUD, boss bar, banner, popups and touch controls.
 * Uses system typography with gradients and glow instead of the bitmap font.
 */
import { P } from './palette.js';
import { withAlpha, glow } from './pixel.js';
import { MODULE_DEFS, MODULE_BY_ID } from '../game/config.js';
import { formatScore } from '../core/math.js';
import { TOUCH } from '../ui/touch.js';

const TAU = Math.PI * 2;
const FONT = '"Bahnschrift", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Bahnschrift", "Consolas", "Segoe UI", monospace';

function setFont(ctx, size, weight = 600, family = FONT, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  try {
    ctx.letterSpacing = `${tracking}px`;
  } catch {
    /* letterSpacing unsupported */
  }
}

function textGradient(ctx, x0, y0, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x0, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
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

function drawHeartIcon(ctx, x, y, s, color) {
  const g = ctx.createLinearGradient(x, y - s, x, y + s);
  g.addColorStop(0, P.redHi);
  g.addColorStop(1, color || P.red);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.7);
  ctx.bezierCurveTo(x - s * 1.2, y - s * 0.25, x - s * 0.6, y - s * 1.1, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.2, y - s * 0.25, x, y + s * 0.7);
  ctx.fill();
}

function label(ctx, str, x, y, opts = {}) {
  const { size = 5, weight = 700, color = P.steel, align = 'left', tracking = 1.2, alpha = 1, family = FONT } = opts;
  setFont(ctx, size, weight, family, tracking);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

export function drawHudHD(ctx, game) {
  const { player } = game;

  // Frosted dark strip with a fine gradient edge.
  const panel = ctx.createLinearGradient(0, 0, 0, 34);
  panel.addColorStop(0, 'rgba(6,5,16,0.92)');
  panel.addColorStop(0.8, 'rgba(6,5,16,0.78)');
  panel.addColorStop(1, 'rgba(6,5,16,0.35)');
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, 240, 34);
  const edge = ctx.createLinearGradient(0, 33, 240, 33);
  edge.addColorStop(0, withAlpha(P.cyan, 0));
  edge.addColorStop(0.3, withAlpha(P.cyan, 0.45));
  edge.addColorStop(0.7, withAlpha(P.gold, 0.4));
  edge.addColorStop(1, withAlpha(P.gold, 0));
  ctx.fillStyle = edge;
  ctx.fillRect(0, 33, 240, 0.8);

  // SCORE.
  label(ctx, 'SCORE', 6, 7, { color: P.steelMid });
  setFont(ctx, 12.5, 800, MONO, 0.8);
  ctx.textAlign = 'left';
  ctx.fillStyle = textGradient(ctx, 6, 10, 24, [[0, P.marbleHi], [0.7, P.marble], [1, P.marbleSh]]);
  ctx.fillText(formatScore(game.score), 6, 22);
  glow(ctx, 30, 18, 20, P.cyan, 0.04);

  // LIVES.
  label(ctx, 'LIVES', 120, 7, { align: 'center', color: P.steelMid });
  const lives = Math.max(0, game.lives);
  const shown = Math.min(lives, 5);
  const spacing = 8;
  let hx = 120 - ((shown - 1) * spacing) / 2;
  for (let i = 0; i < shown; i++) {
    drawHeartIcon(ctx, hx + i * spacing, 15, 3.2);
  }
  if (lives > 5) label(ctx, 'x' + lives, 120 + ((shown - 1) * spacing) / 2 + 8, 18, { color: P.redHi, tracking: 0 });

  // STAGE.
  const stageNo = String(game.stage).padStart(2, '0');
  label(ctx, `STAGE ${stageNo}`, 234, 7, { align: 'right', color: P.steelMid });
  setFont(ctx, 6.6, 700, FONT, 1.6);
  ctx.textAlign = 'right';
  ctx.fillStyle = textGradient(ctx, 0, 10, 17, [[0, P.gold], [1, P.goldMid]]);
  ctx.fillText(game.stagePlan ? game.stagePlan.name : '', 234, 16);
  if (game.loop > 1) {
    label(ctx, `LOOP ${game.loop}`, 234, 24, { align: 'right', color: P.steelMid, size: 4.6 });
  }

  // NOVA charge (bottom-left of the strip).
  const novaY = 27;
  label(ctx, 'NOVA', 6, novaY + 2, { color: game.novas > 0 ? P.orange : P.steelMid, size: 5 });
  // Small bomb icon.
  ctx.beginPath();
  ctx.arc(29, novaY, 2.6, 0, TAU);
  const bomb = ctx.createRadialGradient(28, novaY - 1, 0.3, 29, novaY, 2.8);
  bomb.addColorStop(0, P.goldHi);
  bomb.addColorStop(1, game.novas > 0 ? P.orangeSh : P.steelSh);
  ctx.fillStyle = bomb;
  ctx.fill();
  if (game.novas > 0) glow(ctx, 29, novaY, 6, P.orange, 0.3);
  setFont(ctx, 6.4, 800, MONO, 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = game.novas > 0 ? P.orangeHi : P.steelMid;
  ctx.fillText('x' + game.novas, 33, novaY + 2.4);

  // Combo multiplier.
  if (game.multiplier > 1) {
    const hot = game.multiplier >= 4;
    const y = novaY + 2.6;
    setFont(ctx, 9.5, 900, FONT, 0.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = textGradient(ctx, 0, y - 8, y + 1, hot ? [[0, P.orangeHi], [1, P.red]] : [[0, P.goldHi], [1, P.goldMid]]);
    ctx.fillText('x' + game.multiplier, 120, y);
    glow(ctx, 120, y - 3, 10, hot ? P.red : P.gold, 0.2);
  }

  // Module shield pips.
  const pipW = 13;
  const pipH = 9;
  const gap = 2.5;
  const startX = 234 - (MODULE_DEFS.length * (pipW + gap)) + gap;
  for (let i = 0; i < MODULE_DEFS.length; i++) {
    const def = MODULE_DEFS[i];
    const x = startX + i * (pipW + gap);
    const y = 21;
    const docked = player.modules.includes(def.id);
    rr(ctx, x, y, pipW, pipH, 2);
    ctx.fillStyle = docked ? withAlpha(def.color, 0.22) : 'rgba(10,9,20,0.65)';
    ctx.fill();
    ctx.strokeStyle = docked ? withAlpha(def.color, 0.95) : withAlpha(P.steelSh, 0.5);
    ctx.lineWidth = 0.55;
    ctx.stroke();
    if (docked) glow(ctx, x + pipW / 2, y + pipH / 2, 7, def.color, 0.25);
    setFont(ctx, 5.4, 800, MONO, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = docked ? def.accent : withAlpha(P.steelMid, 0.9);
    ctx.fillText(String(def.num), x + pipW / 2, y + pipH / 2 + 0.3);
  }
  ctx.textBaseline = 'alphabetic';

  // Formation cooldown sliver under the pips.
  if (player.formationCooldown > 0) {
    const frac = 1 - player.formationCooldown / 2.8;
    const w = 40;
    ctx.fillStyle = withAlpha(P.cyanSh, 0.35);
    ctx.fillRect(234 - w, 31.6, w, 0.8);
    ctx.fillStyle = P.cyan;
    ctx.fillRect(234 - w, 31.6, w * frac, 0.8);
  }
}

export function drawBossBarHD(ctx, game) {
  const boss = game.boss;
  if (!boss || boss.state === 'enter') return;
  const x = 8;
  const w = 224;
  const y = 36;
  setFont(ctx, 5.6, 700, FONT, 1.4);
  ctx.textAlign = 'left';
  ctx.fillStyle = P.redHi;
  ctx.fillText(boss.name, x, y + 5);
  // Track.
  rr(ctx, x, y + 8, w, 4.5, 2.2);
  ctx.fillStyle = 'rgba(6,5,16,0.85)';
  ctx.fill();
  ctx.strokeStyle = withAlpha(P.redHi, 0.35);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  const frac = Math.max(0, boss.totalHp / boss.totalMaxHp);
  const colorA = boss.phase >= 3 ? P.red : boss.phase === 2 ? P.magenta : P.cyan;
  const colorB = boss.phase >= 3 ? P.orange : boss.phase === 2 ? P.magentaHi : P.cyanHi;
  const fill = (w - 2) * frac;
  if (fill > 0.5) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, colorA);
    g.addColorStop(1, colorB);
    rr(ctx, x + 1, y + 9, fill, 2.5, 1.2);
    ctx.fillStyle = g;
    ctx.fill();
    glow(ctx, x + fill / 2, y + 10.3, 18, colorA, 0.16);
  }
  // Hand status pips.
  for (let i = 0; i < boss.hands.length; i++) {
    const h = boss.hands[i];
    const bx = x + w - 12 + i * 7;
    ctx.fillStyle = h.alive ? P.marbleMid : withAlpha(P.steelSh, 0.35);
    rr(ctx, bx, y + 9, 5, 3, 1);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Banner / popups                                                     */
/* ------------------------------------------------------------------ */

export function drawBannerHD(ctx, game) {
  const b = game.banner;
  if (!b) return;
  const fadeIn = Math.min(1, b.t / 0.25);
  const fadeOut = Math.min(1, Math.max(0, (b.life - b.t) / 0.45));
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;
  const colors = {
    gold: [P.goldHi, P.gold],
    cyan: [P.cyanHi, P.cyanMid],
    red: [P.redHi, P.red],
  }[b.color] || [P.goldHi, P.gold];
  const blink = b.color === 'red' ? (Math.floor(b.t * 5) % 2 === 0 ? 1 : 0.45) : 1;
  const y = 150;
  ctx.save();
  ctx.globalAlpha = alpha * blink;
  setFont(ctx, 24, 900, FONT, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = textGradient(ctx, 0, y - 22, y, [[0, colors[0]], [0.55, colors[1]], [1, colors[0]]]);
  ctx.shadowColor = colors[1];
  ctx.shadowBlur = 10;
  ctx.fillText(b.text, 120, y);
  ctx.shadowBlur = 0;
  if (b.sub) {
    label(ctx, b.sub, 120, y + 12, { align: 'center', size: 5.6, color: P.marbleHi, tracking: 2, alpha: 0.9 });
  }
  const lineW = 120;
  const lg = ctx.createLinearGradient(120 - lineW / 2, 0, 120 + lineW / 2, 0);
  lg.addColorStop(0, withAlpha(colors[1], 0));
  lg.addColorStop(0.5, withAlpha(colors[1], 0.7));
  lg.addColorStop(1, withAlpha(colors[1], 0));
  ctx.fillStyle = lg;
  ctx.fillRect(120 - lineW / 2, y + 17, lineW, 0.6);
  ctx.restore();
}

export function drawPopupsHD(ctx, game) {
  const COLORS = {
    cyan: P.cyan, gold: P.gold, red: P.red, orange: P.orange,
    green: P.green, steel: P.steel, white: P.marbleHi, magenta: P.magenta,
  };
  for (const p of game.popups) {
    const fade = p.t > p.life * 0.6 ? 1 - (p.t - p.life * 0.6) / (p.life * 0.4) : 1;
    const rise = p.t * 16;
    const color = COLORS[p.color] || P.marbleHi;
    setFont(ctx, 6.2, 800, FONT, 1);
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.max(0, fade);
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = color;
    ctx.fillText(p.text, p.x, p.y - rise);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

export function drawFormationHudHD(ctx, game) {
  const p = game.player;
  if (!p.formationActive) return;
  const left = 1 - p.formationTime / 3.4;
  const w = 60;
  rr(ctx, 120 - w / 2, 34.5, w, 1.6, 0.8);
  ctx.fillStyle = 'rgba(6,5,16,0.7)';
  ctx.fill();
  if (left > 0) {
    rr(ctx, 120 - w / 2, 34.5, w * Math.max(0, left), 1.6, 0.8);
    const g = ctx.createLinearGradient(120 - w / 2, 0, 120 + w / 2, 0);
    g.addColorStop(0, P.cyanMid);
    g.addColorStop(1, P.cyanHi);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Touch controls                                                      */
/* ------------------------------------------------------------------ */

export function drawTouchControlsHD(ctx, game, isTouch) {
  if (!isTouch || game.scene !== 'playing') return;
  const pulse = 0.6 + 0.2 * Math.sin(game.time * 4);

  // Movement pad hint.
  const padX = 44;
  const padY = 372;
  ctx.strokeStyle = withAlpha(P.cyanSh, 0.28 * pulse);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(padX, padY, 21, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padX, padY, 10, 0, TAU);
  ctx.stroke();
  label(ctx, 'DRAG', padX, padY + 30, { align: 'center', size: 5, color: withAlpha(P.cyan, 0.55), tracking: 1.5 });

  const button = (b, main, sub, color, glowColor) => {
    const g = ctx.createRadialGradient(b.x, b.y - 4, 2, b.x, b.y, b.r);
    g.addColorStop(0, withAlpha(color, 0.28));
    g.addColorStop(1, withAlpha(P.void, 0.28));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha(glowColor, 0.7);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    glow(ctx, b.x, b.y, b.r + 4, glowColor, 0.12);
    label(ctx, main, b.x, b.y + 0.5, { align: 'center', size: 6.4, color: glowColor, tracking: 1 });
    label(ctx, sub, b.x, b.y + 8, { align: 'center', size: 4.6, color: withAlpha(P.marbleMid, 0.85), tracking: 0.5 });
  };

  button(TOUCH.transform, 'FORM', 'X', P.gold, P.goldHi);
  button(TOUCH.nova, 'NOVA', 'x' + game.novas, P.orange, P.orangeHi);

  // Pause.
  const pause = TOUCH.pause;
  ctx.strokeStyle = withAlpha(P.marbleSh, 0.5);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(pause.x, pause.y, pause.r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = withAlpha(P.marbleHi, 0.8);
  rr(ctx, pause.x - 3.2, pause.y - 4, 1.8, 8, 0.6);
  ctx.fill();
  rr(ctx, pause.x + 1.4, pause.y - 4, 1.8, 8, 0.6);
  ctx.fill();
}
