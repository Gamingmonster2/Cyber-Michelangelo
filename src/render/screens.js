/**
 * Full-screen overlay screens: how-to-play, credits, options, pause and
 * game-over. All painted in the pixel buffer.
 */
import { P } from './palette.js';
import {
  rect, hline, vline, circle, ring, glow, withAlpha, frameRect, gradientV,
} from './pixel.js';
import { drawText, measureText } from './pixelfont.js';
import { formatScore } from '../core/math.js';
import { MODULE_DEFS, MODULE_ORDER } from '../game/config.js';
import { OPTION_ITEMS, PAUSE_ITEMS, TITLE_ITEMS } from '../game/game.js';

function panel(ctx, x, y, w, h, opts = {}) {
  rect(ctx, x, y, w, h, opts.fill || 'rgba(6,4,14,0.92)');
  frameRect(ctx, x, y, w, h, opts.border || withAlpha(P.goldSh, 0.7));
  frameRect(ctx, x + 2, y + 2, w - 4, h - 4, withAlpha(P.cyanSh, 0.22));
  // Corner studs.
  for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) {
    rect(ctx, cx, cy, 3, 3, opts.border || P.goldSh);
  }
  if (opts.title) {
    drawText(ctx, opts.title, x + w / 2, y + 8, {
      align: 'center', scale: 2, spacing: 1, color: P.goldHi,
      outline: true, outlineColor: P.outline,
    });
    hline(ctx, x + 14, y + 27, w - 28, withAlpha(P.goldSh, 0.5));
  }
}

function dimScreen(ctx, alpha = 0.7) {
  ctx.fillStyle = `rgba(3,2,8,${alpha})`;
  ctx.fillRect(0, 0, 240, 420);
}

function footerHint(ctx, text) {
  drawText(ctx, text, 120, 402, {
    align: 'center', scale: 1, spacing: 1, color: P.steelMid, alpha: 0.9,
  });
}

/* ------------------------------------------------------------------ */

