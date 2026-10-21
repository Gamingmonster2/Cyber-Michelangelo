/**
 * Cyber Michelangelo — bootstrap.
 *
 * Wires together the DOM canvas, the pixel renderer, the input manager, the
 * WebAudio engine and the DOM-free Game simulation, then runs a fixed-timestep
 * 60 Hz loop with interpolation-free rendering.
 */
import { AudioEngine } from './core/audio.js';
import { InputManager } from './core/input.js';
import { buildSprites } from './render/sprites.js';
import { Renderer } from './render/renderer.js';
import { Game } from './game/game.js';
import { VERSION } from './game/config.js';
import { loadSettings, saveSettings } from './core/storage.js';
import { drawText } from './render/pixelfont.js';
import { P } from './render/palette.js';

const canvas = document.getElementById('game');
const canvas3d = document.getElementById('game3d');
const boot = document.getElementById('boot');
const params = new URLSearchParams(location.search);

// Headless screenshot support: drop the HTML loading overlay immediately.
if (params.has('noboot') && boot) boot.remove();

// Surface uncaught errors into the DOM so headless verification can catch them.
function reportFatal(err) {
  const message = err && err.stack ? err.stack : String(err);
  console.error('[cyber-michelangelo] fatal:', err);
  let pre = document.getElementById('selftest-result');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'selftest-result';
    pre.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre;';
    document.body.appendChild(pre);
  }
  pre.textContent = JSON.stringify({ ok: false, fatal: message });
  document.title = 'CM FATAL';
}
window.addEventListener('error', (e) => reportFatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportFatal(e.reason));

const STEP = 1 / 60;
const NO_EDGES = (snap) => ({ x: snap.x, y: snap.y, fire: snap.fire });

/* ------------------------------------------------------------------ */
/* Boot                                                              */
/* ------------------------------------------------------------------ */

const sprites = buildSprites();
const renderer = new Renderer(canvas, sprites, canvas3d);
const audio = new AudioEngine();
const settings = loadSettings();
if (params.has('fps')) settings.showFps = true;
if (params.has('noscanlines')) settings.scanlines = false;
if (params.get('style') === '3d') settings.renderStyle = '3d';
else if (params.get('style') === 'hd') settings.renderStyle = 'hd';

const seedParam = Number(params.get('seed'));
const game = new Game({
  audio,
  fx: renderer.fx,
  settings,
  seed: Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 1985,
});

const input = new InputManager(canvas, {
  onFirstInput: () => {
    audio.unlock().then(() => {
      audio.setVolumes({ music: settings.music / 10, sfx: settings.sfx / 10 });
      if (params.has('mute')) audio.setMuted(true);
      if (audio.track) audio.music(audio.track); // restart the pending track
    });
  },
});

/* ------------------------------------------------------------------ */
/* Sizing                                                            */
/* ------------------------------------------------------------------ */

const size = { cssW: 480, cssH: 840, dpr: 1 };

function resize() {
  const frame = document.getElementById('frame');
  const footer = document.getElementById('page-footer');
  const footerVisible = footer && getComputedStyle(footer).display !== 'none';
  const availW = Math.max(240, window.innerWidth - 16);
  const availH = Math.max(420, window.innerHeight - 16 - (footerVisible ? footer.offsetHeight + 8 : 0));
  const scale = Math.min(availW / 240, availH / 420);
  size.cssW = Math.max(240, Math.round(240 * scale));
  size.cssH = Math.max(420, Math.round(420 * scale));
  size.dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(size.cssW, size.cssH, size.dpr);
  if (frame) {
    frame.style.width = size.cssW + 'px';
    frame.style.height = size.cssH + 'px';
  }
}

window.addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ */
/* Debug / screenshot URL hooks                                      */
/* ------------------------------------------------------------------ */

