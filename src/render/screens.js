/**
 * HD-2D overlay screens: how-to-play, credits, options, pause and game-over.
 * Glassy rounded panels with gradient typography, matching the new UI style.
 */
import { P } from './palette.js';
import { withAlpha, glow } from './pixel.js';
import { formatScore } from '../core/math.js';
import { MODULE_DEFS } from '../game/config.js';
import { OPTION_ITEMS, PAUSE_ITEMS } from '../game/game.js';

const FONT = '"Bahnschrift", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Bahnschrift", "Consolas", "Segoe UI", monospace';
const TAU = Math.PI * 2;

function setFont(ctx, size, weight = 700, family = FONT, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  try { ctx.letterSpacing = `${tracking}px`; } catch { /* ignore */ }
}

function label(ctx, str, x, y, opts = {}) {
  const { size = 5, weight = 700, color = P.steel, align = 'left', tracking = 1.1, alpha = 1, family = FONT } = opts;
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

function dimScreen(ctx, alpha = 0.72) {
  const g = ctx.createRadialGradient(120, 210, 40, 120, 210, 300);
  g.addColorStop(0, `rgba(4,3,10,${alpha * 0.82})`);
  g.addColorStop(1, `rgba(3,2,8,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 240, 420);
}

function panelHD(ctx, x, y, w, h, opts = {}) {
  rr(ctx, x, y, w, h, 8);
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, 'rgba(13,11,26,0.95)');
  fill.addColorStop(0.55, 'rgba(8,7,18,0.93)');
  fill.addColorStop(1, 'rgba(6,5,14,0.96)');
  ctx.fillStyle = fill;
  ctx.fill();
  const border = ctx.createLinearGradient(x, 0, x + w, 0);
  border.addColorStop(0, withAlpha(P.cyanSh, 0.25));
  border.addColorStop(0.35, withAlpha(P.goldSh, 0.7));
  border.addColorStop(0.65, withAlpha(P.cyanSh, 0.55));
  border.addColorStop(1, withAlpha(P.goldSh, 0.25));
  ctx.strokeStyle = border;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 0.5, P.cyan, 0.03);
  // Corner studs.
  for (const [cx, cy] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) {
    ctx.fillStyle = withAlpha(P.gold, 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, 0.7, 0, TAU);
    ctx.fill();
  }
}

function screenTitle(ctx, str, y, colors = [P.goldHi, P.gold]) {
  setFont(ctx, 15, 900, FONT, 3);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const g = ctx.createLinearGradient(0, y - 13, 0, y + 2);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(1, colors[0]);
  ctx.fillStyle = g;
  ctx.shadowColor = withAlpha(colors[1], 0.55);
  ctx.shadowBlur = 8;
  ctx.fillText(str, 120, y);
  ctx.shadowBlur = 0;
}

function divider(ctx, y, x0 = 30, x1 = 210, color = P.goldSh, alpha = 0.4) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.5, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x0, y, x1 - x0, 0.5);
}

function footerHint(ctx, text) {
  label(ctx, text, 120, 405, { align: 'center', size: 4.6, color: withAlpha(P.steelMid, 0.9), tracking: 1.4 });
}

const CONTROLS = [
  ['MOVE', 'ARROWS / WASD'],
  ['FIRE', 'Z · SPACE · J'],
  ['TRANSFORM', 'X · K · SHIFT'],
  ['NOVA BOMB', 'B · L'],
  ['PAUSE', 'ESC · P'],
  ['MUTE', 'M'],
];

/* ------------------------------------------------------------------ */

export function drawHowto(ctx, game) {
  dimScreen(ctx, 0.7);
  panelHD(ctx, 14, 26, 212, 354);
  screenTitle(ctx, 'HOW TO PLAY', 50);
  divider(ctx, 60);

  if (game.howtoPage === 0) {
    label(ctx, 'CONTROLS', 120, 72, { align: 'center', size: 5.4, color: P.cyan, tracking: 2.6 });
    let y = 86;
    for (const [name, keys] of CONTROLS) {
      label(ctx, name, 30, y, { size: 5.4, color: P.marbleSh, tracking: 0.8 });
      label(ctx, keys, 210, y, { align: 'right', size: 5.4, color: P.marbleHi, tracking: 0.5, family: MONO, weight: 800 });
      divider(ctx, y + 4, 30, 210, P.marbleSh, 0.12);
      y += 13;
    }
    label(ctx, 'TOUCH', 120, 178, { align: 'center', size: 5.4, color: P.cyan, tracking: 2.6 });
    label(ctx, 'DRAG ANYWHERE TO FLY · AUTO-FIRE', 120, 190, { align: 'center', size: 4.8, color: P.marbleMid, tracking: 0.4 });
    label(ctx, 'FORM / NOVA BUTTONS ON SCREEN', 120, 199, { align: 'center', size: 4.8, color: P.marbleMid, tracking: 0.4 });
    label(ctx, 'THE GOAL', 120, 220, { align: 'center', size: 5.4, color: P.cyan, tracking: 2.6 });
    const goal = [
      'SHOOT THE 4 GROUND PODS TO RELEASE',
      'A MODULE. COLLECT ALL FOUR, THEN',
      'PRESS X TO BECOME THE PHOENIX.',
    ];
    let gy = 234;
    for (const line of goal) {
      label(ctx, line, 120, gy, { align: 'center', size: 5, color: line.includes('PHOENIX') ? P.orangeHi : P.marbleMid, tracking: 0.5 });
      gy += 11;
    }
    label(ctx, 'EVERY DOCKED PIECE IS ALSO A SHIELD HIT.', 120, 286, { align: 'center', size: 4.6, color: P.goldMid, tracking: 0.4 });
    label(ctx, 'MISSED PODS? THE CLUSTER RETRIES NEXT WAVE.', 120, 296, { align: 'center', size: 4.6, color: withAlpha(P.marbleSh, 0.9), tracking: 0.4 });
  } else {
    label(ctx, 'MODULE SYSTEM', 120, 72, { align: 'center', size: 5.4, color: P.cyan, tracking: 2.6 });
    let y = 86;
    for (const def of MODULE_DEFS) {
      rr(ctx, 28, y - 4.6, 9, 8, 2);
      ctx.fillStyle = withAlpha(def.color, 0.22);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      label(ctx, String(def.num), 32.5, y + 1.6, { align: 'center', size: 4.6, color: def.accent, family: MONO, weight: 800, tracking: 0 });
      label(ctx, def.name, 42, y, { size: 5.6, color: P.marbleHi, tracking: 1 });
      label(ctx, def.title, 42, y + 8, { size: 4.2, color: P.marbleSh, tracking: 0.6 });
      label(ctx, def.line, 208, y + 2, { align: 'right', size: 4.4, color: withAlpha(def.color, 0.95), tracking: 0.3 });
      divider(ctx, y + 9, 28, 210, P.marbleSh, 0.12);
      y += 25;
    }
    label(ctx, 'SPLIT 1-3 PIECES WITH X', 120, 200, { align: 'center', size: 5.4, color: P.cyan, tracking: 1.6 });
    const split = [
      'PIECES DETACH INTO FORMATIONS AND',
      'BECOME INVULNERABLE — THE HULL IS NOT.',
      'A HIT REVERTS YOU TO A SINGLE CRAFT.',
    ];
    let sy = 212;
    for (const line of split) {
      label(ctx, line, 120, sy, { align: 'center', size: 4.8, color: P.marbleMid, tracking: 0.3 });
      sy += 10;
    }
    label(ctx, '1 = ESCORT   2 = MOON   3 = EXTEND', 120, 252, { align: 'center', size: 4.8, color: P.goldMid, tracking: 1.2 });
    label(ctx, 'ALL FOUR PIECES + X = PHOENIX', 120, 268, { align: 'center', size: 5, color: P.orangeHi, tracking: 0.8 });
    label(ctx, 'INVINCIBLE · CONTACT KILLS · DOUBLE SCORE', 120, 278, { align: 'center', size: 4.4, color: withAlpha(P.marbleSh, 0.9), tracking: 0.4 });
    label(ctx, 'PIECES BURN OUT WHEN THE PHOENIX FADES.', 120, 288, { align: 'center', size: 4.4, color: P.marbleSh, tracking: 0.4 });
  }

  label(ctx, `PAGE ${game.howtoPage + 1} / 2`, 120, 362, { align: 'center', size: 4.8, color: P.steelMid, tracking: 1.6 });
  footerHint(ctx, '◀ ▶ PAGE   ·   ENTER / ESC BACK');
}

export function drawCredits(ctx, game, time) {
  dimScreen(ctx, 0.78);
  panelHD(ctx, 22, 32, 196, 330);
  screenTitle(ctx, 'CREDITS', 56);
  divider(ctx, 66);

  const rows = [
    ['A CYBER MICHELANGELO PRODUCTION', P.marbleHi, 0],
    ['GAME DESIGN · CODE · PIXEL ART', P.cyan, 1],
    ['DEEPSEEK AI AGENT', P.marbleMid, 1],
    ['INSPIRED BY', P.cyan, 1],
    ['TERRA CRESTA (1985) · NICHIBUTSU', P.goldHi, 1],
    ['DESIGNED BY SHIGEKI FUJIWARA', P.marbleMid, 1],
    ['MUSIC BY KENJI YOSHIDA', P.marbleShadow || P.marbleSh, 1],
    ['CRESTA SERIES: MOON (1980) / SOL (2022)', P.marbleSh, 1],
    ['ORIGINAL ART · MUSIC · SFX', P.cyan, 1],
    ['PROCEDURAL, ZERO-ASSET ENGINE', P.marbleMid, 1],
    ['BUILT WITH AI ASSISTANCE', P.orangeHi, 1],
    ['OPTIONAL 3D MODE · THREE.JS (MIT)', P.cyan, 1],
    ['3D MODELS BUILT PROCEDURALLY', P.marbleSh, 1],
    ['CC0 MUSIC: YD · SRG774 · XCVG', P.green, 1],
    ['VILLE NOUSIAINEN · NIKKE · OPEN GAME ART', P.marbleSh, 1],
    ['WITH RESPECT TO THE ORIGINAL', P.marbleSh, 1],
    ['HALL OF SHOOTERS', P.marbleSh, 1],
  ];
  let y = 80;
  for (const [text, color, small] of rows) {
    label(ctx, text, 120, y, {
      align: 'center', size: small ? 4.4 : 5.2, color, tracking: small ? 0.6 : 1.4,
      weight: small ? 700 : 800,
    });
    y += small ? 10.5 : 14;
  }

  // Fiery crest.
  const cy = 290;
  glow(ctx, 120, cy, 22, P.orange, 0.2 + 0.06 * Math.sin(time * 2));
  for (let i = 0; i < 5; i++) {
    const w = 13 - i * 2.2;
    const alpha = 0.65 - i * 0.1;
    ctx.fillStyle = withAlpha(i % 2 === 0 ? P.gold : P.orange, alpha);
    ctx.beginPath();
    ctx.moveTo(120 - w, cy + i * 2.4);
    ctx.lineTo(120, cy - 6 + i * 1.4);
    ctx.lineTo(120 + w, cy + i * 2.4);
    ctx.closePath();
    ctx.fill();
  }
  label(ctx, 'FIAMMA', 120, 316, { align: 'center', size: 6, color: P.goldHi, tracking: 4 });
  // The Arabic thank-you line is drawn by the bootstrap at y=347.
  footerHint(ctx, 'ENTER / ESC TO RETURN');
}

export function drawOptions(ctx, game) {
  dimScreen(ctx, 0.74);
  panelHD(ctx, 24, 56, 192, 300);
  screenTitle(ctx, 'OPTIONS', 82);
  divider(ctx, 92);

  let y = 108;
  for (let i = 0; i < OPTION_ITEMS.length; i++) {
    const item = OPTION_ITEMS[i];
    const sel = i === game.optionIndex;
    if (sel) {
      rr(ctx, 32, y - 8, 176, 16, 4);
      ctx.fillStyle = withAlpha(P.gold, 0.08);
      ctx.fill();
      ctx.strokeStyle = withAlpha(P.gold, 0.45);
      ctx.lineWidth = 0.6;
      ctx.stroke();
      label(ctx, '◀', 37, y + 2, { size: 5.4, color: P.gold });
      label(ctx, '▶', 203, y + 2, { align: 'right', size: 5.4, color: P.gold });
    }
    label(ctx, item.label, 48, y, { size: 5.4, color: sel ? P.goldHi : P.marbleMid, tracking: 0.8, weight: 800 });
    if (item.type === 'volume') {
      const value = game.settings[item.key];
      const total = 10;
      const bx = 112;
      for (let s = 0; s < total; s++) {
        rr(ctx, bx + s * 8.2, y - 4.6, 6.4, 6.4, 1.6);
        ctx.fillStyle = s < value ? withAlpha(P.cyan, 0.85) : 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
      label(ctx, String(value), 208, y, { align: 'right', size: 5, color: P.marbleHi, family: MONO, weight: 800, tracking: 0 });
    } else if (item.type === 'bool') {
      const on = Boolean(game.settings[item.key]);
      rr(ctx, 138, y - 6, 22, 11, 5.5);
      ctx.fillStyle = on ? withAlpha(P.cyan, 0.25) : 'rgba(255,255,255,0.07)';
      ctx.fill();
      ctx.strokeStyle = on ? withAlpha(P.cyanHi, 0.8) : withAlpha(P.steelMid, 0.5);
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.fillStyle = on ? P.cyanHi : P.steelMid;
      ctx.beginPath();
      ctx.arc(on ? 155 : 143, y - 0.5, 3.4, 0, TAU);
      ctx.fill();
      label(ctx, on ? 'ON' : 'OFF', 166, y, { size: 4.6, color: on ? P.cyanHi : P.marbleSh, tracking: 1 });
    } else if (item.type === 'choice') {
      const CHOICE_LABELS = {
        hd: 'HD-2D', '3d': '3D WEBGL', chiptune: 'CHIPTUNE', cc0: 'CC0 MUSIC',
      };
      const raw = game.settings[item.key];
      const pretty = CHOICE_LABELS[raw] || String(raw).toUpperCase();
      const hot = raw === '3d' || raw === 'cc0';
      const accent = raw === '3d' ? P.violet : hot ? P.green : P.cyanHi;
      const bx = 118;
      rr(ctx, bx, y - 6.5, 72, 12, 5.5);
      ctx.fillStyle = hot ? withAlpha(accent, 0.16) : withAlpha(P.cyan, 0.1);
      ctx.fill();
      ctx.strokeStyle = withAlpha(accent, 0.8);
      ctx.lineWidth = 0.6;
      ctx.stroke();
      label(ctx, pretty, bx + 36, y + 1.6, {
        align: 'center', size: 4.6, color: accent, tracking: 0.5, weight: 800,
      });
    }
    y += 25;
  }
  label(ctx, 'LEFT / RIGHT TO CHANGE', 120, 328, { align: 'center', size: 4.6, color: P.steelMid, tracking: 1 });
  footerHint(ctx, 'ENTER TO TOGGLE · ESC BACK');
}

export function drawPause(ctx, game) {
  dimScreen(ctx, 0.62);
  panelHD(ctx, 44, 100, 152, 210);
  screenTitle(ctx, 'PAUSED', 128);
  divider(ctx, 138, 62, 178);

  label(ctx, 'DOCKED', 120, 156, { align: 'center', size: 4.6, color: P.steel, tracking: 2 });
  const pipsW = MODULE_DEFS.length * 17;
  let px = 120 - pipsW / 2 + 6;
  for (const def of MODULE_DEFS) {
    const docked = game.player.modules.includes(def.id);
    rr(ctx, px, 162, 13, 9, 2.2);
    ctx.fillStyle = docked ? withAlpha(def.color, 0.24) : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = docked ? def.color : withAlpha(P.steelSh, 0.5);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    label(ctx, String(def.num), px + 6.5, 169, { align: 'center', size: 4.6, color: docked ? def.accent : P.steelMid, family: MONO, weight: 800, tracking: 0 });
    px += 17;
  }

  let y = 196;
  for (let i = 0; i < PAUSE_ITEMS.length; i++) {
    const sel = i === game.pauseIndex;
    if (sel) {
      rr(ctx, 58, y - 8, 124, 16, 4);
      ctx.fillStyle = withAlpha(P.gold, 0.1);
      ctx.fill();
      ctx.strokeStyle = withAlpha(P.gold, 0.55);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    setFont(ctx, sel ? 7.6 : 6, sel ? 900 : 700, FONT, sel ? 2 : 1.4);
    ctx.textAlign = 'center';
    ctx.fillStyle = sel ? P.goldHi : P.marbleMid;
    ctx.fillText(PAUSE_ITEMS[i], 120, y + 2);
    y += 24;
  }
  footerHint(ctx, 'ESC / P RESUME');
}

export function drawGameover(ctx, game) {
  dimScreen(ctx, 0.76);
  panelHD(ctx, 24, 46, 192, 328);
  screenTitle(ctx, 'GAME OVER', 78, [P.redHi, P.red]);
  divider(ctx, 90);

  label(ctx, 'SCORE', 120, 108, { align: 'center', size: 4.6, color: P.steel, tracking: 2.4 });
  setFont(ctx, 22, 900, MONO, 1.2);
  ctx.textAlign = 'center';
  ctx.fillStyle = (() => {
    const g = ctx.createLinearGradient(0, 116, 0, 140);
    g.addColorStop(0, P.marbleHi);
    g.addColorStop(1, P.marbleSh);
    return g;
  })();
  ctx.fillText(formatScore(game.score), 120, 138);
  glow(ctx, 120, 132, 40, P.cyan, 0.05);

  label(ctx, 'HI-SCORE ' + formatScore(game.hiScore), 120, 152, { align: 'center', size: 4.8, color: P.goldMid, tracking: 0.8 });
  label(ctx, `STAGE ${game.stage} · LOOP ${game.loop}`, 120, 163, { align: 'center', size: 4.6, color: P.marbleSh, tracking: 1 });

  if (game.gameoverPhase === 'continue') {
    const secs = Math.ceil(game.continueTimer);
    const blink = Math.floor(game.time * 3) % 2 === 0;
    label(ctx, 'CONTINUE?', 120, 196, { align: 'center', size: 10, color: blink ? P.cyan : P.cyanHi, tracking: 2.4 });
    setFont(ctx, 30, 900, MONO, 0);
    ctx.textAlign = 'center';
    ctx.fillStyle = P.orangeHi;
    ctx.shadowColor = withAlpha(P.orange, 0.6);
    ctx.shadowBlur = 10;
    ctx.fillText(String(secs), 120, 236);
    ctx.shadowBlur = 0;
    // Countdown ring.
    const frac = Math.max(0, game.continueTimer / 9);
    ctx.strokeStyle = withAlpha(P.orange, 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(120, 226, 24, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = P.orangeHi;
    ctx.beginPath();
    ctx.arc(120, 226, 24, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.stroke();
    label(ctx, 'PRESS ENTER / TAP TO CONTINUE', 120, 268, { align: 'center', size: 5, color: P.marbleMid, tracking: 0.8, alpha: 0.75 + 0.25 * Math.sin(game.time * 4) });
  } else {
    const items = ['RETRY', 'TITLE SCREEN'];
    let y = 196;
    for (let i = 0; i < items.length; i++) {
      const sel = i === game.gameoverIndex;
      if (sel) {
        rr(ctx, 56, y - 9, 128, 17, 4);
        ctx.fillStyle = withAlpha(P.gold, 0.1);
        ctx.fill();
        ctx.strokeStyle = withAlpha(P.gold, 0.55);
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      setFont(ctx, sel ? 8 : 6.4, 900, FONT, sel ? 2.2 : 1.4);
      ctx.textAlign = 'center';
      ctx.fillStyle = sel ? P.goldHi : P.marbleMid;
      ctx.fillText(items[i], 120, y + 2);
      y += 28;
    }
  }

  label(ctx, `PHOENIX ${game.phoenixesThisRun} · DOCKED ${game.player.modules.length}/4`, 120, 322, {
    align: 'center', size: 4.6, color: P.steelMid, tracking: 0.6,
  });
  footerHint(ctx, 'THANK YOU FOR PLAYING');
}

export { PAUSE_ITEMS, OPTION_ITEMS };