export function drawHowto(ctx, game) {
  dimScreen(ctx, 0.78);
  panel(ctx, 14, 34, 212, 344, { title: '' });
  drawText(ctx, 'HOW TO PLAY', 120, 44, {
    align: 'center', scale: 2, spacing: 1, color: P.goldHi,
    outline: true, outlineColor: P.outline,
  });
  hline(ctx, 30, 63, 180, withAlpha(P.goldSh, 0.45));

  if (game.howtoPage === 0) {
    drawText(ctx, 'CONTROLS', 120, 74, { align: 'center', scale: 1, spacing: 2, color: P.cyan });
    const rows = [
      ['MOVE', 'ARROWS / WASD'],
      ['FIRE', 'Z · SPACE · J'],
      ['TRANSFORM', 'X · K · SHIFT'],
      ['NOVA BOMB', 'B · L'],
      ['PAUSE', 'ESC · P'],
      ['MUTE', 'M'],
    ];
    let y = 88;
    for (const [label, keys] of rows) {
      drawText(ctx, label, 30, y, { scale: 1, spacing: 1, color: P.marbleSh });
      drawText(ctx, keys, 208, y, { align: 'right', scale: 1, spacing: 1, color: P.marbleHi });
      hline(ctx, 30, y + 9, 178, withAlpha(P.marbleSh, 0.12));
      y += 16;
    }
    drawText(ctx, 'TOUCH', 120, 196, { align: 'center', scale: 1, spacing: 2, color: P.cyan });
    drawText(ctx, 'DRAG ANYWHERE TO FLY', 120, 210, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'AUTO-FIRE WHILE DRAGGING', 120, 221, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'FORM / NOVA BUTTONS ON SCREEN', 120, 232, { align: 'center', scale: 1, color: P.marbleMid });

    drawText(ctx, 'THE GOAL', 120, 258, { align: 'center', scale: 1, spacing: 2, color: P.cyan });
    drawText(ctx, 'SHOOT THE 4 GROUND PODS', 120, 274, { align: 'center', scale: 1, color: P.goldHi });
    drawText(ctx, 'TO RELEASE A MODULE. THE PODS', 120, 285, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'ARE NUMBERED 2-5: COLLECT ALL', 120, 296, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'FOUR, THEN PRESS X TO BECOME', 120, 307, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'THE INVINCIBLE PHOENIX.', 120, 318, { align: 'center', scale: 1, color: P.orangeHi });
  } else {
    drawText(ctx, 'MODULE SYSTEM', 120, 74, { align: 'center', scale: 1, spacing: 2, color: P.cyan });
    let y = 88;
    for (const def of MODULE_DEFS) {
      const color = def.color;
      rect(ctx, 26, y, 8, 8, withAlpha(color, 0.25));
      frameRect(ctx, 26, y, 8, 8, color);
      drawText(ctx, String(def.num), 29, y + 1, { scale: 1, color: def.accent });
      drawText(ctx, def.name, 40, y, { scale: 1, spacing: 1, color: P.marbleHi });
      drawText(ctx, def.title, 40, y + 9, { scale: 1, spacing: 0, color: P.marbleSh });
      drawText(ctx, def.line, 208, y + 2, { align: 'right', scale: 1, spacing: 0, color: color, alpha: 0.95 });
      hline(ctx, 26, y + 20, 188, withAlpha(P.marbleSh, 0.12));
      y += 28;
    }
    drawText(ctx, 'EVERY DOCKED PIECE IS A SHIELD', 120, 214, { align: 'center', scale: 1, color: P.goldHi });
    drawText(ctx, 'HIT: LOSE THE OUTERMOST PIECE', 120, 226, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'SPLIT ANY 1-3 PIECES WITH X:', 120, 244, { align: 'center', scale: 1, color: P.cyan });
    drawText(ctx, 'PIECES ARE INVULNERABLE, THE', 120, 256, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'HULL IS NOT. A HIT REVERTS.', 120, 268, { align: 'center', scale: 1, color: P.marbleMid });
    drawText(ctx, 'FORMATION SHAPES ARTS:', 120, 286, { align: 'center', scale: 1, color: P.cyan });
    drawText(ctx, '1 = ESCORT   2 = MOON   3 = EXTEND', 120, 300, { align: 'center', scale: 1, color: P.goldMid });
    drawText(ctx, 'PHOENIX = ALL 4 + X (INVINCIBLE)', 120, 318, { align: 'center', scale: 1, color: P.orangeHi });
    drawText(ctx, 'PIECES BURN OUT AFTER THE PHOENIX.', 120, 330, { align: 'center', scale: 1, color: P.marbleSh });
  }

  drawText(ctx, `PAGE ${game.howtoPage + 1}/2`, 120, 356, { align: 'center', scale: 1, color: P.steelMid });
  footerHint(ctx, '◀ ▶ PAGE   ·   ENTER/ESC BACK');
}

export function drawCredits(ctx, game, time) {
  dimScreen(ctx, 0.82);
  panel(ctx, 20, 38, 200, 322, {});
  drawText(ctx, 'CREDITS', 120, 50, {
    align: 'center', scale: 2, spacing: 2, color: P.goldHi,
    outline: true, outlineColor: P.outline,
  });
  hline(ctx, 40, 70, 160, withAlpha(P.goldSh, 0.5));

  const lines = [
    ['A CYBER MICHELANGELO PRODUCTION', P.marbleHi, 84],
    ['GAME DESIGN · CODE', P.cyan, 100],
    ['DEEPSEEK AI AGENT', P.marbleMid, 110],
    ['', P.marbleMid, 118],
    ['INSPIRED BY', P.cyan, 132],
    ['TERRA CRESTA (1985)', P.goldHi, 142],
    ['NICHIBUTSU · DESIGNED BY', P.marbleMid, 152],
    ['SHIGEKI FUJIWARA', P.marbleHi, 162],
    ['CRESTA SERIES · MOON (1980)', P.marbleSh, 176],
    ['SOL CRESTA (2022) PLATINUMGAMES', P.marbleSh, 186],
    ['', P.marbleMid, 194],
    ['PIXEL ART · MUSIC · SFX', P.cyan, 208],
    ['PROCEDURAL, ZERO ASSETS', P.marbleMid, 218],
    ['', P.marbleMid, 226],
    ['BUILT WITH AI ASSISTANCE', P.orangeHi, 240],
    ['WITH RESPECT TO THE ORIGINAL', P.marbleSh, 250],
    ['HALL OF SHOOTERS', P.marbleSh, 260],
  ];
  for (const [text, color, y] of lines) {
    if (!text) continue;
    drawText(ctx, text, 120, y, { align: 'center', scale: 1, spacing: 0, color, alpha: 0.95 });
  }

  // Phoenix crest.
  const cy = 316;
  glow(ctx, 120, cy, 24, P.orange, 0.15 + 0.05 * Math.sin(time * 2));
  for (let i = 0; i < 3; i++) {
    const w = 10 - i * 3;
    rect(ctx, 120 - w, cy + i * 2, w * 2, 2, withAlpha(P.gold, 0.5 - i * 0.12));
  }
  drawText(ctx, 'FIAMMA', 120, 336, { align: 'center', scale: 1, spacing: 3, color: P.goldMid });

  footerHint(ctx, 'ENTER / ESC TO RETURN');
}

