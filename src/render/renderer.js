/**
 * The renderer: paints the whole game into the 240×420 pixel buffer, then
 * upscales it to the visible canvas with nearest-neighbour filtering.
 *
 * Renderer also owns all *visual* effects (particles, screen shake, flashes)
 * exposed to the game through `renderer.fx`, so simulation code stays clean.
 */
import { P, THEMES } from './palette.js';
import {
  PixelScreen, PIX_W, PIX_H, rect, hline, vline, circle, ring, bline, poly, beam,
  glow, glowRect, drawSprite, maskFor, withAlpha, frameRect, drawScanlines,
  drawVignette, mix,
} from './pixel.js';
import { drawText, measureText } from './pixelfont.js';
import { drawTitleHD } from './art_title.js';
import {
  drawHudHD, drawBossBarHD, drawBannerHD, drawPopupsHD, drawFormationHudHD, drawTouchControlsHD,
} from './ui_hd.js';
import {
  drawHowto, drawCredits, drawOptions, drawPause, drawGameover,
} from './screens.js';
import { PLAYER, MODULE_BY_ID, MODULE_DEFS, MODULE_ORDER, FIELD, PODS } from '../game/config.js';
import { saveSettings } from '../core/storage.js';
import { drawPlayerCraftHD } from './art_player.js';
import { drawEnemyArt } from './art_enemies.js';
import { drawPodHD, drawModulePickupHD, drawGemHD, drawNovaHD, drawHeartHD } from './art_pickups.js';
import { drawBossHD } from './art_boss.js';
import { BackgroundHD } from './art_background.js';
import { clamp, formatScore, TAU } from '../core/math.js';

const COLORS = {
  cyan: P.cyan,
  cyanHi: P.cyanHi,
  gold: P.gold,
  goldHi: P.goldHi,
  red: P.red,
  orange: P.orange,
  orangeHi: P.orangeHi,
  green: P.green,
  magenta: P.magenta,
  white: P.marbleHi,
  steel: P.steel,
};

export class Renderer {
  constructor(canvas, sprites, canvas3d) {
    this.canvas = canvas;
    this.canvas3d = canvas3d || null;
    this.display = canvas.getContext('2d');
    this.sprites = sprites;
    this.screen = new PixelScreen(PIX_W, PIX_H, 1);
    this.screenScale = 1;
    this.bgHD = new BackgroundHD();
    this.clock = 0;
    this.particles = [];
    this.shakeAmt = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flashAmt = 0;
    this.flashColor = '#ffffff';
    this.scanlines = true;
    this.dpr = 1;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    // Optional WebGL renderer (Phase 2). Lazily imported so the classic
    // HD-2D path keeps loading instantly even if 3D is never enabled.
    this.renderer3d = null;
    this.renderer3dTried = false;
    this.renderer3dFailed = false;
    this.use3d = false;
    this._3dNotified = false;
    this.cssW = 0;
    this.cssH = 0;

    this.fx = {
      explosion: (x, y, size = 'medium') => this.spawnExplosion(x, y, size),
      ring: (x, y, radius, colorName = 'cyan') => this.spawnRing(x, y, radius, COLORS[colorName] || P.cyan),
      muzzle: (x, y, colorName = 'cyan') => this.spawnPuff(x, y, COLORS[colorName] || P.cyan, 3),
      flame: (x, y) => this.spawnFlame(x, y),
      spark: (x, y, colorName = 'white') => this.spawnSpark(x, y, COLORS[colorName] || P.marbleHi, 3),
      shake: (amount = 0.2) => { this.shakeAmt = Math.max(this.shakeAmt, amount); },
      flash: (amount = 0.3, color = 'white') => {
        this.flashAmt = Math.max(this.flashAmt, Math.min(1, amount));
        this.flashColor = COLORS[color] || color || P.marbleHi;
      },
      nova: (x, y) => this.novaBurst(x, y),
      beamHit: (x, y) => this.spawnSpark(x, y, P.goldHi, 4),
    };
  }

  resize(cssW, cssH, dpr) {
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.display.imageSmoothingEnabled = false;
    // Render the offscreen buffer at (close to) device resolution so vector
    // art and gradients keep their detail at any screen size / DPR.
    const desired = clamp(Math.round(this.canvas.width / PIX_W), 1, 4);
    if (desired !== this.screenScale) {
      this.screenScale = desired;
      this.screen = new PixelScreen(PIX_W, PIX_H, desired);
    }
    if (this.renderer3d) this.renderer3d.resize(cssW, cssH, dpr);
  }

  /** Load and initialise the optional three.js renderer on first use. */
  ensure3D() {
    if (this.renderer3dTried) return;
    this.renderer3dTried = true;
    import('../render3d/renderer3d.js')
      .then((mod) => {
        if (!this.canvas3d) {
          this.renderer3dFailed = true;
          return;
        }
        const r = new mod.Renderer3D(this.canvas3d);
        if (!r.init()) {
          this.renderer3dFailed = true;
          return;
        }
        this.renderer3d = r;
        if (this.cssW > 0) r.resize(this.cssW, this.cssH, this.dpr);
      })
      .catch((err) => {
        console.warn('[renderer] 3D renderer unavailable:', err);
        this.renderer3dFailed = true;
      });
  }

  /* ================================================================ */
  /* Frame                                                            */
  /* ================================================================ */

  render(game, input, dt) {
    this.clock += dt;
    this.tickStats(dt);
    this.updateParticles(dt);

    // Shake decay & offset.
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.6);
    this.shakeX = Math.round((Math.random() * 2 - 1) * this.shakeAmt * 3);
    this.shakeY = Math.round((Math.random() * 2 - 1) * this.shakeAmt * 3);
    this.flashAmt = Math.max(0, this.flashAmt - dt * 2.8);