if (params.has('dump')) {
  // Machine-readable game state for headless inspection.
  setTimeout(() => {
    const g = game;
    const data = {
      scene: g.scene,
      stageState: g.stageState,
      player: {
        x: Math.round(g.player.x), y: Math.round(g.player.y), dead: g.player.dead,
        invuln: Math.round(g.player.invuln * 10) / 10, modules: g.player.modules,
      },
      pods: g.podCluster ? g.podCluster.pods.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), num: p.num, dead: p.dead })) : null,
      pickups: g.pickups.map((p) => ({ kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), num: p.num })),
      enemies: g.enemies.map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y) })),
      particles: renderer.particles.length,
      banner: g.banner,
    };
    let pre = document.getElementById('selftest-result');
    if (!pre) {
      pre = document.createElement('pre');
      pre.id = 'selftest-result';
      pre.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre;';
      document.body.appendChild(pre);
    }
    pre.textContent = JSON.stringify(data, null, 1);
    document.title = 'CM DUMP';
  }, 260);
}

const requestedScene = params.get('scene');
if (requestedScene && requestedScene !== 'title') {
  const sim = Number(params.get('sim')) || 0;
  if (['howto', 'credits', 'options'].includes(requestedScene)) {
    game.scene = requestedScene;
    game.howtoPage = Number(params.get('page')) || 0;
  } else if (requestedScene === 'paused') {
    game.startRun();
    game.scene = 'paused';
    game.pauseIndex = 0;
  } else {
    game.debugScene(requestedScene, { sim: sim > 0 ? sim : undefined });
  }
} else if (params.has('autoplay')) {
  game.startRun();
}
const frozen = params.has('freeze');
if (params.has('touch')) input.touchMode = true;
if (params.has('mute')) audio.setMuted(true);

// Clean, deterministic first frame for screenshots.
if (frozen) {
  renderer.particles.length = 0;
  renderer.shakeAmt = 0;
  renderer.shakeX = 0;
  renderer.shakeY = 0;
  renderer.flashAmt = 0;
  game.player.invuln = 0;
  game.banner = null;
  game.popups.length = 0;
  if (game.scene === 'playing') game.stageState = game.stageState === 'intro' ? 'waves' : game.stageState;
}

/* ------------------------------------------------------------------ */
/* Crisp HD Arabic overlay (canvas text shaping, only on title/credits) */
/* ------------------------------------------------------------------ */

const ARABIC = {
  title: { text: 'سايبر مايكل أنجلو', y: 138, size: 9, color: 'rgba(255,233,168,0.92)' },
  credits: { text: 'شكراً لسلسلة Cresta الأصلية', y: 347, size: 7, color: 'rgba(255,209,102,0.85)' },
};

function drawHdOverlay() {
  const scene = game.scene;
  const line = scene === 'title' ? ARABIC.title : scene === 'credits' ? ARABIC.credits : null;
  if (!line) return;
  const d = renderer.display;
  const cvs = canvas;
  const cssScale = size.cssH / 420;
  d.save();
  d.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  d.direction = 'rtl';
  d.textAlign = 'center';
  d.textBaseline = 'middle';
  const fs = Math.max(11, Math.round(line.size * cssScale));
  d.font = `500 ${fs}px "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif`;
  d.fillStyle = line.color;
  d.shadowColor = 'rgba(255, 209, 102, 0.3)';
  d.shadowBlur = 8 * size.dpr;
  d.fillText(line.text, size.cssW / 2, line.y * cssScale);
  d.restore();
}

/* ------------------------------------------------------------------ */
/* Browser self-test (?selftest=1)                                   */
/* ------------------------------------------------------------------ */

function writeSelfTest(payload) {
  let pre = document.getElementById('selftest-result');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'selftest-result';
    pre.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre;';
    document.body.appendChild(pre);
  }
  pre.textContent = JSON.stringify(payload, null, 2);
  document.title = payload.ok ? 'CM SELFTEST PASS' : 'CM SELFTEST FAIL';
}