export function drawOptions(ctx, game) {
  dimScreen(ctx, 0.8);
  panel(ctx, 24, 60, 192, 300, { title: 'OPTIONS' });
  let y = 100;
  for (let i = 0; i < OPTION_ITEMS.length; i++) {
    const item = OPTION_ITEMS[i];
    const sel = i === game.optionIndex;
    if (sel) {
      rect(ctx, 32, y - 3, 176, 16, withAlpha(P.gold, 0.08));
      drawText(ctx, '▶', 36, y, { scale: 1, color: P.gold });
    }
    drawText(ctx, item.label, 48, y, {
      scale: 1, spacing: 1, color: sel ? P.goldHi : P.marbleMid,
    });
    if (item.type === 'volume') {
      const value = game.settings[item.key];
      const total = 10;
      const bx = 124;
      for (let s = 0; s < total; s++) {
        rect(ctx, bx + s * 9, y - 1, 7, 9, withAlpha(s < value ? P.cyan : P.steelSh, s < value ? 0.85 : 0.4));
      }
      drawText(ctx, String(value), 226, y, { align: 'right', scale: 1, color: P.marbleHi });
    } else if (item.type === 'bool') {
      const on = Boolean(game.settings[item.key]);
      const bx = 124;
      rect(ctx, bx, y - 2, 26, 11, withAlpha(on ? P.cyan : P.steelSh, 0.3));
      frameRect(ctx, bx, y - 2, 26, 11, withAlpha(on ? P.cyan : P.steelMid, 0.8));
      rect(ctx, on ? bx + 15 : bx + 2, y, 8, 7, on ? P.cyanHi : P.steelMid);
      drawText(ctx, on ? 'ON' : 'OFF', 156, y, { scale: 1, color: on ? P.cyanHi : P.marbleSh });
    } else if (item.type === 'back') {
      // nothing extra
    }
    y += 26;
  }
  drawText(ctx, 'LEFT / RIGHT TO CHANGE', 120, 336, { align: 'center', scale: 1, color: P.steelMid });
  footerHint(ctx, 'ENTER TO TOGGLE   ·   ESC BACK');
}

export function drawPause(ctx, game) {
  dimScreen(ctx, 0.66);
  panel(ctx, 44, 110, 152, 196, {});
  drawText(ctx, 'PAUSED', 120, 126, {
    align: 'center', scale: 3, spacing: 2, color: P.goldHi,
    outline: true, outlineColor: P.outline,
  });
  hline(ctx, 62, 152, 116, withAlpha(P.goldSh, 0.5));
  // Small loadout summary.
  drawText(ctx, 'DOCKED', 64, 162, { scale: 1, spacing: 1, color: P.steel });
  for (let i = 0; i < MODULE_DEFS.length; i++) {
    const def = MODULE_DEFS[i];
    const docked = game.player.modules.includes(def.id);
    const x = 70 + i * 16;
    frameRect(ctx, x, 172, 11, 9, docked ? def.color : withAlpha(P.steelSh, 0.5));
    drawText(ctx, String(def.num), x + 3, 174, { scale: 1, color: docked ? def.accent : P.steelMid });
  }
  let y = 206;
  for (let i = 0; i < PAUSE_ITEMS.length; i++) {
    const sel = i === game.pauseIndex;
    drawText(ctx, PAUSE_ITEMS[i], 120, y, {
      align: 'center', scale: sel ? 2 : 1,
      spacing: 1, color: sel ? P.goldHi : P.marbleMid,
      outline: sel, outlineColor: P.outline,
    });
    if (sel) {
      drawText(ctx, '▶', 52, y + 1, { scale: 1, color: P.gold });
      drawText(ctx, '◀', 184, y + 1, { scale: 1, color: P.gold });
    }
    y += 22;
  }
  footerHint(ctx, 'ESC / P RESUME');
}

