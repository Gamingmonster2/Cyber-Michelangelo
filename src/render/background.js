/**
 * Parallax pixel environments — three looping "digital Renaissance" themes:
 *   • THE MARBLE GARDENS  (floating classical ruins over a nebula)
 *   • THE NEON CATACOMBS  (runed caverns, bioluminescent crystal)
 *   • THE GRID CATHEDRAL  (gothic spires over a perspective grid)
 *
 * Each theme is deterministically generated once and then scrolled by wrapping
 * its silhouette lists, so the endless stages cost almost nothing per frame.
 */
import { P } from './palette.js';
import {
  makeCanvas, makeCtx, rect, hline, vline, circle, ring, glow, glowSprite,
  withAlpha, mix, bline, poly,
} from './pixel.js';
import { RNG, hashSeed, TAU, clamp } from '../core/math.js';
import { drawText } from './pixelfont.js';

const W = 240;
const H = 420;
const WRAP = 640; // vertical wrap period for scenery

/** Wrap a scenery y coordinate into [-140, WRAP-140). */
function wrapY(y, offset) {
  return ((((y + offset + 140) % WRAP) + WRAP) % WRAP) - 140;
}

export class Background {
  constructor(seed = 1985) {
    this.seed = seed;
    this.cache = new Map();
    this.time = 0;
  }

  data(theme) {
    const hit = this.cache.get(theme.id);
    if (hit) return hit;
    const built = this.build(theme);
    this.cache.set(theme.id, built);
    return built;
  }

