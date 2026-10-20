/**
 * Pixel drawing toolkit.
 *
 * Every game pixel is drawn into a 240×420 offscreen buffer and then upscaled
 * with nearest-neighbour filtering by the display canvas — the classic
 * arcade trick. All helpers here snap to integer pixels so nothing blurs.
 */
import { P } from './palette.js';

export const PIX_W = 240;
export const PIX_H = 420;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function makeCtx(w, h) {
  const ctx = makeCanvas(w, h).getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** The offscreen pixel buffer. */
export class PixelScreen {
  constructor(w = PIX_W, h = PIX_H) {
    this.w = w;
    this.h = h;
    this.canvas = makeCanvas(w, h);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color = P.void) {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
}

/* ------------------------------------------------------------------ */
/* Primitive pixel drawing                                            */
/* ------------------------------------------------------------------ */

export function px(ctx, x, y, color = '#fff') {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
}

export function frameRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.max(0, Math.round(w));
  const rh = Math.max(0, Math.round(h));
  if (rw === 0 || rh === 0) return;
  ctx.fillRect(rx, ry, rw, 1);
  ctx.fillRect(rx, ry + rh - 1, rw, 1);
  ctx.fillRect(rx, ry, 1, rh);
  ctx.fillRect(rx + rw - 1, ry, 1, rh);
}

export function hline(ctx, x, y, len, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(len)), 1);
}

export function vline(ctx, x, y, len, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, Math.max(0, Math.round(len)));
}

/** Filled circle, snapped to the pixel grid. */
export function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const r2 = r * r;
  const cxr = Math.round(cx);
  const cyr = Math.round(cy);
  for (let y = -Math.floor(r); y <= Math.floor(r); y++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r2 - y * y)));
    if (dx < 0) continue;
    ctx.fillRect(cxr - dx, cyr + y, dx * 2 + 1, 1);
  }
}