export function drawGameover(ctx, game) {
  dimScreen(ctx, 0.78);
  panel(ctx, 24, 54, 192, 316, {});
  drawText(ctx, 'GAME OVER', 120, 74, {
    align: 'center', scale: 3, spacing: 1, color: P.red,
    outline: true, outlineColor: P.outline,
  });

  drawText(ctx, 'SCORE', 120, 108, { align: 'center', scale: 1, spacing: 2, color: P.steel });
  drawText(ctx, formatScore(game.score), 120, 120, {
    align: 'center', scale: 3, spacing: 1, color: P.marbleHi,
    outline: true, outlineColor: P.outline,
  });
  drawText(ctx, 'HI-SCORE ' + formatScore(game.hiScore), 120, 148, {
    align: 'center', scale: 1, spacing: 1, color: P.goldMid,
  });
  drawText(ctx, `STAGE ${game.stage} · LOOP ${game.loop}`, 120, 160, {
    align: 'center', scale: 1, spacing: 1, color: P.marbleSh,
  });

  if (game.gameoverPhase === 'continue') {
    const secs = Math.ceil(game.continueTimer);
    const blink = Math.floor(game.time * 3) % 2 === 0;
    drawText(ctx, 'CONTINUE?', 120, 204, {
      align: 'center', scale: 2, spacing: 1, color: blink ? P.cyan : P.cyanHi,
      outline: true, outlineColor: P.outline,
    });
    drawText(ctx, String(secs), 120, 224, {
      align: 'center', scale: 4, spacing: 2, color: P.orangeHi,
      outline: true, outlineColor: P.outline,
    });
    // Countdown bar.
    const frac = Math.max(0, game.continueTimer / 9);
    rect(ctx, 70, 256, 100, 5, withAlpha(P.void, 0.8));
    frameRect(ctx, 70, 256, 100, 5, withAlpha(P.orange, 0.6));
    rect(ctx, 72, 258, Math.round(96 * frac), 1, P.orange);
    drawText(ctx, 'PRESS ENTER / TAP TO CONTINUE', 120, 274, {
      align: 'center', scale: 1, spacing: 0, color: P.marbleMid,
      alpha: 0.7 + 0.3 * Math.sin(game.time * 4),
    });
  } else {
    const items = ['RETRY', 'TITLE SCREEN'];
    let y = 204;
    for (let i = 0; i < items.length; i++) {
      const sel = i === game.gameoverIndex;
      drawText(ctx, items[i], 120, y, {
        align: 'center', scale: sel ? 2 : 1, spacing: 1,
        color: sel ? P.goldHi : P.marbleMid,
        outline: sel, outlineColor: P.outline,
      });
      y += 26;
    }
  }

  // Run stats.
  const docked = game.player.modules.length;
  drawText(ctx, `PHOENIX ${game.phoenixesThisRun} · DOCKED ${docked}/4`, 120, 312, {
    align: 'center', scale: 1, spacing: 0, color: P.steelMid,
  });
  footerHint(ctx, 'THANK YOU FOR PLAYING');
}

export function drawTitleOverlayHint(ctx, game) {
  // Small "1UP / INSERT COIN" flavour above the menu — optional.
}

export { TITLE_ITEMS, PAUSE_ITEMS, OPTION_ITEMS };
