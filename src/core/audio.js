/**
 * Audio engine: procedural SFX + soundtrack.
 *
 * Default soundtrack = “space nature” ambience (two synthesised continuous
 * layers: low space rumble + drifting wind, plus rare random details) built by
 * `src/core/space_ambience.js`. Two alternative styles remain available:
 * recorded nature beds (`src/core/ambience.js`) and the original procedural
 * chiptune. All SFX are synthesised at runtime from wood/water/ice/stone/
 * thunder-flavoured layers and duck the ambience while they play.
 */
import { AmbienceEngine, bedForScene } from './ambience.js';
import { SpaceAmbienceEngine, DUCK_PRESETS } from './space_ambience.js';

const A3 = 57; // MIDI note of A3 (220 Hz)

const TRACKS = {
  title: {
    bpm: 92,
    chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]],
    bass: 'slow',
    arp: everyTwo,
    drums: 'none',
    pad: true,
  },
  stage: {
    bpm: 148,
    chords: [[0, 3, 7], [-4, 0, 5], [3, 7, 10], [-2, 2, 7]],
    bass: 'drive',
    arp: everyOne,
    drums: 'full',
    pad: true,
    hook: true,
  },
  boss: {
    bpm: 164,
    chords: [[-2, 1, 5], [-4, -1, 3], [0, 3, 7], [-2, 2, 6]],
    bass: 'drive',
    arp: everyOne,
    drums: 'heavy',
    pad: true,
    alarm: true,
  },
  gameover: {
    bpm: 74,
    chords: [[0, -4, -1], [-2, -5, -9]],
    bass: 'slow',
    arp: null,
    drums: 'none',
    pad: true,
  },
};

/**
 * CC0 soundtrack support lives in `src/core/ambience.js` (nature beds).
 * The chiptune sequencer below is the optional legacy soundtrack style.
 */