  build(theme) {
    const rng = new RNG(hashSeed(this.seed, theme.id, 'bg'));
    const sky = makeCanvas(W, H);
    const sctx = sky.getContext('2d');
    // Banded sky gradient.
    const stops = [theme.skyTop, theme.skyMid, theme.skyLow, mix(theme.skyLow, '#000000', 0.45)];
    for (let y = 0; y < H; y += 4) {
      const t = y / (H - 1);
      const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
      const local = t * (stops.length - 1) - seg;
      sctx.fillStyle = mix(stops[seg], stops[seg + 1], local);
      sctx.fillRect(0, y, W, 4);
    }
    // Baked nebula banks.
    for (let i = 0; i < 5; i++) {
      const x = rng.range(10, W - 10);
      const y = rng.range(20, H - 40);
      const r = rng.range(26, 66);
      const color = rng.pick([theme.haze, theme.accent2, theme.accent, theme.planet]);
      const g = sctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, withAlpha(color, 0.2));
      g.addColorStop(1, withAlpha(color, 0));
      sctx.fillStyle = g;
      sctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Baked faint stars.
    for (let i = 0; i < 90; i++) {
      sctx.fillStyle = withAlpha(rng.pick([P.starDim, P.starMid, P.white]), rng.range(0.15, 0.5));
      sctx.fillRect(rng.int(0, W - 1), rng.int(0, H - 1), 1, 1);
    }

    const stars = [[], [], []];
    for (let i = 0; i < 130; i++) {
      stars[i % 3].push({
        x: rng.range(0, W),
        y: rng.range(0, H),
        color: rng.pick([P.starBright, P.starMid, P.starDim, P.cyanHi, P.goldHi]),
        tw: rng.range(0, TAU),
        phase: rng.range(0, 6.28),
      });
    }

    const data = { theme, sky, stars, far: [], mid: [], near: [], dust: [], planet: null };
    const accents = [theme.accent, theme.accent2, theme.ring];

    if (theme.id === 'gardens') {
      // Floating classical ruins.
      for (let i = 0; i < 9; i++) {
        data.far.push({
          x: rng.range(-10, W + 10),
          y: i * (WRAP / 9) + rng.range(0, 30),
          w: rng.range(24, 48),
          h: rng.range(10, 22),
          kind: 'island',
          color: theme.far,
          accent: rng.pick(accents),
        });
      }
      for (let i = 0; i < 8; i++) {
        data.mid.push({
          x: rng.range(0, W),
          y: i * (WRAP / 8) + rng.range(0, 36),
          h: rng.range(34, 62),
          w: rng.range(10, 18),
          capital: rng.chance(0.7),
          color: theme.mid,
          trim: rng.chance(0.25) ? theme.accent2 : null,
        });
      }
      // Floating broken ruins across the garden (the visual signature).
      for (let i = 0; i < 4; i++) {
        data.mid.push({
          kind: 'ruin',
          x: rng.range(40, W - 40),
          y: i * (WRAP / 4) + rng.range(0, 70),
          w: rng.range(42, 74),
          h: rng.range(24, 42),
          color: theme.mid,
          accent: rng.pick(accents),
        });
      }
      for (let i = 0; i < 5; i++) {
        data.near.push({
          x: rng.chance(0.5) ? rng.range(-8, 34) : rng.range(W - 34, W + 8),
          y: i * (WRAP / 5) + rng.range(0, 50),
          h: rng.range(46, 92),
          w: rng.range(10, 18),
          broken: rng.chance(0.6),
          color: theme.near,
        });
      }
      data.planet = { x: 188, y: 74, r: 25, ring: true, color: theme.planet, shade: theme.planetShade, glowColor: theme.ring };
    } else if (theme.id === 'catacombs') {
      for (let i = 0; i < 10; i++) {
        data.far.push({
          x: rng.range(-10, W + 10),
          y: i * (WRAP / 10) + rng.range(0, 24),
          w: rng.range(30, 80),
          h: rng.range(30, 90),
          kind: rng.chance(0.5) ? 'ceiling' : 'floor',
          color: theme.far,
        });
      }
      // Rune circles etched into the cavern walls.
      for (let i = 0; i < 4; i++) {
        data.far.push({
          kind: 'rune',
          x: rng.range(24, W - 24),
          y: i * (WRAP / 4) + rng.range(10, 60),
          r: rng.range(10, 20),
          accent: rng.pick(accents),
        });
      }
      // Bioluminescent crystal clusters (the catacombs' light source).
      for (let i = 0; i < 6; i++) {
        data.mid.push({
          kind: 'crystal',
          x: rng.range(16, W - 16),
          y: i * (WRAP / 6) + rng.range(0, 40),
          h: rng.range(16, 34),
          w: rng.range(10, 18),
          accent: rng.chance(0.5) ? theme.accent2 : theme.accent,
        });
      }
      for (let i = 0; i < 9; i++) {
        data.mid.push({
          x: rng.range(0, W),
          y: i * (WRAP / 9) + rng.range(0, 40),
          len: rng.range(24, 70),
          w: rng.range(8, 20),
          up: rng.chance(0.55),
          color: theme.mid,
          rune: rng.chance(0.5),
          accent: rng.pick(accents),
        });
      }
      for (let i = 0; i < 6; i++) {
        data.near.push({
          x: rng.chance(0.5) ? rng.range(-8, 26) : rng.range(W - 26, W + 8),
          y: i * (WRAP / 6) + rng.range(0, 40),
          h: rng.range(40, 90),
          w: rng.range(16, 30),
          color: theme.near,
        });
      }
      data.planet = { x: 120, y: 44, r: 12, ring: false, color: theme.planet, shade: theme.planetShade, glowColor: theme.accent };
    } else {
      // Cathedral: gothic skyline + perspective grid.
      for (let i = 0; i < 8; i++) {
        data.far.push({
          x: rng.range(-16, W + 16),
          y: i * (WRAP / 8) + rng.range(0, 26),
          w: rng.range(14, 28),
          h: rng.range(34, 64),
          color: theme.far,
          spire: rng.chance(0.6),
        });
      }
      for (let i = 0; i < 6; i++) {
        data.mid.push({
          x: rng.chance(0.5) ? rng.range(-6, 30) : rng.range(W - 30, W + 6),
          y: i * (WRAP / 6) + rng.range(0, 40),
          h: rng.range(60, 130),
          w: rng.range(14, 24),
          color: theme.mid,
        });
      }
      // Distant flying spires across the cathedral void.
      for (let i = 0; i < 5; i++) {
        data.mid.push({
          kind: 'spire',
          x: rng.range(30, W - 30),
          y: i * (WRAP / 5) + rng.range(0, 50),
          w: rng.range(8, 15),
          h: rng.range(34, 58),
          color: theme.mid,
          accent: rng.pick(accents),
        });
      }
      for (let i = 0; i < 4; i++) {
        data.near.push({
          x: rng.chance(0.5) ? rng.range(-14, 18) : rng.range(W - 18, W + 14),
          y: i * (WRAP / 4) + rng.range(0, 50),
          h: rng.range(52, 96),
          w: rng.range(14, 22),
          color: theme.near,
        });
      }
      data.planet = { x: 120, y: 84, r: 34, ring: false, rose: true, color: theme.planet, shade: theme.planetShade, glowColor: theme.ring };
    }

    // Ambient dust motes.
    for (let i = 0; i < 46; i++) {
      data.dust.push({
        x: rng.range(0, W),
        y: rng.range(0, H),
        speed: rng.range(6, 22),
        color: rng.chance(0.6) ? theme.accent : theme.accent2,
        alpha: rng.range(0.12, 0.4),
        size: rng.chance(0.2) ? 2 : 1,
      });
    }
    return data;
  }

