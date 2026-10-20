/**
 * In-game HUD (top strip), boss health bar, banners, popups and the touch pad.
 * Layout follows the concept sheet: SCORE · LIVES · STAGE on top,
 * NOVA charge and the 2–5 module shield pips below.
 */
import { P } from './palette.js';
import {
  rect, hline, vline, circle, ring, glow, withAlpha, drawSprite, frameRect,
} from './pixel.js';
import { drawText, measureText } from './pixelfont.js';
import { formatScore } from '../core/math.js';
import { MODULE_DEFS, MODULE_BY_ID, PODS } from '../game/config.js';
import { TOUCH } from '../ui/touch.js';

const COLOR_BY_NAME = {
  cyan: P.cyan,
  cyanHi: P.cyanHi,
  gold: P.gold,
  goldHi: P.goldHi,
  red: P.red,
  orange: P.orange,
  orangeHi: P.orangeHi,
  green: P.green,
  steel: P.steel,
  white: P.marbleHi,
  magenta: P.magenta,
};

export function colorOf(name, fallback = P.marbleHi) {
  return COLOR_BY_NAME[name] || fallback;
}

function drawHeart(ctx, x, y, color = P.red) {
  rect(ctx, x, y + 1, 2, 1, color);
  rect(ctx, x + 3, y + 1, 2, 1, color);
  rect(ctx, x, y + 2, 5, 2, color);
  rect(ctx, x + 1, y + 4, 3, 1, color);
  rect(ctx, x + 2, y + 5, 1, 1, color);
  rect(ctx, x, y + 1, 1, 1, P.redHi);
}

export function drawHud(ctx, game) {
  const { player } = game;

  // Backing panel.
  ctx.fillStyle = 'rgba(4,3,10,0.9)';
  ctx.fillRect(0, 0, 240, 34);
  for (let y = 30; y < 34; y++) {
    ctx.fillStyle = withAlpha(P.void, (y - 29) / 5);
    ctx.fillRect(0, y, 240, 1);
  }
  hline(ctx, 0, 33, 240, withAlpha(P.goldSh, 0.45));
  hline(ctx, 0, 34, 240, withAlpha(P.cyanSh, 0.14));

  // SCORE.
  drawText(ctx, 'SCORE', 6, 2, { scale: 1, spacing: 1, color: P.steel });
  drawText(ctx, formatScore(game.score), 6, 10, {
    scale: 2, spacing: 1, color: P.marbleHi,
    shadow: { x: 1, y: 1, color: 'rgba(0,0,0,0.6)' },
  });

  // LIVES.
  drawText(ctx, 'LIVES', 120, 2, { align: 'center', scale: 1, spacing: 1, color: P.steel });
  const lives = Math.max(0, game.lives);
  const shown = Math.min(lives, 5);
  const heartW = 7;
  const totalW = shown * heartW;
  let hx = 120 - Math.floor(totalW / 2) + 1;
  for (let i = 0; i < shown; i++) {
    drawHeart(ctx, hx + i * heartW, 10);
  }
  if (lives > 5) {
    drawText(ctx, 'X' + lives, 120 + totalW / 2 + 3, 10, { scale: 1, color: P.redHi });
  }

  // STAGE.
  const stageNo = String(game.stage).padStart(2, '0');
  drawText(ctx, `STAGE ${stageNo}`, 234, 2, { align: 'right', scale: 1, spacing: 1, color: P.steel });
  const stageName = game.stagePlan ? game.stagePlan.name : '';
  drawText(ctx, stageName, 234, 11, { align: 'right', scale: 1, spacing: 0, color: P.goldMid, alpha: 0.95 });

  // NOVA charge.
  drawText(ctx, 'NOVA', 6, 25, { scale: 1, spacing: 1, color: game.novas > 0 ? P.orange : P.steelMid });
  circle(ctx, 36, 28, 3, game.novas > 0 ? P.orange : P.steelSh);
  circle(ctx, 35, 27, 1, game.novas > 0 ? P.orangeHi : P.steelMid);
  drawText(ctx, 'X' + game.novas, 42, 25, { scale: 1, spacing: 1, color: game.novas > 0 ? P.orangeHi : P.steelMid });
  if (game.novas > 0 && game.novas === 1) {
    glow(ctx, 37, 28, 8, P.orange, 0.2);
  }

  // Combo multiplier (centre of row 3).
  if (game.multiplier > 1) {
    const blink = Math.floor(game.time * 8) % 2 === 0;
    drawText(ctx, 'X' + game.multiplier, 120, 25, {
      align: 'center', scale: 2, spacing: 1,
      color: blink ? P.goldHi : P.gold,
      outline: true, outlineColor: P.outline,
    });
  }

  // Module shield pips (2–5).
  const pipW = 11;
  const pipH = 9;
  const gap = 2;
  const startX = 234 - (MODULE_DEFS.length * (pipW + gap)) + gap;
  for (let i = 0; i < MODULE_DEFS.length; i++) {
    const def = MODULE_DEFS[i];
    const x = startX + i * (pipW + gap);
    const docked = player.modules.includes(def.id);
    const y = 24;
    rect(ctx, x, y, pipW, pipH, withAlpha(P.void, 0.85));
    frameRect(ctx, x, y, pipW, pipH, docked ? def.color : withAlpha(P.steelSh, 0.55));
    if (docked) {
      rect(ctx, x + 1, y + 1, pipW - 2, pipH - 2, withAlpha(def.color, 0.22));
      glow(ctx, x + pipW / 2, y + pipH / 2, 8, def.color, 0.18);
    }
    drawText(ctx, String(def.num), x + 3, y + 2, {
      scale: 1, spacing: 0, color: docked ? def.accent : withAlpha(P.steelMid, 0.8),
    });
  }
  // Formation cooldown sliver.
  if (player.formationCooldown > 0) {
    const frac = 1 - player.formationCooldown / 2.8;
    rect(ctx, startX, 34, 30, 1, withAlpha(P.cyanSh, 0.6));
    rect(ctx, startX, 34, Math.round(30 * frac), 1, P.cyan);
  }
}