/** Unfilled circle ring (pixel Bresenham-ish). */
export function ring(ctx, cx, cy, r, color, thickness = 1) {
  ctx.fillStyle = color;
  let x = Math.floor(r);
  let y = 0;
  let err = 1 - x;
  while (x >= y) {
    const pts = [
      [cx + x, cy + y], [cx + y, cy + x], [cx - y, cy + x], [cx - x, cy + y],
      [cx - x, cy - y], [cx - y, cy - x], [cx + y, cy - x], [cx + x, cy - y],
    ];
    for (const [p, q] of pts) {
      for (let t = 0; t < thickness; t++) ctx.fillRect(Math.round(p) + t, Math.round(q), 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

/** Bresenham line. */
export function bline(ctx, x0, y0, x1, y1, color, thickness = 1) {
  ctx.fillStyle = color;
  let X0 = Math.round(x0);
  let Y0 = Math.round(y0);
  const X1 = Math.round(x1);
  const Y1 = Math.round(y1);
  const dx = Math.abs(X1 - X0);
  const dy = Math.abs(Y1 - Y0);
  const sx = X0 < X1 ? 1 : -1;
  const sy = Y0 < Y1 ? 1 : -1;
  let err = dx - dy;
  const half = Math.floor(thickness / 2);
  for (;;) {
    if (thickness <= 1) ctx.fillRect(X0, Y0, 1, 1);
    else ctx.fillRect(X0 - half, Y0 - half, thickness, thickness);
    if (X0 === X1 && Y0 === Y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      X0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      Y0 += sy;
    }
  }
}

/** Filled polygon from a list of points (pixel-snapped via canvas path). */
export function poly(ctx, points, color) {
  if (points.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  }
  ctx.closePath();
  ctx.fill();
}

/** Pixel-perfect tapered beam between two points. */
export function beam(ctx, x0, y0, x1, y1, width, color, coreColor = null) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const hw = Math.max(0.5, width / 2);
  poly(ctx, [
    [x0 + nx * hw, y0 + ny * hw],
    [x1 + nx * hw, y1 + ny * hw],
    [x1 - nx * hw, y1 - ny * hw],
    [x0 - nx * hw, y0 - ny * hw],
  ], color);
  if (coreColor && width > 1) {
    const cw = Math.max(0.5, width / 3.5);
    poly(ctx, [
      [x0 + nx * cw, y0 + ny * cw],
      [x1 + nx * cw, y1 + ny * cw],
      [x1 - nx * cw, y1 - ny * cw],
      [x0 - nx * cw, y0 - ny * cw],
    ], coreColor);
  }
}

/* ------------------------------------------------------------------ */
/* Sprites                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a sprite from an array of strings.
 * palette maps single characters to CSS colors; '.' and ' ' are transparent.
 * opts.mirror mirrors each row horizontally (author left half only).
 * opts.mirrorAround mirrors around a centre char (author left + centre).
 */
export function makeSprite(rows, palette = {}, opts = {}) {
  let lines = rows.slice();
  if (opts.mirror) lines = lines.map((row) => row + row.split('').reverse().join(''));
  if (opts.mirrorAround) {
    lines = lines.map((row) => {
      const left = row.slice(0, -1);
      const center = row.slice(-1);
      return left.split('').reverse().join('') + center + row;
    });
  }
  const h = lines.length;
  const w = lines.reduce((max, row) => Math.max(max, row.length), 0);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = lines[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return { canvas, w, h };
}

const maskCache = new WeakMap();

/** Solid silhouette of a sprite in a given colour (cached per colour). */
export function maskFor(sprite, color = '#ffffff') {
  let byColor = maskCache.get(sprite);
  if (!byColor) {
    byColor = new Map();
    maskCache.set(sprite, byColor);
  }
  const hit = byColor.get(color);
  if (hit) return hit;
  const canvas = makeCanvas(sprite.w, sprite.h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sprite.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, sprite.w, sprite.h);
  const mask = { canvas, w: sprite.w, h: sprite.h };
  byColor.set(color, mask);
  return mask;
}

export function drawSprite(ctx, sprite, x, y, opts = {}) {
  const { flipX = false, flipY = false, alpha = 1, flash = false, blend = null, outline = null } = opts;
  if (!sprite) return;
  const prevAlpha = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
  if (blend) ctx.globalCompositeOperation = blend;
  const dx = Math.round(x - sprite.w / 2);
  const dy = Math.round(y - sprite.h / 2);
  // Optional 1px outline pass for readability on busy backgrounds.
  if (outline) {
    const mask = maskFor(sprite, outline);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      ctx.drawImage(mask.canvas, dx + ox, dy + oy);
    }
  }
  if (flipX || flipY) {
    ctx.save();
    ctx.translate(dx + (flipX ? sprite.w : 0), dy + (flipY ? sprite.h : 0));
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(flash ? maskFor(sprite).canvas : sprite.canvas, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(flash ? maskFor(sprite).canvas : sprite.canvas, dx, dy);
  }
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}

/* ------------------------------------------------------------------ */
/* Glow / light helpers (additive)                                    */
/* ------------------------------------------------------------------ */

const glowCache = new Map();

/** Cached radial light sprite. */
export function glowSprite(color, radius) {
  const key = color + '|' + radius;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const size = radius * 2;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, withAlpha(color, 0.85));
  grad.addColorStop(0.35, withAlpha(color, 0.32));
  grad.addColorStop(0.72, withAlpha(color, 0.1));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  glowCache.set(key, canvas);
  return canvas;
}

export function glow(ctx, x, y, radius, color, alpha = 1) {
  const sprite = glowSprite(color, Math.max(2, Math.round(radius)));
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
  ctx.drawImage(sprite, Math.round(x - radius), Math.round(y - radius));
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}

/** Soft additive rectangle glow (for beams / engine wash). */
export function glowRect(ctx, x, y, w, h, color, alpha = 0.5) {
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = withAlpha(color, alpha);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.globalCompositeOperation = prevOp;
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                     */
/* ------------------------------------------------------------------ */

const rgbCache = new Map();

export function parseColor(color) {
  const hit = rgbCache.get(color);
  if (hit) return hit;
  let out = { r: 255, g: 255, b: 255 };
  if (typeof color === 'string' && color[0] === '#' && (color.length === 7 || color.length === 4)) {
    if (color.length === 7) {
      out = {
        r: parseInt(color.slice(1, 3), 16),
        g: parseInt(color.slice(3, 5), 16),
        b: parseInt(color.slice(5, 7), 16),
      };
    } else {
      out = {
        r: parseInt(color[1] + color[1], 16),
        g: parseInt(color[2] + color[2], 16),
        b: parseInt(color[3] + color[3], 16),
      };
    }
  }
  rgbCache.set(color, out);
  return out;
}

export function withAlpha(color, alpha) {
  const { r, g, b } = parseColor(color);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

export function mix(colorA, colorB, t) {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  const tt = Math.max(0, Math.min(1, t));
  const to = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(a.r + (b.r - a.r) * tt)}${to(a.g + (b.g - a.g) * tt)}${to(a.b + (b.b - a.b) * tt)}`;
}

/** Shift brightness of a hex colour; amount in [-1, 1]. */
export function shade(color, amount) {
  return amount < 0 ? mix(color, '#000000', -amount) : mix(color, '#ffffff', amount);
}

/** Draw a crisp horizontal gradient bar (dithered to stay pixel-perfect). */
export function gradientV(ctx, x, y, w, h, colors) {
  const n = colors.length;
  for (let row = 0; row < h; row++) {
    const t = h <= 1 ? 0 : row / (h - 1);
    const idx = Math.min(n - 1, Math.floor(t * n));
    ctx.fillStyle = colors[idx];
    ctx.fillRect(Math.round(x), Math.round(y + row), Math.round(w), 1);
  }
}

/** CRT scanline overlay for the final upscaled frame. */
export function drawScanlines(ctx, width, height, alpha = 0.16, step = 3) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < height; y += step) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.globalAlpha = prev;
}

/** Vignette drawn at the final resolution. */
export function drawVignette(ctx, width, height, strength = 0.45) {
  const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.32, width / 2, height / 2, Math.max(width, height) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}