  /* ---------------------------------------------------------------- */
  /* Draw                                                             */
  /* ---------------------------------------------------------------- */

  draw(ctx, theme, scroll = 0, time = 0, opts = {}) {
    this.time = time;
    const data = this.data(theme);
    const dim = opts.dim === undefined ? 1 : opts.dim;
    ctx.drawImage(data.sky, 0, 0);
    this.drawStars(ctx, data, scroll, time, dim);
    this.drawPlanet(ctx, data, scroll, time, dim);

    if (theme.id === 'cathedral') this.drawGrid(ctx, theme, scroll, time, dim);
    // Atmospheric perspective: far layers are hazier, near layers solid.
    this.drawFar(ctx, data, scroll, time, dim * 0.55);
    this.drawMid(ctx, data, scroll, time, dim * 0.82);
    this.drawNear(ctx, data, scroll, dim * 1.0);

    // Speed haze / dust.
    for (const d of data.dust) {
      const y = (d.y + scroll * 0.5 + time * d.speed) % (H + 20) - 10;
      const x = d.x + Math.sin(time * 0.7 + d.y) * 4;
      ctx.globalAlpha = d.alpha * dim;
      rect(ctx, x, y, d.size, d.size, d.color);
    }
    ctx.globalAlpha = 1;
  }