async function runSelfTest() {
  const results = [];
  const check = (name, fn) => {
    try {
      const value = fn();
      results.push({ name, ok: value !== false });
    } catch (err) {
      results.push({ name, ok: false, error: String(err && err.stack ? err.stack : err) });
    }
  };

  check('sprites built', () => Boolean(sprites.player && sprites.modules.beta && sprites.enemies.goliath && sprites.pods[2]));
  check('audio engine constructed', () => Boolean(audio));
  check('render title frame', () => {
    renderer.render(game, { isTouch: false }, 1 / 60);
    renderer.present(game);
    return true;
  });
  check('title canvas has visible pixels', () => {
    const ctx = renderer.screen.ctx;
    const cvs = renderer.screen.canvas;
    const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 90) lit += 1;
    }
    return lit > cvs.width * cvs.height * 0.06;
  });
  check('run starts', () => {
    game.startRun();
    return game.scene === 'playing';
  });
  check('5s simulation advances without NaN', () => {
    game.player.invuln = 1e9;
    game.advance(5, (t) => ({ x: Math.sin(t * 2) * 0.8, y: Math.cos(t) * 0.3, fire: true }));
    const s = game.snapshot();
    return Number.isFinite(game.score) && Number.isFinite(s.playerX);
  });
  check('starship fires bullets', () => game.playerBullets.length + game.enemies.length > 0);
  check('render gameplay frame', () => {
    renderer.render(game, { isTouch: true }, 1 / 60);
    renderer.present(game);
    return true;
  });
  check('gameplay canvas has visible pixels', () => {
    const ctx = renderer.screen.ctx;
    const cvs = renderer.screen.canvas;
    const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 90) lit += 1;
    }
    return lit > cvs.width * cvs.height * 0.06;
  });
  check('HUD renders score digits', () => {
    renderer.render(game, { isTouch: false }, 1 / 60);
    const s = renderer.screen.scale || 1;
    const data = renderer.screen.ctx.getImageData(
      Math.round(6 * s), Math.round(8 * s), Math.round(90 * s), Math.round(18 * s),
    ).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 150) lit += 1;
    return lit > 40 * s * s;
  });
  check('formation split renders', () => {
    const g = new Game({ audio, fx: renderer.fx, settings, seed: 77 });
    g.startRun();
    g.player.attachModule('beta');
    g.player.attachModule('gamma');
    g.player.invuln = 0;
    g.player.tryTransform(g);
    g.advance(1.2, (t) => ({ x: Math.sin(t * 2) * 0.6, fire: true }));
    renderer.render(g, { isTouch: true }, 1 / 60);
    return g.player.formationActive;
  });
  check('phoenix renders', () => {
    const g = new Game({ audio, fx: renderer.fx, settings, seed: 78 });
    g.startRun();
    g.player.attachModule('beta');
    g.player.attachModule('gamma');
    g.player.attachModule('delta');
    g.player.attachModule('epsilon');
    g.enemies.length = 0;
    g.player.tryTransform(g);
    g.advance(0.8, (t) => ({ x: Math.sin(t * 2) * 0.5, fire: true }));
    renderer.render(g, { isTouch: false }, 1 / 60);
    return g.player.phoenixActive;
  });
  check('boss scene renders', () => {
    const g = new Game({ audio, fx: renderer.fx, settings, seed: 79 });
    g.debugScene('boss', { sim: 3 });
    g.player.invuln = 0;
    g.player.invuln = 0;
    g.advance(1.5, () => ({ fire: true }));
    renderer.render(g, { isTouch: true }, 1 / 60);
    renderer.present(g);
    return Boolean(g.boss);
  });
  check('game over renders', () => {
    const g = new Game({ audio, fx: renderer.fx, settings, seed: 80 });
    g.debugScene('gameover');
    renderer.render(g, { isTouch: false }, 1 / 60);
    return g.scene === 'gameover';
  });
  check('all menu screens render', () => {
    for (const scene of ['howto', 'credits', 'options', 'paused', 'title']) {
      game.scene = scene;
      renderer.render(game, { isTouch: true }, 1 / 60);
    }
    game.scene = 'playing';
    return true;
  });
  check('backdrop renderer handles all three themes', () => {
    for (let stage = 1; stage <= 3; stage++) {
      game.startStage(stage);
      game.scene = 'playing';
      renderer.render(game, { isTouch: false }, 1 / 60);
    }
    return true;
  });

  // Optional 3D renderer probe. WebGL may be unavailable in some headless
  // environments; that is a graceful skip, not a failure.
  try {
    const mod = await import('./render3d/renderer3d.js');
    const probeCanvas = document.createElement('canvas');
    const r3d = new mod.Renderer3D(probeCanvas);
    if (!r3d.init()) {
      results.push({ name: '3D renderer (three.js)', ok: true, note: 'WebGL unavailable — skipped' });
    } else {
      const g3d = new Game({ audio, fx: renderer.fx, settings: { ...settings, renderStyle: 'hd' }, seed: 91 });
      g3d.startRun();
      g3d.player.invuln = 1e9;
      g3d.advance(2.5, (t) => ({ x: Math.sin(t * 1.5) * 0.7, fire: true }));
      r3d.resize(240, 420, 1);
      r3d.render(g3d, 1.2, 1 / 60);
      const gl = r3d.renderer.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(Math.floor(probeCanvas.width / 2), Math.floor(probeCanvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const lit = px[0] + px[1] + px[2];
      r3d.dispose();
      results.push({ name: '3D renderer (three.js) renders the world', ok: lit > 8, note: `centre pixel ${lit}` });
    }
  } catch (err) {
    results.push({ name: '3D renderer (three.js)', ok: true, note: `WebGL unavailable — skipped (${String(err && err.message ? err.message : err)})` });
  }

  const ok = results.every((r) => r.ok);
  writeSelfTest({ ok, version: VERSION, results, build: 'cyber-michelangelo', time: new Date().toISOString() });
  return ok;
}

/* ------------------------------------------------------------------ */
/* Main loop                                                         */
/* ------------------------------------------------------------------ */

let accumulator = 0;
let lastTime = 0;
let firstFrame = true;

function frame(now) {
  const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 1 / 60;
  lastTime = now;

  const snap = frozen ? {} : input.poll();

  // Global action keys.
  if (snap.mute) {
    audio.toggleMute();
  }
  if (snap.fullscreen) toggleFullscreen();

  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      game.update(STEP, steps === 0 ? snap : NO_EDGES(snap));
      accumulator -= STEP;
      steps += 1;
    }
  }

  renderer.scanlines = settings.scanlines !== false;
  renderer.render(game, { isTouch: input.isTouch }, frozen ? 1 / 60 : dt);
  renderer.present(game);
  drawHdOverlay();
  audio.tick();

  if (boot && firstFrame) {
    boot.classList.add('hidden');
    firstFrame = false;
  }
  requestAnimationFrame(frame);
}

function toggleFullscreen() {
  const frameEl = document.getElementById('frame') || document.documentElement;
  if (!document.fullscreenElement) {
    (frameEl.requestFullscreen ? frameEl.requestFullscreen() : Promise.resolve()).catch(() => {});
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.scene === 'playing') {
      game.scene = 'paused';
      game.pauseIndex = 0;
    }
    audio.ctx?.suspend?.();
  } else {
    audio.ctx?.resume?.();
    lastTime = 0;
  }
});

/* ------------------------------------------------------------------ */
/* Go                                                               */
/* ------------------------------------------------------------------ */

resize();
if (params.has('selftest')) {
  // Give modules a moment to paint, then run assertions (async for the 3D probe).
  setTimeout(() => { runSelfTest(); }, 120);
} else {
  requestAnimationFrame(frame);
}

// Debug handle used by tests / screenshots.
window.__CM__ = {
  game,
  renderer,
  input,
  audio,
  settings,
  version: VERSION,
  canvas3d,
  snapshot: () => game.snapshot(),
  advance: (seconds, fire = true) => {
    game.advance(seconds, (t) => ({ x: Math.sin(t * 1.3) * 0.7, y: 0, fire }));
  },
  save: () => saveSettings(settings),
};