function everyTwo(step) {
  return step % 2 === 0;
}
function everyOne(step) {
  return step % 1 === 0;
}

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function clampFreq(f) {
  return Math.max(20, Math.min(12000, f));
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volumes = { music: 0.7, sfx: 0.8 };
    this.track = null;
    this.pendingTrack = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.noiseBuffer = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.lastSfx = new Map();
    this.unlockTried = false;
    // Soundtrack styles: 'space' (default, procedural space-nature ambience),
    // 'nature' (recorded field beds) or 'chiptune' (legacy sequencer).
    this.musicStyle = 'space';
    this.themeId = null;
    this.ambience = null;
    this.space = null;
    this.natureBus = null;
    this.motion = 0;
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.resume();
      }
      return true;
    }
    if (this.unlockTried) return false;
    this.unlockTried = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;

      // Android Chrome / iOS can hand back a suspended context even inside a
      // tap handler. Resume it immediately while we still hold user activation.
      try {
        if (ctx.state === 'suspended') {
          const p = ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      } catch { /* ignore */ }

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;
      this.master = master;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      master.connect(comp);
      comp.connect(ctx.destination);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.volumes.music * 0.34;
      this.musicGain.connect(master);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = this.volumes.sfx * 0.55;
      this.sfxGain.connect(master);

      // Short processed echo used by the nature-flavoured SFX (drops, chimes,
      // splashes) to sit in the same space as the ambience reverb.
      this.sfxEcho = ctx.createDelay(0.6);
      this.sfxEcho.delayTime.value = 0.2;
      this.sfxEchoFb = ctx.createGain();
      this.sfxEchoFb.gain.value = 0.26;
      this.sfxEcho.connect(this.sfxEchoFb);
      this.sfxEchoFb.connect(this.sfxEcho);
      this.sfxEcho.connect(this.sfxGain);

      // Dedicated bus for recorded-nature beds so they can be ducked cleanly.
      this.natureBus = ctx.createGain();
      this.natureBus.gain.value = 1;
      this.natureBus.connect(this.musicGain);

      // Small stereo delay for the arps adds arcade sparkle.
      this.delay = ctx.createDelay(0.5);
      this.delay.delayTime.value = 0.16;
      this.delayGain = ctx.createGain();
      this.delayGain.gain.value = 0.16;
      this.delay.connect(this.delayGain);
      this.delayGain.connect(this.musicGain);
      this.musicGain.connect(this.delay);

      this.noiseBuffer = this.buildNoise(ctx);
      this.ready = true;
      this.nextStepTime = ctx.currentTime + 0.12;
      // Best-effort resume after the graph is built (needs no await).
      this.resume();
      if (this.pendingTrack) {
        // The track may already equal this.track (it was set before the
        // AudioContext existed); reset it so music() actually starts playback.
        const t = this.pendingTrack;
        this.pendingTrack = null;
        this.track = null;
        this.music(t);
      } else if (this.track) {
        this.startTrack(this.track);
      }
      return true;
    } catch (err) {
      console.warn('[audio] failed to initialise WebAudio:', err);
      this.unlockTried = false; // allow a later tap to retry
      return false;
    }
  }

  /** Resume a suspended AudioContext (safe to call every frame). */
  resume() {
    if (!this.ctx || this.ctx.state === 'running') return;
    try {
      const p = this.ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* ignore */ }
  }

  buildNoise(ctx) {
    const seconds = 1.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setVolumes({ music, sfx }) {
    if (typeof music === 'number') this.volumes.music = music;
    if (typeof sfx === 'number') this.volumes.sfx = sfx;
    if (this.musicGain) this.musicGain.gain.value = this.volumes.music * 0.34;
    if (this.sfxGain) this.sfxGain.gain.value = this.volumes.sfx * 0.55;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ---------------------------------------------------------------- */
  /* Soundtrack                                                       */
  /* ---------------------------------------------------------------- */

  /** Switch between space-nature, recorded nature and the chiptune. */
  setMusicStyle(style) {
    const next = style === 'nature' ? 'nature' : style === 'chiptune' ? 'chiptune' : 'space';
    if (next === this.musicStyle) return;
    this.musicStyle = next;
    this.stopAmbience();
    this.stopSpace();
    this.step = 0;
    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.08;
    if (this.track) this.startTrack(this.track);
  }

  /** Stage theme changed while a run is in progress: swap the stage ambience. */
  setTheme(themeId) {
    if (!themeId || themeId === this.themeId) return;
    this.themeId = themeId;
    if (this.musicStyle === 'nature' && this.ambience && this.track === 'stage') {
      this.ambience.setBed(bedForScene('stage', themeId));
    }
  }

  startTrack(track) {
    if (this.musicStyle === 'space') {
      if (!this.ctx) return;
      this.stopAmbience();
      if (!this.space) this.space = new SpaceAmbienceEngine(this.ctx, this.musicGain);
      this.space.setMood(track === 'boss' ? 'boss' : track === 'gameover' ? 'gameover' : track === 'title' ? 'title' : 'stage');
      this.space.start();
      this.space.setMotion(this.motion);
      return;
    }
    if (this.musicStyle === 'nature') {
      if (!this.ctx) return;
      this.stopSpace();
      if (!this.ambience) this.ambience = new AmbienceEngine(this.ctx, this.natureBus || this.musicGain);
      this.ambience.setBed(bedForScene(track, this.themeId));
      return;
    }
    this.stopAmbience();
    this.stopSpace();
    this.step = 0;
    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.08;
  }

  stopAmbience() {
    if (this.ambience) {
      try { this.ambience.stop(); } catch { /* ignore */ }
      this.ambience = null;
    }
  }

  stopSpace() {
    if (this.space) {
      try { this.space.stop(); } catch { /* ignore */ }
      this.space = null;
    }
  }

  /** Movement intensity 0..1 — the wind rises slightly with speed. */
  setMotion(level) {
    this.motion = Math.max(0, Math.min(1, Number(level) || 0));
    if (this.musicStyle === 'space' && this.space) this.space.setMotion(this.motion);
  }

  /** Temporarily lower the ambience so gameplay SFX stay clearly on top. */
  duckBackground(depth = 0.5, seconds = 0.4) {
    if (this.musicStyle === 'space') {
      this.space?.duck(depth, seconds);
      return;
    }
    if (this.musicStyle === 'nature' && this.natureBus && this.ctx) {
      const now = this.ctx.currentTime;
      const target = Math.max(0.0001, 1 - Math.max(0, Math.min(0.95, depth)));
      try {
        this.natureBus.gain.cancelScheduledValues(now);
        this.natureBus.gain.setTargetAtTime(target, now, 0.035);
        this.natureBus.gain.setTargetAtTime(1, now + Math.max(0.08, seconds), 0.35);
      } catch { /* ignore */ }
    }
  }

  /** State snapshot for the headless audio probe / debugging. */
  getAudioState() {
    const base = {
      style: this.musicStyle,
      track: this.track,
      theme: this.themeId,
      motion: this.motion,
      ctxState: this.ctx ? this.ctx.state : null,
      ctxTime: this.ctx ? Math.round(this.ctx.currentTime * 100) / 100 : null,
      sampleRate: this.ctx ? this.ctx.sampleRate : null,
    };
    if (this.musicStyle === 'space' && this.space) {
      return { ...base, space: this.space.getState() };
    }
    if (this.musicStyle === 'nature' && this.ambience) {
      const bed = this.ambience.bed;
      return {
        ...base,
        bed: bed ? bed.key : null,
        layers: bed ? bed.layers.map((layer) => ({
          url: layer.def.url,
          loaded: Boolean(layer.buffer),
          failed: Boolean(layer.failed),
          procedural: Boolean(layer.proc),
        })) : [],
      };
    }
    return base;
  }

  /** Send an SFX node into the space ambience reverb, if it is available. */
  sendReverb(node, amount = 0.25) {
    if (!this.space || !this.space.active || !this.ctx) return;
    try {
      const send = this.ctx.createGain();
      send.gain.value = Math.max(0, Math.min(1, amount));
      node.connect(send);
      send.connect(this.space.reverbSend);
    } catch { /* ignore */ }
  }

  music(track) {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (!this.ctx) {
      this.pendingTrack = track;
      return;
    }
    this.startTrack(track);
  }

  tick() {
    if (this.ctx && this.ready && this.ctx.state === 'suspended') this.resume();
    if (!this.ready || !this.track) return;
    if (this.musicStyle === 'space') {
      // Ambience keeps scheduling even while muted (master gain handles mute).
      this.space?.tick();
      return;
    }
    if (this.musicStyle === 'nature') {
      this.ambience?.tick();
      return;
    }
    if (this.muted) return;
    const ctx = this.ctx;
    const config = TRACKS[this.track];
    if (!config) return;
    const stepDur = 60 / config.bpm / 4;
    const lookahead = 0.16;
    let guard = 0;
    while (this.nextStepTime < ctx.currentTime + lookahead && guard < 64) {
      guard += 1;
      try {
        this.scheduleStep(config, this.step, this.nextStepTime);
      } catch { /* never let audio break the game */ }
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  scheduleStep(config, step, time) {
    const bar = Math.floor(step / 16);
    const chord = config.chords[bar % config.chords.length];
    const stepInBar = step % 16;

    // Bass.
    if (config.bass === 'drive' && stepInBar % 2 === 0) {
      this.bassNote(midiToFreq(A3 + chord[0] - 24), time, 0.11, 0.09);
    } else if (config.bass === 'slow' && (stepInBar === 0 || stepInBar === 10)) {
      this.bassNote(midiToFreq(A3 + chord[0] - 24), time, 0.5, 0.055);
    }

    // Pad chord at bar line.
    if (config.pad && stepInBar === 0) {
      this.padChord(chord, time, (60 / config.bpm) * 4);
    }

    // Arpeggio.
    if (config.arp && config.arp(step)) {
      const idx = step % chord.length;
      const octave = Math.floor(step / 8) % 2 === 0 ? 12 : 24;
      const freq = midiToFreq(A3 + chord[idx] + octave);
      this.arpNote(freq, time, this.track === 'title' ? 0.09 : 0.055);
    }

    // Stage hook: a longer lead note at each bar.
    if (config.hook && stepInBar === 0) {
      this.leadNote(midiToFreq(A3 + chord[2] + 12), time, 0.24, 0.05);
    }

    // Drums.
    if (config.drums === 'full') {
      if (stepInBar === 0 || stepInBar === 8) this.kick(time, 0.5);
      if (stepInBar === 4 || stepInBar === 12) this.snare(time, 0.2);
      if (stepInBar % 2 === 0) this.hat(time, 0.12);
      if (stepInBar === 14) this.hat(time, 0.22);
    } else if (config.drums === 'heavy') {
      if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) this.kick(time, 0.62);
      if (stepInBar === 4 || stepInBar === 12) this.snare(time, 0.26);
      if (stepInBar === 15) this.snare(time, 0.3);
      this.hat(time, 0.07);
    }

    // Boss alarm siren.
    if (config.alarm && (stepInBar === 0 || stepInBar === 6)) {
      const up = Math.floor(step / 16) % 2 === 0;
      this.tone({
        time, freq: up ? 620 : 520, dur: 0.22, type: 'sawtooth', gain: 0.035,
        bus: 'music', slideTo: up ? 440 : 680, filter: 1800,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Voice primitives (music bus)                                     */
  /* ---------------------------------------------------------------- */

  bassNote(freq, time, dur, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    osc.type = 'triangle';
    osc.frequency.value = clampFreq(freq);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  arpNote(freq, time, gain) {
    this.tone({
      time, freq, dur: 0.1, type: 'square', gain,
      bus: 'music', filter: 3600, echo: true,
    });
  }

  leadNote(freq, time, dur, gain) {
    this.tone({
      time, freq, dur, type: 'square', gain,
      bus: 'music', filter: 2400, attack: 0.01,
    });
  }

  padChord(chord, time, dur) {
    const ctx = this.ctx;
    const notes = chord.slice(0, 3).map((n) => midiToFreq(A3 + n));
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, time);
    filter.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.028, time + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    filter.connect(g);
    g.connect(this.musicGain);
    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = clampFreq(freq / 2);
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }
  }

  kick(time, gain = 0.5) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.09);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  snare(time, gain = 0.2) {
    this.noise({ time, dur: 0.13, gain, bus: 'music', filterFrom: 3800, filterTo: 1200 });
    this.tone({ time, freq: 190, dur: 0.08, type: 'triangle', gain: gain * 0.5, bus: 'music' });
  }

  hat(time, gain = 0.1) {
    this.noise({ time, dur: 0.035, gain, bus: 'music', filterFrom: 9000, filterTo: 7000, highpass: true });
  }

  /* ---------------------------------------------------------------- */
  /* Nature-flavoured SFX building blocks                             */
  /* ---------------------------------------------------------------- */

  woodClick(time, vol = 1) {
    this.noise({ time, dur: 0.035, gain: 0.05 * vol, filterFrom: 2400, filterTo: 900 });
    this.tone({ time, freq: 780, slideTo: 540, dur: 0.045, type: 'triangle', gain: 0.05 * vol });
  }

  bubble(time, vol = 1, base = 620) {
    this.tone({ time, freq: base * 1.7, slideTo: base, dur: 0.075, type: 'sine', gain: 0.05 * vol });
    this.tone({ time: time + 0.03, freq: base * 2.3, slideTo: base * 1.4, dur: 0.05, type: 'sine', gain: 0.02 * vol });
  }

  iceCrack(time, vol = 1, dark = false) {
    const reps = dark ? 2 : 3;
    for (let i = 0; i < reps; i++) {
      const t = time + i * (0.02 + Math.random() * 0.035);
      this.noise({
        time: t, dur: 0.05, gain: (dark ? 0.05 : 0.04) * vol,
        filterFrom: dark ? 1400 : 3600, filterTo: dark ? 500 : 2200, highpass: !dark,
      });
    }
    if (dark) this.tone({ time, freq: 150, slideTo: 70, dur: 0.16, type: 'sine', gain: 0.06 * vol });
  }

  stoneCrumb(time, vol = 1) {
    this.noise({ time, dur: 0.3, gain: 0.12 * vol, filterFrom: 1400, filterTo: 140 });
    for (let i = 0; i < 3; i++) {
      this.noise({ time: time + 0.03 + i * 0.045, dur: 0.06, gain: 0.03 * vol, filterFrom: 900, filterTo: 300 });
    }
  }

  fireHiss(time, vol = 1) {
    this.noise({ time, dur: 0.22, gain: 0.09 * vol, filterFrom: 1100, filterTo: 300 });
    this.noise({ time, dur: 0.3, gain: 0.04 * vol, filterFrom: 4000, filterTo: 1200, highpass: true });
  }

  thunder(time, vol = 1) {
    this.noise({ time, dur: 1.9, gain: 0.16 * vol, filterFrom: 420, filterTo: 70 });
    this.tone({ time, freq: 46, slideTo: 28, dur: 1.6, type: 'sine', gain: 0.12 * vol });
  }

  quake(time, vol = 1) {
    this.tone({ time, freq: 62, slideTo: 30, dur: 0.55, type: 'sine', gain: 0.14 * vol });
    this.noise({ time, dur: 0.5, gain: 0.08 * vol, filterFrom: 200, filterTo: 60 });
  }

  splash(time, vol = 1) {
    this.noise({ time, dur: 0.11, gain: 0.06 * vol, filterFrom: 4800, filterTo: 1200, highpass: true, echo: true });
    this.bubble(time + 0.02, vol * 0.7, 420);
  }

  windChime(freqs, time, step = 0.1, vol = 1) {
    for (let i = 0; i < freqs.length; i++) {
      const freq = freqs[i];
      const t = time + i * step;
      this.tone({ time: t, freq, dur: 0.5, type: 'triangle', gain: 0.045 * vol, filter: 6000, echo: true });
      this.tone({ time: t, freq: freq * 2.01, dur: 0.4, type: 'sine', gain: 0.018 * vol, echo: true });
    }
  }

  heartbeat(time, vol = 1) {
    this.tone({ time, freq: 58, slideTo: 42, dur: 0.16, type: 'sine', gain: 0.12 * vol });
    this.tone({ time: time + 0.19, freq: 52, slideTo: 38, dur: 0.14, type: 'sine', gain: 0.08 * vol });
  }

  caveEcho(freqs, time, step = 0.08, vol = 1) {
    this.windChime(freqs, time, step, vol * 0.8);
    this.tone({ time: time + 0.18, freq: freqs[freqs.length - 1] * 0.5, dur: 0.5, type: 'sine', gain: 0.03 * vol, echo: true });
  }

  uiDrop(time, vol = 1) {
    this.bubble(time, vol * 0.8, 720);
    this.tone({ time: time + 0.05, freq: 520, slideTo: 360, dur: 0.12, type: 'sine', gain: 0.02 * vol, echo: true });
  }


  /* ---------------------------------------------------------------- */
  /* SFX                                                             */
  /* ---------------------------------------------------------------- */

  sfx(name, opts = {}) {
    if (!this.ready || this.muted) return;
    const now = this.ctx.currentTime;
    const minGap = SFX_MIN_GAP[name] || 0.02;
    const last = this.lastSfx.get(name) || 0;
    if (now - last < minGap) return;
    this.lastSfx.set(name, now);
    const t = now + 0.001;
    const vol = opts.volume === undefined ? 1 : opts.volume;
    const duck = DUCK_PRESETS[name];
    if (duck) this.duckBackground(duck.depth, duck.dur);
    try {
      switch (name) {
        case 'laser':
          this.woodClick(t, vol);
          this.bubble(t + 0.012, vol * 0.7, 760);
          break;
        case 'beam':
          this.noise({ time: t, dur: 0.3, gain: 0.07 * vol, filterFrom: 600, filterTo: 3000, highpass: true, echo: true });
          this.windChime([1568, 2093], t + 0.12, 0.05, vol * 0.7);
          break;
        case 'enemyShot':
          this.iceCrack(t, vol, true);
          break;
        case 'explosion':
          this.fireHiss(t, vol);
          this.stoneCrumb(t + 0.02, vol);
          break;
        case 'bigExplosion':
          this.thunder(t, vol);
          this.quake(t, vol);
          this.stoneCrumb(t + 0.05, vol * 0.8);
          break;
        case 'playerDeath':
          this.iceCrack(t, vol * 1.2);
          this.heartbeat(t + 0.1, vol);
          this.thunder(t + 0.05, vol * 0.7);
          break;
        case 'dock':
          this.bubble(t, vol, 520);
          this.caveEcho([784, 1046], t + 0.06, 0.07, vol);
          break;
        case 'moduleLost':
          this.iceCrack(t, vol);
          this.heartbeat(t + 0.08, vol * 0.8);
          break;
        case 'formation':
          this.noise({ time: t, dur: 0.26, gain: 0.05 * vol, filterFrom: 500, filterTo: 2400, highpass: true, echo: true });
          this.bubble(t + 0.05, vol * 0.6, 480);
          break;
        case 'rejoin':
          this.bubble(t, vol * 0.7, 640);
          break;
        case 'nova':
          this.thunder(t, vol * 1.2);
          this.quake(t, vol);
          this.bubble(t + 0.1, vol, 380);
          break;
        case 'phoenix':
          this.noise({ time: t, dur: 0.9, gain: 0.1 * vol, filterFrom: 900, filterTo: 3200, highpass: true, echo: true });
          this.windChime([523, 659, 784, 1046], t + 0.08, 0.08, vol * 0.9);
          this.fireHiss(t + 0.2, vol * 0.6);
          break;
        case 'pickup':
          this.windChime([1568], t, 0, vol * 0.5);
          break;
        case 'powerup':
          this.bubble(t, vol, 640);
          this.bubble(t + 0.06, vol * 0.7, 880);
          this.caveEcho([784, 988], t + 0.08, 0.08, vol * 0.7);
          break;
        case 'relic':
          this.windChime([784, 988, 1175, 1568], t, 0.09, vol);
          break;
        case 'extraLife':
          this.windChime([523, 659, 784, 1046, 1318], t, 0.08, vol);
          break;
        case 'moduleRelease':
          this.bubble(t, vol, 560);
          this.windChime([659, 880], t + 0.07, 0.08, vol * 0.7);
          break;
        case 'podHit':
          this.windChime([1318], t, 0, vol * 0.45);
          this.splash(t + 0.01, vol * 0.5);
          break;
        case 'podBreak':
          this.stoneCrumb(t, vol * 0.8);
          this.splash(t + 0.02, vol * 0.6);
          break;
        case 'warning':
          this.heartbeat(t + 0.05, vol);
          this.noise({ time: t, dur: 0.5, gain: 0.05 * vol, filterFrom: 320, filterTo: 90 });
          break;
        case 'bossHit':
          this.windChime([1046, 1318], t, 0.05, vol * 0.6);
          this.splash(t + 0.02, vol * 0.6);
          break;
        case 'summon':
          this.noise({ time: t, dur: 0.6, gain: 0.06 * vol, filterFrom: 200, filterTo: 700 });
          this.bubble(t + 0.1, vol * 0.6, 420);
          break;
        case 'stageClear':
          this.windChime([523, 659, 784, 1046, 1318, 1568], t, 0.11, vol);
          break;
        case 'waveClear':
          this.windChime([659, 988], t, 0.1, vol * 0.6);
          break;
        case 'gameOver':
          this.thunder(t, vol * 0.8);
          this.windChime([392, 349, 311, 262], t + 0.2, 0.22, vol * 0.6);
          break;
        case 'continue':
          this.windChime([440, 660, 880], t, 0.1, vol * 0.8);
          break;
        case 'select':
          this.uiDrop(t, vol);
          break;
        case 'move':
          this.uiDrop(t, vol * 0.5);
          break;
        case 'back':
          this.uiDrop(t, vol * 0.7);
          this.tone({ time: t + 0.04, freq: 340, slideTo: 220, dur: 0.1, type: 'sine', gain: 0.02 * vol, echo: true });
          break;
        case 'pause':
          this.uiDrop(t, vol * 0.6);
          break;
        case 'ready':
          this.bubble(t, vol, 660);
          this.windChime([880, 1108, 1320], t + 0.06, 0.08, vol * 0.7);
          break;
        case 'field':
          this.tone({ time: t, freq: 1400, slideTo: 900, dur: 0.03, type: 'sine', gain: 0.02 * vol });
          break;
        default:
          break;
      }
    } catch { /* audio is best-effort */ }
  }

  chime(freqs, time, stepDur, vol = 1) {
    this.windChime(freqs, time, stepDur, vol);
  }

  /**
   * Single oscillator voice.
   * { time, freq, dur, type, gain, bus, slideTo, filter, attack, echo }
   */
  tone({ time, freq, dur = 0.1, type = 'square', gain = 0.08, bus = 'sfx', slideTo = null, filter = null, attack = 0.004, echo = false }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(clampFreq(freq), time);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(clampFreq(slideTo), time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(bus === 'music' ? this.musicGain : this.sfxGain);
    if (echo && this.sfxEcho) g.connect(this.sfxEcho);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  noise({ time, dur = 0.2, gain = 0.15, bus = 'sfx', filterFrom = 3000, filterTo = 200, highpass = false, echo = false }) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = highpass ? 'highpass' : 'lowpass';
    filter.frequency.setValueAtTime(filterFrom, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), time + dur);
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus === 'music' ? this.musicGain : this.sfxGain);
    if (echo && this.sfxEcho) g.connect(this.sfxEcho);
    src.start(time);
    src.stop(time + dur + 0.02);
  }
}

const SFX_MIN_GAP = {
  laser: 0.045,
  enemyShot: 0.05,
  explosion: 0.05,
  podHit: 0.035,
  field: 0.18,
  bossHit: 0.05,
};

export { TRACKS };