export function drawBossBar(ctx, game) {
  const boss = game.boss;
  if (!boss || boss.state === 'enter') return;
  const x = 8;
  const w = 224;
  const y = 37;
  drawText(ctx, boss.name, x, y, { scale: 1, spacing: 0, color: P.redHi, alpha: 0.95 });
  const frac = Math.max(0, boss.totalHp / boss.totalMaxHp);
  const phaseColor = boss.phase >= 3 ? P.red : boss.phase === 2 ? P.magenta : P.magentaMid;
  rect(ctx, x, y + 9, w, 5, withAlpha(P.void, 0.85));
  frameRect(ctx, x, y + 9, w, 5, withAlpha(P.redHi, 0.5));
  const fill = Math.round((w - 2) * frac);
  for (let i = 0; i < fill; i++) {
    const t = i / Math.max(1, fill);
    ctx.fillStyle = t > 0.66 ? P.orange : t > 0.33 ? phaseColor : P.red;
    ctx.fillRect(x + 1 + i, y + 10, 1, 3);
  }
  // Hand status.
  for (let i = 0; i < boss.hands.length; i++) {
    const h = boss.hands[i];
    const bx = x + w - 14 + i * 8;
    const by = y + 16;
    rect(ctx, bx, by, 6, 3, h.alive ? P.marbleMid : withAlpha(P.steelSh, 0.4));
  }
}