    // ---- Optional 3D layer -------------------------------------------
    const wants3d = Boolean(game.settings && game.settings.renderStyle === '3d');
    const gameplayScene = game.scene === 'playing' || game.scene === 'paused' || game.scene === 'gameover';
    if (wants3d && !this.renderer3dTried) this.ensure3D();
    if (wants3d && gameplayScene && this.renderer3dFailed && !this._3dNotified) {
      this._3dNotified = true;
      game.settings.renderStyle = 'hd';
      saveSettings(game.settings);
      if (typeof game.addPopup === 'function') {
        game.addPopup('3D UNAVAILABLE · SWITCHED TO HD-2D', 120, 150, 'red', 2.6);
      }
    }
    const use3d = wants3d && gameplayScene && Boolean(this.renderer3d) && this.renderer3d.ready;
    this.use3d = use3d;
    if (this.canvas3d) this.canvas3d.style.display = use3d ? 'block' : 'none';
    // HD-2D is vector art: always let the browser smooth the upscale instead
    // of showing chunky pixels on phones with a higher DPR.
    this.canvas.style.imageRendering = 'auto';
    if (use3d) this.renderer3d.render(game, game.time, dt);

    const ctx = this.screen.ctx;
    if (use3d) this.screen.clearTransparent();
    else this.screen.clear(P.void);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    switch (game.scene) {
      case 'title':
        drawTitleHD(ctx, game.time, {
          menuIndex: game.menuIndex,
          hiScore: game.hiScore,
          bg: this.bgHD,
          scale: this.screenScale,
          settings: game.settings,
        });
        break;
      case 'howto':
      case 'credits':
      case 'options':
        drawTitleHD(ctx, game.time, {
          menuIndex: -1,
          hiScore: game.hiScore,
          bg: this.bgHD,
          scale: this.screenScale,
          backdropOnly: true,
          settings: game.settings,
        });
        if (game.scene === 'howto') drawHowto(ctx, game);
        else if (game.scene === 'credits') drawCredits(ctx, game, game.time);
        else drawOptions(ctx, game);
        break;
      case 'paused':
        this.drawGame(ctx, game, input, true);
        drawPause(ctx, game);
        break;
      case 'gameover':
        this.drawGame(ctx, game, input, true);
        drawGameover(ctx, game);
        break;
      default:
        this.drawGame(ctx, game, input, false);
        break;
    }