  drawStars(ctx, data, scroll, time, dim) {
    for (let l = 0; l < data.stars.length; l++) {
      const speed = 0.35 + l * 0.4;
      for (const s of data.stars[l]) {
        const y = (s.y + scroll * speed) % H;
        const yy = y < 0 ? y + H : y;
        const twinkle = 0.55 + 0.45 * Math.sin(time * 2 + s.tw);
        ctx.globalAlpha = (l === 0 ? 0.4 : l === 1 ? 0.65 : 0.9) * twinkle * dim;
        rect(ctx, s.x, yy, 1, 1, s.color);
        if (l === 2 && twinkle > 0.94) {
          rect(ctx, s.x - 1, yy, 3, 1, withAlpha(s.color, 0.35));
          rect(ctx, s.x, yy - 1, 1, 3, withAlpha(s.color, 0.35));
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPlanet(ctx, data, scroll, time, dim) {
    const pl = data.planet;
    if (!pl) return;
    const y = pl.y - scroll * 0.08 + Math.sin(time * 0.25) * 3;
    const pulse = 0.6 + 0.4 * Math.sin(time * 1.1);
    if (pl.rose) {
      // Rose window of the grid cathedral.
      glow(ctx, pl.x, y, pl.r * 1.8, pl.glowColor, 0.22 * dim);
      circle(ctx, pl.x, y, pl.r, withAlpha(pl.color, 0.22 * dim));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + time * 0.05;
        const rx = pl.x + Math.cos(a) * pl.r * 0.62;
        const ry = y + Math.sin(a) * pl.r * 0.62;
        circle(ctx, rx, ry, pl.r * 0.24, withAlpha(pl.shade, 0.5 * dim));
      }
      ring(ctx, pl.x, y, pl.r, withAlpha(pl.glowColor, 0.5 + pulse * 0.3), 1);
      ring(ctx, pl.x, y, pl.r * 0.78, withAlpha(pl.color, 0.32 * dim), 1);
      circle(ctx, pl.x, y, pl.r * 0.16, withAlpha(pl.glowColor, 0.7 * dim));
      for (let i = 0; i < 10; i++) {
        const a = time * 0.2 + (i / 10) * TAU;
        rect(ctx, pl.x + Math.cos(a) * pl.r * 1.15, y + Math.sin(a) * pl.r * 1.15, 1, 1, withAlpha(pl.glowColor, 0.5));
      }
    } else {
      glow(ctx, pl.x, y, pl.r * 2.2, pl.glowColor, 0.18 * dim);
      if (pl.ring) {
        for (let i = 0; i < 70; i++) {
          const a = (i / 70) * TAU * 2;
          const rx = pl.x + Math.cos(a) * pl.r * 1.8;
          const ry = y + Math.sin(a) * pl.r * 0.4 + 4;
          if (Math.sin(a) > -0.1) rect(ctx, rx, ry, 1, 1, withAlpha(pl.glowColor, 0.5 * dim));
        }
      }
      circle(ctx, pl.x, y, pl.r, withAlpha(pl.color, 0.85 * dim));
      circle(ctx, pl.x + pl.r * 0.2, y - pl.r * 0.2, pl.r * 0.8, withAlpha('#ffffff', 0.1 * dim));
      ctx.save();
      ctx.beginPath();
      ctx.arc(pl.x, y, pl.r, -0.4, 1.7);
      ctx.fillStyle = withAlpha(pl.shade, 0.85 * dim);
      ctx.fill();
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        circle(ctx, pl.x - pl.r * 0.4 + i * pl.r * 0.3, y + pl.r * 0.2 + (i % 2) * pl.r * 0.3, 1.4, withAlpha(pl.shade, 0.6 * dim));
      }
      if (pl.ring) {
        for (let i = 0; i < 70; i++) {
          const a = (i / 70) * TAU * 2;
          const rx = pl.x + Math.cos(a) * pl.r * 1.8;
          const ry = y + Math.sin(a) * pl.r * 0.4 + 4;
          if (Math.sin(a) > 0.12) rect(ctx, rx, ry, 1, 1, withAlpha(pl.glowColor, 0.75 * dim));
        }
      }
    }
  }

  drawGrid(ctx, theme, scroll, time, dim) {
    const horizon = 236 - (scroll * 0.15) % 40;
    // Ground fill.
    ctx.fillStyle = withAlpha(theme.ground, 0.55 * dim);
    ctx.fillRect(0, horizon, W, H - horizon);
    // Horizontal lines with accelerating spacing.
    for (let i = 0; i < 15; i++) {
      const t = i / 14;
      const y = horizon + Math.pow(t, 2.1) * (H - horizon) + ((scroll * 0.6) % 14);
      if (y < H) hline(ctx, 0, y, W, withAlpha(theme.accent2, 0.1 + t * 0.16 * dim));
    }
    // Vertical converging lines.
    for (let i = -6; i <= 6; i++) {
      ctx.globalAlpha = 0.16 * dim;
      bline(ctx, 120 + i * 44, horizon, 120 + i * 18, H, theme.accent2);
    }
    ctx.globalAlpha = 1;
    // Central aisle glow.
    glow(ctx, 120, horizon + 30, 46, theme.accent, 0.1 * dim);
    hline(ctx, 0, horizon, W, withAlpha(theme.accent, 0.3 * dim));
    // Rose-window reflection on the floor.
    for (let i = 0; i < 4; i++) {
      const y = horizon + 12 + i * 16;
      hline(ctx, 120 - 14 + i * 2, y, 28 - i * 4, withAlpha(theme.ring, 0.06 * dim));
    }
  }

  drawFar(ctx, data, scroll, time, dim) {
    const offset = scroll * 0.22;
    for (const s of data.far) {
      const y = wrapY(s.y, offset);
      if (y < -160 || y > H + 20) continue;
      if (s.kind === 'island') {
        // A small floating fragment of a classical temple.
        const w = s.w;
        const h = s.h;
        ctx.fillStyle = withAlpha(s.color, 0.92 * dim);
        // Floating base slab.
        rect(ctx, s.x - w / 2, y, w, 4, withAlpha(s.color, 0.92 * dim));
        // Rocky underside.
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - w / 2 + (i * w) / 3, y + 4);
          ctx.lineTo(s.x - w / 2 + ((i + 0.5) * w) / 3, y + 4 + h);
          ctx.lineTo(s.x - w / 2 + ((i + 1) * w) / 3, y + 4);
          ctx.closePath();
          ctx.fillStyle = withAlpha(s.color, 0.92 * dim);
          ctx.fill();
        }
        // Tiny temple on top: columns + arch + pediment.
        const colH = 12;
        for (let i = 0; i < 3; i++) {
          const cxp = s.x - w * 0.26 + i * (w * 0.26);
          rect(ctx, cxp, y - colH, 2, colH, withAlpha(s.color, 0.92 * dim));
          rect(ctx, cxp - 1, y - colH - 2, 4, 2, withAlpha(s.color, 0.92 * dim));
        }
        for (let i = 0; i < 8; i++) {
          const a = Math.PI * (i / 7);
          rect(ctx, s.x - Math.cos(a) * w * 0.26, y - colH - 4 - Math.sin(a) * 7, 2, 2, withAlpha(s.color, 0.9 * dim));
        }
        ctx.beginPath();
        ctx.moveTo(s.x - w * 0.32, y - colH - 6);
        ctx.lineTo(s.x, y - colH - 15);
        ctx.lineTo(s.x + w * 0.32, y - colH - 6);
        ctx.closePath();
        ctx.fillStyle = withAlpha(s.color, 0.92 * dim);
        ctx.fill();
        rect(ctx, s.x - 2, y - 1, 1, 1, withAlpha(s.accent, 0.7 * dim));
        rect(ctx, s.x + 1, y - 1, 1, 1, withAlpha(s.accent, 0.45 * dim));
      } else if (s.kind === 'rune') {
        // Glowing rune circle on the cave wall.
        ctx.globalAlpha = 0.35 * dim;
        ring(ctx, s.x, y, s.r, withAlpha(s.accent, 0.5), 1);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + time * 0.2;
          rect(ctx, s.x + Math.cos(a) * s.r, y + Math.sin(a) * s.r, 1, 1, withAlpha(s.accent, 0.7));
        }
        ctx.globalAlpha = 1;
      } else if (s.kind === 'ceiling') {
        ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        for (let i = 0; i < 3; i++) {
          const w = s.w / 3;
          ctx.beginPath();
          ctx.moveTo(s.x - s.w / 2 + i * w, y);
          ctx.lineTo(s.x - s.w / 2 + i * w + w / 2, y + s.h);
          ctx.lineTo(s.x - s.w / 2 + (i + 1) * w, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        }
      } else if (s.kind === 'floor') {
        ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        for (let i = 0; i < 3; i++) {
          const w = s.w / 3;
          ctx.beginPath();
          ctx.moveTo(s.x - s.w / 2 + i * w, y + s.h);
          ctx.lineTo(s.x - s.w / 2 + i * w + w / 2, y);
          ctx.lineTo(s.x - s.w / 2 + (i + 1) * w, y + s.h);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        }
      } else {
        // Cathedral spires.
        ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        rect(ctx, s.x - s.w / 2, y - s.h, s.w, s.h, withAlpha(s.color, 0.95 * dim));
        if (s.spire) {
          ctx.beginPath();
          ctx.moveTo(s.x - s.w / 2, y - s.h);
          ctx.lineTo(s.x, y - s.h - s.w * 1.9);
          ctx.lineTo(s.x + s.w / 2, y - s.h);
          ctx.closePath();
          ctx.fill();
          rect(ctx, s.x, y - s.h - s.w * 1.9 - 3, 1, 3, withAlpha(data.theme.accent2, 0.4 * dim));
        }
        for (let i = 0; i < 3; i++) {
          rect(ctx, s.x - s.w / 2 + 3 + i * (s.w / 3), y - s.h + 12 + (i % 2) * 14, 1, 4, withAlpha(data.theme.accent, 0.25 * dim));
        }
      }
    }
  }