export function drawBanner(ctx, game) {
  const b = game.banner;
  if (!b) return;
  const t = b.t;
  const fadeIn = Math.min(1, t / 0.25);
  const fadeOut = Math.min(1, Math.max(0, (b.life - t) / 0.45));
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;
  const color = colorOf(b.color, P.gold);
  const y = 148;
  const blink = b.color === 'red' ? (Math.floor(t * 5) % 2 === 0 ? 1 : 0.45) : 1;
  ctx.globalAlpha = alpha * blink;
  drawText(ctx, b.text, 120, y, {
    align: 'center', scale: 3, spacing: 2, color,
    outline: true, outlineColor: P.outline,
  });
  if (b.sub) {
    drawText(ctx, b.sub, 120, y + 26, {
      align: 'center', scale: 1, spacing: 2, color: P.marbleHi, alpha: 0.9,
    });
  }
  hline(ctx, 60, y + 40, 120, withAlpha(color, 0.4));
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx, game) {
  for (const p of game.popups) {
    const fade = p.t > p.life * 0.6 ? 1 - (p.t - p.life * 0.6) / (p.life * 0.4) : 1;
    const rise = p.t * 16;
    drawText(ctx, p.text, p.x, p.y - rise, {
      align: 'center', scale: 1, spacing: 1,
      color: colorOf(p.color, P.marbleHi),
      alpha: Math.max(0, fade),
      shadow: { x: 1, y: 1, color: 'rgba(0,0,0,0.75)' },
    });
  }
}

export function drawFormationHud(ctx, game) {
  const p = game.player;
  if (!p.formationActive) return;
  const left = 1 - p.formationTime / 3.4;
  rect(ctx, 90, 34, 60, 2, withAlpha(P.void, 0.7));
  rect(ctx, 90, 34, Math.round(60 * Math.max(0, left)), 2, P.cyan);
}

/** On-screen controls for touch devices. */
export function drawTouchControls(ctx, game, isTouch) {
  if (!isTouch || game.scene !== 'playing') return;
  const pulse = 0.55 + 0.15 * Math.sin(game.time * 4);

  // Movement pad hint (bottom-left).
  const padX = 44;
  const padY = 372;
  ring(ctx, padX, padY, 22, withAlpha(P.cyanSh, 0.22 * pulse), 1);
  ring(ctx, padX, padY, 10, withAlpha(P.cyanSh, 0.18 * pulse), 1);
  drawText(ctx, 'DRAG', padX, padY + 28, { align: 'center', scale: 1, spacing: 1, color: withAlpha(P.cyan, 0.45) });

  // FORM button.
  const form = TOUCH.transform;
  glow(ctx, form.x, form.y, form.r + 6, P.gold, 0.08);
  circle(ctx, form.x, form.y, form.r, withAlpha(P.void, 0.35));
  ring(ctx, form.x, form.y, form.r, withAlpha(P.gold, 0.55), 1);
  drawText(ctx, 'FORM', form.x, form.y - 3, { align: 'center', scale: 1, spacing: 0, color: P.goldHi });
  drawText(ctx, 'X', form.x, form.y + 5, { align: 'center', scale: 1, spacing: 0, color: withAlpha(P.marbleMid, 0.8) });

  // NOVA button.
  const nova = TOUCH.nova;
  glow(ctx, nova.x, nova.y, nova.r + 5, P.orange, 0.08);
  circle(ctx, nova.x, nova.y, nova.r, withAlpha(P.void, 0.35));
  ring(ctx, nova.x, nova.y, nova.r, withAlpha(P.orange, 0.55), 1);
  drawText(ctx, 'NOVA', nova.x, nova.y - 3, { align: 'center', scale: 1, spacing: 0, color: P.orangeHi });
  drawText(ctx, 'X' + game.novas, nova.x, nova.y + 5, { align: 'center', scale: 1, spacing: 0, color: P.orange });

  // Pause.
  const pause = TOUCH.pause;
  ring(ctx, pause.x, pause.y, pause.r, withAlpha(P.marbleSh, 0.4), 1);
  rect(ctx, pause.x - 3, pause.y - 4, 2, 7, withAlpha(P.marbleHi, 0.7));
  rect(ctx, pause.x + 1, pause.y - 4, 2, 7, withAlpha(P.marbleHi, 0.7));
}

/** Little badge shown for a moment when a module docks. */
export function drawModuleBadge(ctx, game) {
  const p = game.player;
  if (!p.modules.length) return;
  // Nothing persistent — docked state lives in the HUD pips.
}