    if (game.settings.showFps) {
      ctx.save();
      ctx.font = '600 5px "Bahnschrift", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = withAlpha(P.steelMid, 0.85);
      ctx.fillText(Math.round(this.fps) + ' FPS', 234, 417);
      ctx.restore();
    }
    return this.screen;
  }

  tickStats(dt) {
    this._fpsAcc += dt;
    this._fpsFrames += 1;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }
  }

  present(game) {
    const d = this.display;
    const cvs = this.canvas;
    if (!cvs.width || !cvs.height) return;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.imageSmoothingEnabled = true;
    d.imageSmoothingQuality = 'high';
    d.globalAlpha = 1;
    if (this.use3d) {
      d.clearRect(0, 0, cvs.width, cvs.height);
    } else {
      d.fillStyle = '#04030a';
      d.fillRect(0, 0, cvs.width, cvs.height);
    }
    const stepX = cvs.width / PIX_W;
    const stepY = cvs.height / PIX_H;
    d.drawImage(
      this.screen.canvas,
      0, 0, this.screen.canvas.width, this.screen.canvas.height,
      Math.round(this.shakeX * stepX), Math.round(this.shakeY * stepY),
      cvs.width, cvs.height,
    );
    if (this.flashAmt > 0.01) {
      d.globalAlpha = Math.min(1, this.flashAmt);
      d.fillStyle = this.flashColor;
      d.fillRect(0, 0, cvs.width, cvs.height);
      d.globalAlpha = 1;
    }
    drawVignette(d, cvs.width, cvs.height, 0.36);
    if (this.scanlines && (!game || game.settings.scanlines !== false)) {
      drawScanlines(d, cvs.width, cvs.height, 0.085, Math.max(2, Math.round(2 * this.dpr)));
    }
  }

  /* ================================================================ */
  /* Game scene                                                       */
  /* ================================================================ */

  drawGame(ctx, game, input, frozen) {
    if (!this.use3d) {
      const theme = game.theme || THEMES[0];
      const scroll = (game.runTime || 0) * 34 + (game.stage - 1) * 90;
      this.bgHD.draw(ctx, theme, scroll, game.time, this.screenScale);
    }

    // Gameplay entities are clipped below the HUD so nothing bleeds into it.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 34, 240, 420 - 34);
    ctx.clip();
    if (this.use3d) {
      // The WebGL underlay owns ships/enemies/boss/backdrop; 2D paints the
      // crisp overlay layers: bullets, particles and readable pod numerals.
      this.drawPlayerBullets(ctx, game);
      this.drawEnemyBullets(ctx, game);
      this.drawParticles(ctx);
      if (game.podCluster) {
        for (const pod of game.podCluster.pods) {
          if (pod.dead) continue;
          const accent = pod.num == null ? P.goldHi
            : (MODULE_DEFS.find((m) => m.num === pod.num) || {}).accent || P.cyanHi;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.font = '800 6.5px "Bahnschrift", "Segoe UI", Arial, sans-serif';
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 3;
          ctx.fillStyle = accent;
          ctx.fillText(pod.num == null ? '*' : String(pod.num), pod.x, pod.y + 15);
          ctx.restore();
        }
      }
    } else {
      this.drawPods(ctx, game);
      this.drawPickups(ctx, game);
      this.drawEnemies(ctx, game);
      this.drawBoss(ctx, game);
      this.drawPlayerBullets(ctx, game);
      this.drawEnemyBullets(ctx, game);
      if (!frozen) this.drawPlayer(ctx, game);
      this.drawParticles(ctx);
    }
    ctx.restore();

    drawHudHD(ctx, game);
    drawBossBarHD(ctx, game);
    drawFormationHudHD(ctx, game);
    drawBannerHD(ctx, game);
    drawPopupsHD(ctx, game);
    drawTouchControlsHD(ctx, game, input);

    // First-run guidance: teach the pod → module loop in the first seconds.
    if (game.scene === 'playing' && game.stage === 1 && game.tutorialTimer > 0 && !game.player.hasAllModules) {
      const fadeIn = Math.min(1, (18 - game.tutorialTimer) / 1.2);
      const fadeOut = Math.min(1, game.tutorialTimer / 1.5);
      const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
      if (alpha > 0.02) {
        const msg = game.player.modules.length === 0
          ? 'SHOOT THE 4 GROUND PODS TO FREE A MODULE'
          : 'MODULES ARE SHIELDS · PRESS X TO SPLIT';
        const w = measureText(msg, { scale: 1, spacing: 0 }).w;
        ctx.globalAlpha = alpha * 0.9;
        rect(ctx, 120 - w / 2 - 4, 40, w + 8, 11, 'rgba(4,3,10,0.8)');
        hline(ctx, 120 - w / 2 - 4, 40, w + 8, withAlpha(P.cyanSh, 0.5));
        drawText(ctx, msg, 120, 42, {
          align: 'center', scale: 1, spacing: 0, color: P.cyanHi,
          shadow: { x: 1, y: 1, color: 'rgba(0,0,0,0.8)' },
        });
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Player                                                           */
  /* ---------------------------------------------------------------- */

  drawPlayer(ctx, game) {
    const p = game.player;
    if (p.dead) return;

    if (p.phoenixActive) {
      this.drawPhoenix(ctx, game, p);
      return;
    }

    // Invulnerability blink: draw dimmed rather than vanishing.
    const blink = p.invuln > 0 && !p.formationActive && Math.floor(this.clock * 20) % 2 === 0;
    const prevAlpha = ctx.globalAlpha;
    if (blink) ctx.globalAlpha = 0.35;

    // Contact shadow + hero halo for separation from the background.
    circle(ctx, p.x, p.y + 12, 9, withAlpha(P.black, 0.3));
    glow(ctx, p.x, p.y, 20, P.cyan, 0.07);
    this.drawPlayerShadow(ctx, p);
    const modules = p.moduleWorldPositions();

    // Formation tethers.
    if (p.formationActive) {
      for (const m of modules) {
        ctx.globalAlpha = 0.55;
        bline(ctx, p.x, p.y, m.x, m.y, P.cyan);
        ctx.globalAlpha = 1;
        ring(ctx, m.x, m.y, 7 + Math.sin(this.clock * 5 + m.x) * 1.5, withAlpha(def0Color(m.id), 0.35), 1);
        // Orbit sparkle.
        if (Math.random() < 0.2) this.spawnSpark(m.x, m.y, P.cyanHi, 1);
      }
    }

    // Epsilon field bubble.
    const field = p.activeField();
    if (field) {
      const pulse = 0.6 + 0.4 * Math.sin(this.clock * 4);
      ctx.globalAlpha = 0.5;
      ring(ctx, field.x, field.y, field.r, withAlpha(P.green, 0.4 * pulse), 1);
      ring(ctx, field.x, field.y, field.r - 3, withAlpha(P.greenSh, 0.25 * pulse), 1);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) {
        const a = this.clock * 2 + i * (TAU / 4);
        rect(ctx, field.x + Math.cos(a) * field.r, field.y + Math.sin(a) * field.r * 0.8, 1, 1, withAlpha(P.greenHi, 0.7));
      }
      glow(ctx, field.x, field.y + 2, field.r * 0.7, P.green, 0.08 * pulse);
    }

    // Docked modules + HD player craft (vector art at device resolution).
    drawPlayerCraftHD(ctx, p, this.clock);

    if (p.hitPulse > 0.55) {
      glow(ctx, p.x, p.y, 22, P.white, p.hitPulse * 0.35);
    }

    // Phoenix-ready prompt floats above the ship (never collides with the HUD).
    if (p.hasAllModules && !p.phoenixActive) {
      const blinkOn = Math.floor(this.clock * 4) % 2 === 0;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '800 6px "Bahnschrift", "Segoe UI", Arial, sans-serif';
      try { ctx.letterSpacing = '1.2px'; } catch { /* ignore */ }
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = blinkOn ? P.orangeHi : P.orange;
      ctx.fillText('PHOENIX READY', p.x, p.y - 30);
      ctx.font = '800 5.4px "Bahnschrift", "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = P.goldHi;
      ctx.fillText('PRESS X', p.x, p.y - 23);
      ctx.restore();
    }
    ctx.globalAlpha = prevAlpha;
  }

  drawPlayerShadow(ctx, p) {
    // Soft light on the craft.
    glow(ctx, p.x, p.y, 16, P.cyan, 0.05);
  }

  drawPhoenix(ctx, game, p) {
    const t = this.clock;
    const palette = [P.orangeSh, P.orange, P.orangeHi, P.gold, P.goldHi, P.marbleHi];
    // Aura.
    glow(ctx, p.x, p.y, 34, P.orange, 0.35 + 0.05 * Math.sin(t * 8));
    glow(ctx, p.x, p.y, 20, P.goldHi, 0.25);
    ring(ctx, p.x, p.y, 16 + Math.sin(t * 6) * 2, withAlpha(P.goldHi, 0.5), 1);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i / 3) * TAU;
      rect(ctx, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 14, 1, 1, P.goldHi);
    }

    // Wings (mirrored, layered flame feathers).
    for (const side of [-1, 1]) {
      const flap = Math.sin(t * 7) * 2;
      poly(ctx, [
        [p.x, p.y - 3],
        [p.x + side * (19 + flap), p.y - 17 - flap],
        [p.x + side * 35, p.y - 5],
        [p.x + side * 24, p.y + 7],
        [p.x + side * 10, p.y + 4],
      ], P.orangeSh);
      poly(ctx, [
        [p.x + side * 2, p.y - 4],
        [p.x + side * 16, p.y - 13 - flap * 0.5],
        [p.x + side * 26, p.y - 4],
        [p.x + side * 16, p.y + 4],
      ], P.orange);
      poly(ctx, [
        [p.x + side * 3, p.y - 3],
        [p.x + side * 12, p.y - 8],
        [p.x + side * 18, p.y - 1],
        [p.x + side * 11, p.y + 3],
      ], P.goldHi);
    }

    // Tail flames.
    for (let i = 0; i < 3; i++) {
      const wig = Math.sin(t * 12 + i * 2) * 2;
      poly(ctx, [
        [p.x - 7 + i * 7, p.y + 8],
        [p.x - 4 + i * 7 + wig, p.y + 20 + (i % 2) * 5],
        [p.x - 1 + i * 7, p.y + 8],
      ], palette[i]);
    }

    // Body & head.
    poly(ctx, [
      [p.x, p.y - 13],
      [p.x + 8, p.y - 4],
      [p.x + 5, p.y + 9],
      [p.x, p.y + 13],
      [p.x - 5, p.y + 9],
      [p.x - 8, p.y - 4],
    ], P.gold);
    poly(ctx, [
      [p.x, p.y - 10],
      [p.x + 4, p.y - 2],
      [p.x, p.y + 6],
      [p.x - 4, p.y - 2],
    ], P.marbleHi);
    rect(ctx, p.x - 1, p.y - 7, 1, 1, P.cyan);
    rect(ctx, p.x + 1, p.y - 7, 1, 1, P.cyan);
    // Crest.
    rect(ctx, p.x, p.y - 16, 1, 4, P.orangeHi);
    rect(ctx, p.x - 2, p.y - 14, 1, 3, P.orange);
    rect(ctx, p.x + 2, p.y - 14, 1, 3, P.orange);

    // Ember trail.
    if (Math.random() < 0.7) this.spawnFlame(p.x + (Math.random() - 0.5) * 14, p.y + 8 + Math.random() * 6);
    if (Math.random() < 0.4) this.spawnSpark(p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 12, P.goldHi, 1);
  }

  /* ---------------------------------------------------------------- */
  /* Enemies                                                          */
  /* ---------------------------------------------------------------- */

  drawEnemies(ctx, game) {
    for (const e of game.enemies) {
      if (e.dead) continue;
      const alpha = e.y < 0 ? 0.5 : 1;
      if (e.shielded) {
        // Aegis shield arc.
        const pulse = 0.5 + 0.3 * Math.sin(this.clock * 5 + e.uid);
        ctx.globalAlpha = 0.7 * alpha;
        ring(ctx, e.x, e.y, 13, withAlpha(P.cyan, 0.35 * pulse), 1);
        ctx.globalAlpha = 1;
      }
      if (e.kind === 'lance' && e.charging > 0) {
        // Telegraph line toward the player.
        const p = game.player;
        if (p) {
          ctx.globalAlpha = 0.4 + 0.3 * Math.sin(this.clock * 30);
          bline(ctx, e.x, e.y, p.x, p.y, withAlpha(P.violet, 0.5));
          ctx.globalAlpha = 1;
        }
      }
      glow(ctx, e.x, e.y, e.r + 7, e.kind === 'goliath' ? P.magentaSh : P.steelDeep, 0.22 * alpha);
      ctx.globalAlpha = alpha;
      drawEnemyArt(ctx, e, this.clock);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Boss                                                             */
  /* ---------------------------------------------------------------- */

  drawBossLegacy(ctx, game) {
    const boss = game.boss;
    if (!boss) return;
    const t = this.clock;
    const dying = boss.state === 'dying';
    const flicker = dying && Math.floor(t * 18) % 2 === 0;
    const x = boss.x;
    const y = boss.y;
    const phaseColor = boss.phase >= 3 ? P.red : boss.phase === 2 ? P.magenta : P.cyan;
    const eyeColor = boss.phase >= 3 ? P.red : boss.phase === 2 ? P.magenta : P.cyanHi;

    // Dying explosions.
    if (dying && Math.random() < 0.25) {
      this.spawnExplosion(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 60, 'medium');
    }

    // Back rings.
    for (let i = 0; i < 2; i++) {
      const r = boss.r + 22 + i * 12;
      ctx.globalAlpha = 0.35 - i * 0.1;
      ring(ctx, x, y, r, withAlpha(phaseColor, 0.4), 1);
      const a = t * (i % 2 ? -0.4 : 0.5) + i;
      for (let k = 0; k < 6; k++) {
        const aa = a + (k / 6) * TAU;
        rect(ctx, x + Math.cos(aa) * r, y + Math.sin(aa) * r, 1, 1, withAlpha(phaseColor, 0.6));
      }
    }
    ctx.globalAlpha = 1;

    // Aura.
    glow(ctx, x, y, 56, P.magentaSh, 0.2);
    glow(ctx, x, y, 30, phaseColor, 0.18);

    // Hands.
    for (const h of boss.hands) {
      if (h.alive) {
        glow(ctx, h.x, h.y, 18, phaseColor, 0.14);
        // Fist: stacked plates.
        poly(ctx, [
          [h.x - 10, h.y - 8], [h.x + 10, h.y - 8], [h.x + 12, h.y + 4],
          [h.x + 6, h.y + 11], [h.x - 6, h.y + 11], [h.x - 12, h.y + 4],
        ], P.marbleMid);
        poly(ctx, [
          [h.x - 8, h.y - 6], [h.x + 8, h.y - 6], [h.x + 9, h.y + 2],
          [h.x + 4, h.y + 8], [h.x - 4, h.y + 8], [h.x - 9, h.y + 2],
        ], P.marble);
        for (let i = 0; i < 3; i++) {
          rect(ctx, h.x - 7 + i * 5, h.y - 4, 3, 2, P.marbleSh);
        }
        rect(ctx, h.x - 9, h.y - 9, 18, 2, P.goldSh);
        rect(ctx, h.x - 2, h.y + 2, 4, 3, withAlpha(P.gold, 0.7));
        if (h.flash > 0) {
          ctx.globalAlpha = Math.min(0.9, h.flash);
          circle(ctx, h.x, h.y, 11, P.white);
          ctx.globalAlpha = 1;
        }
        // Cannon eye.
        circle(ctx, h.x, h.y + 6, 2, withAlpha(eyeColor, 0.9));
        glow(ctx, h.x, h.y + 6, 6, eyeColor, 0.4);
      } else {
        // Severed stump.
        for (let i = 0; i < 5; i++) {
          const px = h.x - 8 + i * 4;
          const py = h.y - 2 + Math.sin(t * 4 + i) * 2;
          rect(ctx, px, py, 2, 2, withAlpha(P.steelSh, 0.6));
        }
        if (Math.random() < 0.15) this.spawnSpark(h.x, h.y, P.orange, 1);
      }
    }

    if (flicker) return;

    // Head statue mask.
    ctx.globalAlpha = 1;
    poly(ctx, [
      [x - 30, y - 22], [x - 18, y - 34], [x, y - 38], [x + 18, y - 34],
      [x + 30, y - 22], [x + 32, y - 2], [x + 22, y + 20], [x, y + 30],
      [x - 22, y + 20], [x - 32, y - 2],
    ], P.marbleDeep);
    poly(ctx, [
      [x - 24, y - 20], [x - 14, y - 29], [x, y - 32], [x + 14, y - 29],
      [x + 24, y - 20], [x + 25, y - 4], [x + 16, y + 14], [x, y + 22],
      [x - 16, y + 14], [x - 25, y - 4],
    ], P.marbleMid);
    poly(ctx, [
      [x - 18, y - 16], [x, y - 26], [x + 18, y - 16], [x + 16, y], [x, y + 10], [x - 16, y],
    ], P.marble);
    // Nose ridge & brow.
    rect(ctx, x - 1, y - 18, 2, 14, P.marbleSh);
    rect(ctx, x - 12, y - 14, 7, 2, P.marbleHi);
    rect(ctx, x + 6, y - 14, 7, 2, P.marbleHi);
    // Eyes.
    for (const side of [-1, 1]) {
      const ex = x + side * 11;
      const ey = y - 8;
      rect(ctx, ex - 4, ey - 2, 8, 4, P.outline);
      rect(ctx, ex - 3, ey - 1, 6, 2, withAlpha(eyeColor, 0.9));
      rect(ctx, ex - 2, ey - 1, 2, 1, P.white);
      glow(ctx, ex, ey, 9, eyeColor, 0.4 + 0.15 * Math.sin(t * 5));
    }
    // Mouth grille.
    rect(ctx, x - 12, y + 12, 24, 5, P.outline);
    for (let i = 0; i < 6; i++) {
      rect(ctx, x - 11 + i * 4, y + 13, 2, 3, withAlpha(phaseColor, 0.55));
    }
    // Gold crown / halo spikes.
    for (let i = 0; i < 5; i++) {
      const sx = x - 24 + i * 12;
      const sy = y - 32 - (i === 2 ? 8 : i % 2 === 0 ? 4 : 2);
      poly(ctx, [
        [sx - 3, y - 26], [sx, sy], [sx + 3, y - 26],
      ], i % 2 === 0 ? P.gold : P.goldSh);
    }
    rect(ctx, x - 22, y - 27, 44, 3, withAlpha(P.gold, 0.8));
    // Cheek circuitry.
    for (let i = 0; i < 3; i++) {
      rect(ctx, x - 28 + i * 2, y + 2 + i * 4, 2, 1, withAlpha(phaseColor, 0.4));
      rect(ctx, x + 26 - i * 2, y + 2 + i * 4, 2, 1, withAlpha(phaseColor, 0.4));
    }
    if (boss.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, boss.flash);
      circle(ctx, x, y, 30, P.white);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Projectiles / pods / pickups                                     */
  /* ---------------------------------------------------------------- */

  drawPlayerBullets(ctx, game) {
    for (const b of game.playerBullets) {
      const color = COLORS[b.color] || P.cyan;
      if (b.kind === 'lance') {
        glow(ctx, b.x, b.y, 9, P.goldHi, 0.45);
        const g = ctx.createLinearGradient(b.x, b.y - 10, b.x, b.y + 10);
        g.addColorStop(0, withAlpha(P.goldHi, 0));
        g.addColorStop(0.3, P.goldHi);
        g.addColorStop(0.5, P.white);
        g.addColorStop(0.7, P.gold);
        g.addColorStop(1, withAlpha(P.goldSh, 0));
        ctx.fillStyle = g;
        ctx.fillRect(b.x - 1.6, b.y - 10, 3.2, 20);
        ctx.fillStyle = withAlpha(P.white, 0.9);
        ctx.fillRect(b.x - 0.5, b.y - 8, 1, 16);
      } else if (b.kind === 'flame') {
        const g = ctx.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, 5);
        g.addColorStop(0, withAlpha(P.white, 0.95));
        g.addColorStop(0.35, P.orangeHi);
        g.addColorStop(0.75, withAlpha(P.orange, 0.6));
        g.addColorStop(1, withAlpha(P.orangeSh, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        glow(ctx, b.x, b.y, 7, P.orange, 0.3);
      } else {
        const h = (b.h || 5) + 3;
        // Soft energy trail.
        glow(ctx, b.x, b.y, 7, color, 0.4);
        const g = ctx.createLinearGradient(b.x, b.y - h / 2, b.x, b.y + h / 2);
        g.addColorStop(0, withAlpha(P.white, 0.9));
        g.addColorStop(0.25, color);
        g.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(b.x - 1, b.y - h / 2, 2, h);
        ctx.fillStyle = withAlpha(P.white, 0.95);
        ctx.fillRect(b.x - 0.5, b.y - h / 2, 1, Math.max(2, h - 3));
      }
    }
  }

  drawEnemyBullets(ctx, game) {
    for (const b of game.enemyBullets) {
      const color = COLORS[b.color] || P.magenta;
      const r = (b.r || 2) + 1.6;
      glow(ctx, b.x, b.y, r * 4, color, 0.4);
      const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, 0.4, b.x, b.y, r);
      g.addColorStop(0, withAlpha(P.white, 1));
      g.addColorStop(0.35, color);
      g.addColorStop(0.8, withAlpha(color, 0.65));
      g.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPods(ctx, game) {
    const cluster = game.podCluster;
    if (!cluster) return;
    for (const pod of cluster.pods) {
      if (pod.dead) continue;
      drawPodHD(ctx, pod, this.clock);
    }
  }

  drawPickups(ctx, game) {
    for (const item of game.pickups) {
      if (item.kind === 'module') drawModulePickupHD(ctx, item, this.clock);
      else if (item.kind === 'gem') drawGemHD(ctx, item, this.clock);
      else if (item.kind === 'nova') drawNovaHD(ctx, item, this.clock);
      else if (item.kind === 'heart') drawHeartHD(ctx, item, this.clock);
    }
  }

  /**
   * The Null Court Colossus: a baroque marble war-mask with floating fists.
   * Drawn from pixel polygons so the whole boss costs zero assets.
   */
  drawBossPixel(ctx, game) {
    const boss = game.boss;
    if (!boss) return;
    const t = this.clock;
    const dying = boss.state === 'dying';
    const flicker = dying && Math.floor(t * 20) % 2 === 0;
    const x = Math.round(boss.x);
    const y = Math.round(boss.y);
    const phase = boss.phase;
    const phaseColor = phase >= 3 ? P.red : phase === 2 ? P.magenta : P.cyan;
    const eyeColor = phase >= 3 ? P.red : phase === 2 ? P.magentaHi : P.cyanHi;
    const prevA = ctx.globalAlpha;
    const breathe = 1 + Math.sin(t * 1.8) * 0.02;

    if (dying && Math.random() < 0.28) {
      this.spawnExplosion(x + (Math.random() - 0.5) * 84, y + (Math.random() - 0.5) * 54, 'medium');
    }

    // Halo rings behind the mask.
    for (let i = 0; i < 2; i++) {
      const r = boss.r + 22 + i * 12;
      ctx.globalAlpha = 0.4 - i * 0.12;
      ring(ctx, x, y, r, withAlpha(phaseColor, 0.5), 1);
      const a0 = t * (i % 2 ? -0.35 : 0.45) + i;
      for (let k = 0; k < 8; k += 2) {
        const aa = a0 + (k / 8) * TAU;
        rect(ctx, x + Math.cos(aa) * r, y + Math.sin(aa) * r * 0.94, 1, 1, withAlpha(phaseColor, 0.7));
      }
    }
    ctx.globalAlpha = 1;
    glow(ctx, x, y, 66, phaseColor, 0.16);
    glow(ctx, x, y, 34, phaseColor, 0.14);

    // ── Floating fists ──────────────────────────────────────────────
    for (const h of boss.hands) {
      if (h.alive) {
        glow(ctx, h.x, h.y, 20, phaseColor, 0.16);
        // Dark outline.
        poly(ctx, [
          [h.x - 11, h.y - 10], [h.x + 11, h.y - 10], [h.x + 13, h.y + 3],
          [h.x + 7, h.y + 12], [h.x - 7, h.y + 12], [h.x - 13, h.y + 3],
        ], P.outline);
        // Marble body.
        poly(ctx, [
          [h.x - 9, h.y - 8], [h.x + 9, h.y - 8], [h.x + 11, h.y + 2],
          [h.x + 5, h.y + 10], [h.x - 5, h.y + 10], [h.x - 11, h.y + 2],
        ], P.marbleMid);
        poly(ctx, [
          [h.x - 8, h.y - 7], [h.x + 6, h.y - 7], [h.x + 8, h.y + 1],
          [h.x + 3, h.y + 8], [h.x - 4, h.y + 8], [h.x - 9, h.y + 1],
        ], P.marble);
        // Knuckle plates.
        for (let i = 0; i < 3; i++) {
          rect(ctx, h.x - 7 + i * 5, h.y - 5, 3, 3, P.marbleHi);
          rect(ctx, h.x - 7 + i * 5, h.y - 2, 3, 1, P.marbleSh);
        }
        // Gold cuff.
        rect(ctx, h.x - 10, h.y - 11, 20, 3, P.goldSh);
        rect(ctx, h.x - 9, h.y - 11, 18, 1, P.gold);
        rect(ctx, h.x - 3, h.y - 12, 6, 1, P.goldHi);
        // Cannon iris.
        circle(ctx, h.x, h.y + 5, 3, P.outline);
        circle(ctx, h.x, h.y + 5, 2, withAlpha(eyeColor, 0.9));
        rect(ctx, h.x - 1, h.y + 4, 2, 2, P.white);
        glow(ctx, h.x, h.y + 5, 7, eyeColor, 0.4 + 0.15 * Math.sin(t * 6 + h.x));
        // Damage flashes.
        if (h.flash > 0) {
          ctx.globalAlpha = Math.min(0.9, h.flash);
          drawSprite(ctx, this.sprites.enemies.aegis, h.x, h.y, { flash: true });
          ctx.globalAlpha = prevA;
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const px = h.x - 9 + i * 3.6;
          const py = h.y - 2 + Math.sin(t * 4 + i) * 2;
          rect(ctx, px, py, 2, 2, withAlpha(P.steelSh, 0.65));
        }
        glow(ctx, h.x, h.y, 10, P.orange, 0.25);
        if (Math.random() < 0.2) this.spawnSpark(h.x, h.y, P.orange, 1);
      }
    }

    if (flicker) return;

    // ── The mask ────────────────────────────────────────────────────
    // Outer dark silhouette.
    poly(ctx, [
      [x - 34, y - 24], [x - 20, y - 38], [x, y - 43], [x + 20, y - 38],
      [x + 34, y - 24], [x + 36, y - 2], [x + 24, y + 22], [x, y + 34],
      [x - 24, y + 22], [x - 36, y - 2],
    ], P.outline);
    // Back plates (marble shadow tone).
    poly(ctx, [
      [x - 30, y - 22], [x - 17, y - 34], [x, y - 39], [x + 17, y - 34],
      [x + 30, y - 22], [x + 32, y - 3], [x + 21, y + 19], [x, y + 30],
      [x - 21, y + 19], [x - 32, y - 3],
    ], P.marbleSh);
    // Main face plate.
    poly(ctx, [
      [x - 25, y - 19], [x - 14, y - 29], [x, y - 33], [x + 14, y - 29],
      [x + 25, y - 19], [x + 27, y - 3], [x + 17, y + 16], [x, y + 25],
      [x - 17, y + 16], [x - 27, y - 3],
    ], P.marbleMid);
    // Sculpted face.
    poly(ctx, [
      [x - 19, y - 14], [x - 10, y - 23], [x, y - 26], [x + 10, y - 23],
      [x + 19, y - 14], [x + 20, y + 1], [x + 12, y + 13], [x, y + 18],
      [x - 12, y + 13], [x - 20, y + 1],
    ], P.marble);
    // Shadow side.
    ctx.globalAlpha = 0.35;
    poly(ctx, [
      [x + 2, y - 25], [x + 14, y - 22], [x + 19, y - 13], [x + 20, y + 1],
      [x + 12, y + 13], [x + 2, y + 18],
    ], P.marbleSh);
    ctx.globalAlpha = prevA;
    // Brow ridge.
    rect(ctx, x - 14, y - 15, 28, 2, P.marbleHi);
    rect(ctx, x - 14, y - 13, 28, 1, P.marbleSh);
    rect(ctx, x - 2, y - 14, 4, 2, P.marbleHi);
    // Eye sockets.
    for (const side of [-1, 1]) {
      const ex = x + side * 10;
      rect(ctx, ex - 6, y - 12, 12, 7, P.outline);
      rect(ctx, ex - 5, y - 11, 10, 5, '#120e1d');
      rect(ctx, ex - 4, y - 9, 8, 3, withAlpha(eyeColor, 0.95));
      rect(ctx, ex - 3, y - 9, 3, 1, P.white);
      glow(ctx, ex, y - 8, 11, eyeColor, 0.3 + 0.14 * Math.sin(t * 5 + side));
      // Gold ceremonial line under the eye.
      hline(ctx, ex - 6, y - 3, 12, withAlpha(P.goldSh, 0.8));
      // Angry brow shadow.
      rect(ctx, ex - 6, y - 13, 12, 1, withAlpha(P.outline, 0.9));
    }
    // Nose ridge.
    rect(ctx, x - 1, y - 12, 2, 13, P.marbleHi);
    rect(ctx, x + 1, y - 12, 1, 13, P.marbleSh);
    rect(ctx, x - 2, y + 1, 4, 1, P.marbleSh);
    // Cheek circuitry.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        rect(ctx, x + side * (15 - i * 2), y - 2 + i * 3, 2, 1, withAlpha(phaseColor, 0.35 + i * 0.1));
      }
      hline(ctx, x + side * 8, y + 11, 6, withAlpha(P.goldSh, 0.4));
    }
    // Mouth grille.
    rect(ctx, x - 13, y + 12, 26, 7, P.outline);
    for (let i = 0; i < 6; i++) {
      rect(ctx, x - 12 + i * 4, y + 13, 2, 5, withAlpha(phaseColor, 0.5));
    }
    hline(ctx, x - 13, y + 11, 26, P.goldSh);
    // Chin plate.
    rect(ctx, x - 6, y + 21, 12, 3, P.marbleMid);
    rect(ctx, x - 4, y + 22, 8, 1, P.marbleHi);
    // Crown band + spikes.
    rect(ctx, x - 24, y - 33, 48, 4, P.goldSh);
    rect(ctx, x - 23, y - 33, 46, 1, P.gold);
    for (let i = 0; i < 5; i++) {
      const sx = x - 22 + i * 11;
      const rise = i === 2 ? 12 : i % 2 === 0 ? 7 : 9;
      poly(ctx, [
        [sx - 3, y - 33], [sx, y - 33 - rise], [sx + 3, y - 33],
      ], i % 2 === 0 ? P.gold : P.goldMid);
      rect(ctx, sx, y - 33 - rise + 1, 1, 2, P.goldHi);
    }
    for (let i = 0; i < 4; i++) {
      rect(ctx, x - 18 + i * 12, y - 31, 2, 2, P.cyanHi);
    }
    // Classic cracks.
    bline(ctx, x - 12, y - 26, x - 7, y - 18, withAlpha(P.outline, 0.8));
    bline(ctx, x - 7, y - 18, x - 9, y - 14, withAlpha(P.outline, 0.6));
    bline(ctx, x + 16, y - 22, x + 12, y - 16, withAlpha(P.outline, 0.5));
    // Phase aura tint.
    if (phase >= 2) {
      ctx.globalAlpha = phase >= 3 ? 0.06 : 0.04;
      poly(ctx, [
        [x - 25, y - 19], [x - 14, y - 29], [x, y - 33], [x + 14, y - 29],
        [x + 25, y - 19], [x + 27, y - 3], [x + 17, y + 16], [x, y + 25],
        [x - 17, y + 16], [x - 27, y - 3],
      ], phaseColor);
      ctx.globalAlpha = prevA;
    }
    // Core glow behind the grille.
    glow(ctx, x, y + 8, 18, phaseColor, 0.16 + 0.06 * Math.sin(t * 3));

    if (boss.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, boss.flash);
      circle(ctx, x, y, 30, P.white);
      ctx.globalAlpha = prevA;
    }
  }

  /** HD vector Colossus: marble war-mask, floating fists, phase states. */
  drawBoss(ctx, game) {
    const boss = game.boss;
    if (!boss) return;
    if (boss.state === 'dying' && Math.random() < 0.28) {
      this.spawnExplosion(
        boss.x + (Math.random() - 0.5) * 84,
        boss.y + (Math.random() - 0.5) * 54,
        'medium',
      );
    }
    drawBossHD(ctx, boss, this.clock, game);
  }

  /* ---------------------------------------------------------------- */
  /* Particles                                                        */
  /* ---------------------------------------------------------------- */

  spawnSpark(x, y, color, n = 3, speed = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 10,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.5,
        color,
        size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  spawnPuff(x, y, color, n = 4) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        kind: 'puff',
        x: x + (Math.random() - 0.5) * 3,
        y: y + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 30,
        life: 0.15 + Math.random() * 0.12,
        maxLife: 0.3,
        color,
        size: 2 + Math.random() * 2,
      });
    }
  }

  spawnFlame(x, y) {
    this.particles.push({
      kind: 'flame',
      x: x + (Math.random() - 0.5) * 2,
      y,
      vx: (Math.random() - 0.5) * 14,
      vy: 30 + Math.random() * 40,
      life: 0.18 + Math.random() * 0.2,
      maxLife: 0.4,
      color: Math.random() < 0.5 ? P.orange : P.orangeHi,
      size: 1 + Math.random() * 2,
    });
  }

  spawnRing(x, y, radius, color) {
    this.particles.push({
      kind: 'ring', x, y, r: radius * 0.3, rMax: radius, life: 0.32, maxLife: 0.32, color,
    });
  }

  spawnExplosion(x, y, size) {
    const conf = {
      small: { sparks: 6, speed: 55, smoke: 2, flash: 2, ring: 8, shake: 0.08 },
      medium: { sparks: 12, speed: 80, smoke: 4, flash: 3, ring: 14, shake: 0.16 },
      big: { sparks: 22, speed: 110, smoke: 8, flash: 5, ring: 22, shake: 0.3 },
      boss: { sparks: 40, speed: 150, smoke: 14, flash: 9, ring: 34, shake: 0.55 },
    }[size] || { sparks: 12, speed: 80, smoke: 4, flash: 3, ring: 14, shake: 0.16 };

    this.spawnSpark(x, y, P.orangeHi, conf.sparks, conf.speed);
    this.spawnSpark(x, y, P.goldHi, Math.floor(conf.sparks * 0.5), conf.speed * 1.3);
    for (let i = 0; i < conf.smoke; i++) {
      this.particles.push({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 20,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: Math.random() < 0.5 ? P.steelSh : P.steelDeep,
        size: 3 + Math.random() * 4,
      });
    }
    for (let i = 0; i < conf.flash; i++) {
      this.particles.push({
        kind: 'flash',
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        life: 0.12 + Math.random() * 0.12,
        maxLife: 0.24,
        color: P.orangeHi,
        size: 3 + Math.random() * 4,
      });
    }
    this.spawnRing(x, y, conf.ring * 2, P.orangeHi);
    this.shakeAmt = Math.max(this.shakeAmt, conf.shake);
  }

  novaBurst(x, y) {
    this.spawnRing(x, y, 150, P.orangeHi);
    this.spawnRing(x, y, 100, P.gold);
    this.spawnSpark(x, y, P.orangeHi, 36, 190);
    this.spawnSpark(x, y, P.marbleHi, 18, 130);
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        kind: 'flash',
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        color: P.orangeHi,
        size: 4 + Math.random() * 5,
      });
    }
    this.shakeAmt = Math.max(this.shakeAmt, 0.9);
    this.flashAmt = Math.max(this.flashAmt, 0.75);
    this.flashColor = P.marbleHi;
  }

  updateParticles(dt) {
    const out = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'ring') {
        p.r += (p.rMax - p.r) * (1 - Math.pow(0.001, dt));
      } else {
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        if (p.kind === 'spark') {
          p.vx *= 1 - dt * 3;
          p.vy += 40 * dt;
        } else if (p.kind === 'smoke') {
          p.vy -= 8 * dt;
        }
      }
      out.push(p);
    }
    // Cap particles for performance.
    if (out.length > 520) out.splice(0, out.length - 520);
    this.particles = out;
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'spark') {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        rect(ctx, p.x, p.y, p.size, p.size, p.color);
        if (p.size > 1) rect(ctx, p.x + 1, p.y + 1, 1, 1, P.white);
      } else if (p.kind === 'flame') {
        ctx.globalAlpha = Math.min(1, t);
        rect(ctx, p.x, p.y, p.size, p.size + 1, p.color);
        if (p.size > 1.6) rect(ctx, p.x, p.y, 1, 1, P.goldHi);
      } else if (p.kind === 'puff') {
        ctx.globalAlpha = Math.min(1, t);
        circle(ctx, p.x, p.y, p.size * t, withAlpha(p.color, t * 0.8));
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = Math.min(0.5, t * 0.6);
        circle(ctx, p.x, p.y, p.size * (1.6 - t), p.color);
      } else if (p.kind === 'flash') {
        ctx.globalAlpha = Math.min(0.9, t);
        glow(ctx, p.x, p.y, p.size * 3, p.color, 0.5);
        circle(ctx, p.x, p.y, p.size, P.marbleHi);
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = Math.min(0.8, t);
        ring(ctx, p.x, p.y, p.r, p.color, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}

function moduleColorName(num) {
  const def = MODULE_DEFS.find((m) => m.num === num);
  if (!def) return 'gold';
  return def.id === 'beta' ? 'cyan' : def.id === 'gamma' ? 'magenta' : def.id === 'delta' ? 'gold' : 'green';
}

/** Palette colour for a module id (used by formation rings). */
function def0Color(id) {
  const def = MODULE_BY_ID[id];
  return def ? def.color : P.cyan;
}

function drawHeartPickup(ctx, x, y, color) {
  rect(ctx, x - 3, y - 2, 2, 1, color);
  rect(ctx, x + 2, y - 2, 2, 1, color);
  rect(ctx, x - 4, y - 1, 9, 3, color);
  rect(ctx, x - 3, y + 2, 7, 2, color);
  rect(ctx, x - 2, y + 4, 5, 1, color);
  rect(ctx, x - 1, y + 5, 3, 1, color);
  rect(ctx, x - 3, y - 1, 2, 1, P.redHi);
}
