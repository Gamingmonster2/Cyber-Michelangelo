/**
 * Procedural chiptune + SFX engine (WebAudio, zero audio assets).
 *
 * The music is a tiny look-ahead sequencer: main() calls tick() every frame,
 * which schedules 16th-note steps slightly ahead of the audio clock. Tracks
 * are defined as chord loops with bass / arp / pad / drum layers.
 */

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
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch { /* ignore */ }
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
      if (this.pendingTrack) {
        const t = this.pendingTrack;
        this.pendingTrack = null;
        this.music(t);
      } else if (this.track) {
        this.step = 0;
        this.nextStepTime = ctx.currentTime + 0.12;
      }
      return true;
    } catch (err) {
      console.warn('[audio] failed to initialise WebAudio:', err);
      return false;
    }
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
  /* Music                                                            */
  /* ---------------------------------------------------------------- */

  music(track) {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (!this.ctx) {
      this.pendingTrack = track;
      return;
    }
    this.nextStepTime = this.ctx.currentTime + 0.08;
  }

  tick() {
    if (!this.ready || !this.track || this.muted) return;
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
    try {
      switch (name) {
        case 'laser':
          this.tone({ time: t, freq: 1550, slideTo: 680, dur: 0.055, type: 'square', gain: 0.05 * vol, bus: 'sfx' });
          break;
        case 'beam':
          this.tone({ time: t, freq: 260, slideTo: 1500, dur: 0.2, type: 'sawtooth', gain: 0.06 * vol, bus: 'sfx', filter: 2600 });
          break;
        case 'enemyShot':
          this.tone({ time: t, freq: 430, slideTo: 210, dur: 0.09, type: 'square', gain: 0.04 * vol, bus: 'sfx' });
          break;
        case 'explosion':
          this.noise({ time: t, dur: 0.3, gain: 0.22 * vol, bus: 'sfx', filterFrom: 2600, filterTo: 120 });
          this.tone({ time: t, freq: 130, slideTo: 38, dur: 0.22, type: 'sine', gain: 0.16 * vol, bus: 'sfx' });
          break;
        case 'playerDeath':
          this.noise({ time: t, dur: 0.6, gain: 0.3 * vol, bus: 'sfx', filterFrom: 3400, filterTo: 80 });
          this.tone({ time: t, freq: 420, slideTo: 45, dur: 0.7, type: 'sawtooth', gain: 0.15 * vol, bus: 'sfx' });
          break;
        case 'dock':
          this.chime([660, 990], t, 0.15, vol);
          break;
        case 'moduleLost':
          this.noise({ time: t, dur: 0.2, gain: 0.16 * vol, bus: 'sfx', filterFrom: 1800, filterTo: 200 });
          this.tone({ time: t, freq: 500, slideTo: 90, dur: 0.28, type: 'sawtooth', gain: 0.08 * vol, bus: 'sfx' });
          break;
        case 'formation':
          this.tone({ time: t, freq: 180, slideTo: 900, dur: 0.26, type: 'sawtooth', gain: 0.07 * vol, bus: 'sfx', filter: 2200 });
          this.noise({ time: t, dur: 0.22, gain: 0.06 * vol, bus: 'sfx', filterFrom: 700, filterTo: 4000, highpass: true });
          break;
        case 'rejoin':
          this.tone({ time: t, freq: 880, slideTo: 520, dur: 0.12, type: 'triangle', gain: 0.07 * vol, bus: 'sfx' });
          break;
        case 'nova':
          this.noise({ time: t, dur: 0.9, gain: 0.32 * vol, bus: 'sfx', filterFrom: 4200, filterTo: 60 });
          this.tone({ time: t, freq: 90, slideTo: 620, dur: 0.5, type: 'sawtooth', gain: 0.16 * vol, bus: 'sfx', filter: 1400 });
          this.tone({ time: t + 0.06, freq: 60, slideTo: 30, dur: 0.7, type: 'sine', gain: 0.2 * vol, bus: 'sfx' });
          break;
        case 'phoenix':
          this.tone({ time: t, freq: 70, slideTo: 340, dur: 0.9, type: 'sawtooth', gain: 0.16 * vol, bus: 'sfx', filter: 1600 });
          this.noise({ time: t, dur: 1.1, gain: 0.14 * vol, bus: 'sfx', filterFrom: 500, filterTo: 3400, highpass: true });
          this.chime([523, 659, 784, 1046], t + 0.1, 0.5, vol * 0.8);
          break;
        case 'pickup':
          this.chime([1320], t, 0.07, vol * 0.7);
          break;
        case 'powerup':
          this.chime([660, 880, 1320], t, 0.12, vol * 0.8);
          break;
        case 'relic':
          this.chime([784, 988, 1175, 1568], t, 0.2, vol);
          break;
        case 'extraLife':
          this.chime([523, 659, 784, 1046, 1318], t, 0.16, vol);
          break;
        case 'moduleRelease':
          this.chime([440, 554, 659], t, 0.16, vol * 0.8);
          break;
        case 'podHit':
          this.tone({ time: t, freq: 220, slideTo: 160, dur: 0.05, type: 'square', gain: 0.05 * vol, bus: 'sfx' });
          break;
        case 'podBreak':
          this.noise({ time: t, dur: 0.2, gain: 0.14 * vol, bus: 'sfx', filterFrom: 1600, filterTo: 160 });
          break;
        case 'warning':
          this.tone({ time: t, freq: 880, dur: 0.14, type: 'square', gain: 0.06 * vol, bus: 'sfx' });
          this.tone({ time: t + 0.18, freq: 660, dur: 0.14, type: 'square', gain: 0.06 * vol, bus: 'sfx' });
          break;
        case 'bossHit':
          this.noise({ time: t, dur: 0.18, gain: 0.16 * vol, bus: 'sfx', filterFrom: 2200, filterTo: 140 });
          break;
        case 'summon':
          this.tone({ time: t, freq: 120, slideTo: 480, dur: 0.3, type: 'sawtooth', gain: 0.06 * vol, bus: 'sfx' });
          break;
        case 'stageClear':
          this.chime([523, 659, 784, 1046, 1318, 1568], t, 0.22, vol);
          break;
        case 'waveClear':
          this.chime([659, 988], t, 0.18, vol * 0.7);
          break;
        case 'gameOver':
          this.chime([392, 349, 311, 262], t, 0.32, vol * 0.8);
          break;
        case 'continue':
          this.chime([440, 660, 880], t, 0.22, vol);
          break;
        case 'select':
          this.tone({ time: t, freq: 900, dur: 0.05, type: 'square', gain: 0.04 * vol, bus: 'sfx' });
          break;
        case 'move':
          this.tone({ time: t, freq: 640, dur: 0.035, type: 'square', gain: 0.03 * vol, bus: 'sfx' });
          break;
        case 'back':
          this.tone({ time: t, freq: 420, slideTo: 260, dur: 0.09, type: 'square', gain: 0.04 * vol, bus: 'sfx' });
          break;
        case 'pause':
          this.chime([740, 560], t, 0.1, vol * 0.7);
          break;
        case 'ready':
          this.chime([880, 1108, 1320], t, 0.18, vol * 0.8);
          break;
        case 'field':
          this.tone({ time: t, freq: 1400, slideTo: 900, dur: 0.03, type: 'sine', gain: 0.02 * vol, bus: 'sfx' });
          break;
        default:
          break;
      }
    } catch { /* audio is best-effort */ }
  }

  chime(freqs, time, stepDur, vol = 1) {
    freqs.forEach((freq, i) => {
      this.tone({
        time: time + i * stepDur,
        freq,
        dur: 0.22,
        type: 'triangle',
        gain: 0.08 * vol,
        bus: 'sfx',
        filter: 5000,
      });
    });
  }

  /**
   * Single oscillator voice.
   * { time, freq, dur, type, gain, bus, slideTo, filter, attack, echo }
   */
  tone({ time, freq, dur = 0.1, type = 'square', gain = 0.08, bus = 'sfx', slideTo = null, filter = null, attack = 0.004 }) {
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
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  noise({ time, dur = 0.2, gain = 0.15, bus = 'sfx', filterFrom = 3000, filterTo = 200, highpass = false }) {
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