  drawMid(ctx, data, scroll, time, dim) {
    const offset = scroll * 0.55;
    for (const s of data.mid) {
      const y = wrapY(s.y, offset);
      if (y < -180 || y > H + 40) continue;
      if (s.kind === 'ruin') {
        // A floating fragment of a classical temple: rocky base, columns, arch.
        const w = s.w;
        const h = s.h;
        const baseY = y;
        const color = withAlpha(s.color, 0.98 * dim);
        // Floating base slab.
        rect(ctx, s.x - w / 2, baseY, w, 5, color);
        rect(ctx, s.x - w / 2, baseY, w, 1, withAlpha(s.accent, 0.28 * dim));
        // Rocky underside.
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - w / 2 + (i * w) / 3, baseY + 5);
          ctx.lineTo(s.x - w / 2 + ((i + 0.5) * w) / 3, baseY + 5 + h * 0.5);
          ctx.lineTo(s.x - w / 2 + ((i + 1) * w) / 3, baseY + 5);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }
        // Two tapered columns.
        const colTop = baseY - h * 1.1;
        for (const off of [-w * 0.26, w * 0.26]) {
          rect(ctx, s.x + off - 1.5, colTop, 3, h * 1.1 - 5, color);
          rect(ctx, s.x + off - 3, colTop, 6, 2, color);
          rect(ctx, s.x + off - 3, baseY - 7, 6, 2, color);
          vline(ctx, s.x + off - 1, colTop + 3, h * 0.9, withAlpha(s.accent, 0.16 * dim));
        }
        // Broken arch across the column tops.
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (i / 8);
          rect(ctx, s.x - Math.cos(a) * w * 0.26, colTop - 2 - Math.sin(a) * h * 0.5, 2, 2, color);
        }
        // Pediment fragment.
        ctx.beginPath();
        ctx.moveTo(s.x - w * 0.34, colTop - 4);
        ctx.lineTo(s.x - w * 0.05, colTop - 12);
        ctx.lineTo(s.x + w * 0.3, colTop - 4);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        // Neon window slits.
        for (let i = 0; i < 3; i++) {
          rect(ctx, s.x - w * 0.26 + i * (w * 0.26), baseY - h * 0.55, 1, 3, withAlpha(s.accent, 0.4 * dim));
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (s.kind === 'crystal') {
        // Bioluminescent crystal cluster.
        const baseY = y;
        glow(ctx, s.x, baseY - s.h * 0.5, s.h * 1.4, s.accent, 0.3 * dim);
        // Dark rock base.
        circle(ctx, s.x, baseY, s.w * 0.55, withAlpha(P.black, 0.4 * dim));
        // Crystal shards.
        const shards = [
          { ox: 0, len: s.h, w2: 3 },
          { ox: -s.w * 0.34, len: s.h * 0.62, w2: 2 },
          { ox: s.w * 0.32, len: s.h * 0.72, w2: 2 },
        ];
        for (const shard of shards) {
          poly(ctx, [
            [s.x + shard.ox, baseY - shard.len],
            [s.x + shard.ox + shard.w2, baseY - shard.len * 0.55],
            [s.x + shard.ox + shard.w2 * 0.6, baseY],
            [s.x + shard.ox - shard.w2 * 0.6, baseY],
            [s.x + shard.ox - shard.w2, baseY - shard.len * 0.55],
          ], withAlpha(s.accent, 0.55 * dim));
          vline(ctx, s.x + shard.ox, baseY - shard.len + 2, shard.len * 0.7, withAlpha(P.white, 0.25 * dim));
        }
        for (let i = 0; i < 3; i++) {
          rect(ctx, s.x + Math.sin(time * 2 + i * 2) * (s.w * 0.8), baseY - s.h - 2 - i * 3, 1, 1, withAlpha(s.accent, 0.7));
        }
        continue;
      }
      if (s.kind === 'spire') {
        // Distant cathedral spire with lit windows.
        ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        rect(ctx, s.x - s.w / 2, y - s.h, s.w, s.h, withAlpha(s.color, 0.95 * dim));
        // Stepped top.
        rect(ctx, s.x - s.w * 0.32, y - s.h - 7, s.w * 0.64, 8, withAlpha(s.color, 0.95 * dim));
        rect(ctx, s.x - s.w * 0.18, y - s.h - 15, s.w * 0.36, 8, withAlpha(s.color, 0.95 * dim));
        // Finial.
        rect(ctx, s.x, y - s.h - 22, 1, 7, withAlpha(s.accent, 0.4 * dim));
        // Gothic windows.
        for (let i = 0; i < 3; i++) {
          const wx = s.x - s.w * 0.24 + i * (s.w * 0.24);
          const wy = y - s.h * 0.78 + (i % 2) * 6;
          rect(ctx, wx, wy, 2, 5, withAlpha(data.theme.accent2, 0.3 * dim));
          rect(ctx, wx, wy - 1, 1, 1, withAlpha(data.theme.accent2, 0.4 * dim));
        }
        // Buttress lines.
        vline(ctx, s.x - s.w / 2, y - s.h * 0.6, s.h * 0.55, withAlpha(P.black, 0.25 * dim));
        vline(ctx, s.x + s.w / 2 - 1, y - s.h * 0.6, s.h * 0.55, withAlpha(P.black, 0.25 * dim));
        continue;
      }
      if (s.len !== undefined) {
        // Catacomb stalactite / stalagmite.
        const dir = s.up ? -1 : 1;
        ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        for (let i = 0; i < 4; i++) {
          const w = Math.max(1, s.w - i * (s.w / 5));
          const len = s.len * (1 - i * 0.16);
          ctx.fillRect(Math.round(s.x - w / 2 + (i % 2) * 0.5), Math.round(y - (dir < 0 ? len : 0)), Math.round(w), Math.round(len));
        }
        if (s.rune) {
          const runeY = y - dir * (6 + Math.sin(time * 2 + s.x) * 2);
          rect(ctx, s.x - 1, runeY - 3, 2, 6, withAlpha(s.accent, 0.4 * dim + 0.2));
          rect(ctx, s.x - 3, runeY - 1, 1, 1, withAlpha(s.accent, 0.5 * dim));
          rect(ctx, s.x + 2, runeY + 1, 1, 1, withAlpha(s.accent, 0.5 * dim));
        }
      } else {
        // Classical column / flying buttress.
        const h = s.h;
        const top = y - h;
        ctx.fillStyle = withAlpha(s.color, 0.95 * dim);
        if (s.broken) {
          rect(ctx, s.x - s.w / 2, top + h * 0.35, s.w, h * 0.65, withAlpha(s.color, 0.95 * dim));
          for (let i = 0; i < 3; i++) {
            rect(ctx, s.x - s.w / 2 + i * (s.w / 3), top + h * 0.35 - (i % 2) * 4, 2, 4, withAlpha(s.color, 0.95 * dim));
          }
        } else {
          rect(ctx, s.x - s.w / 2, top, s.w, h, withAlpha(s.color, 0.95 * dim));
          rect(ctx, s.x - s.w / 2 - 2, top - 3, s.w + 4, 3, withAlpha(s.color, 0.95 * dim));
          rect(ctx, s.x - s.w / 2 - 2, y - 2, s.w + 4, 2, withAlpha(s.color, 0.95 * dim));
          for (let i = 0; i < 3; i++) {
            vline(ctx, s.x - s.w / 3 + i * (s.w / 3), top + 5, h - 9, 'rgba(0,0,0,0.18)');
          }
          if (s.trim) {
            rect(ctx, s.x - s.w / 2 - 2, top - 3, s.w + 4, 1, withAlpha(s.trim, 0.35 * dim));
            vline(ctx, s.x, top + 6, h - 12, withAlpha(s.trim, 0.12 * dim));
          }
        }
        if (s.capital) rect(ctx, s.x - s.w / 2 - 3, top - 6, s.w + 6, 3, withAlpha(s.color, 0.95 * dim));
      }
    }
  }

  drawNear(ctx, data, scroll, dim) {
    const offset = scroll * 1.15;
    for (const s of data.near) {
      const y = wrapY(s.y, offset);
      if (y < -140 || y > H + 60) continue;
      const isCatacomb = data.theme.id === 'catacombs';
      const isGarden = data.theme.id === 'gardens';
      ctx.fillStyle = withAlpha(s.color, 0.98 * dim);
      if (s.kind === undefined && s.h) {
        // Column shaft (slim, with capital/base and rim light both sides).
        rect(ctx, s.x - s.w / 2, y - s.h, s.w, s.h, withAlpha(s.color, 0.98 * dim));
        // base + capital
        rect(ctx, s.x - s.w / 2 - 3, y - 6, s.w + 6, 6, withAlpha(s.color, 0.98 * dim));
        if (!s.broken) {
          rect(ctx, s.x - s.w / 2 - 3, y - s.h - 4, s.w + 6, 4, withAlpha(s.color, 0.98 * dim));
        } else {
          for (let i = 0; i < 3; i++) {
            rect(ctx, s.x - s.w / 2 + i * (s.w / 3), y - s.h - (i % 2) * 5, 2, 5, withAlpha(s.color, 0.98 * dim));
          }
        }
        // fluting + neon rim
        vline(ctx, s.x - s.w / 2 + 1, y - s.h + 4, Math.max(0, s.h - 10), withAlpha(data.theme.accent, 0.1 * dim));
        vline(ctx, s.x + s.w / 2 - 2, y - s.h + 4, Math.max(0, s.h - 10), withAlpha(data.theme.accent, 0.05 * dim));
        if (isGarden) {
          // hanging vines / glowing moss
          for (let i = 0; i < 3; i++) {
            const vx = s.x - s.w / 2 + 2 + i * (s.w / 3);
            const len = 6 + ((i * 7) % 12);
            vline(ctx, vx, y - s.h + 2, len, withAlpha(data.theme.accent2, 0.2 * dim));
            rect(ctx, vx, y - s.h + 2 + len, 1, 1, withAlpha(data.theme.accent, 0.4 * dim));
          }
        }
        if (isCatacomb) {
          for (let i = 0; i < 4; i++) {
            rect(ctx, s.x + (i % 2 ? 2 : -3), y - s.h + 10 + i * 12, 2, 1, withAlpha(data.theme.accent, 0.18 * dim));
          }
        }
        if (data.theme.id === 'cathedral') {
          // Gothic lancet windows glowing in the foreground piers.
          for (let i = 0; i < 3; i++) {
            const wy = y - s.h + 14 + i * 20;
            if (wy > H || wy < 0) continue;
            rect(ctx, s.x - 1, wy, 3, 8, withAlpha(data.theme.accent2, 0.22 * dim));
            rect(ctx, s.x - 1, wy - 1, 1, 1, withAlpha(data.theme.accent2, 0.3 * dim));
            rect(ctx, s.x + 1, wy - 1, 1, 1, withAlpha(data.theme.accent2, 0.3 * dim));
          }
        }
      }
    }
  }
}

export { wrapY, WRAP };
