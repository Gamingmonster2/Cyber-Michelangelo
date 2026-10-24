/**
 * “Space nature” ambience — the game's soundtrack is not music and not raw
 * nature loops: it is a quiet, organic sci-fi bed built from two continuous
 * layers plus rare random details, all synthesised and processed in WebAudio.
 *
 *  1. Low space rumble   — deep ocean + high wind, low-passed and reverbed,
 *                          very quiet, gives width and weight.
 *  2. Drifting wind      — slowly pans left/right, rises slightly with motion,
 *                          gives a sense of speed.
 *  3. Hidden details     — distant thunder / water drop / ice crack every
 *                          8–20 seconds, so repetition never becomes obvious.
 *
 * No files are needed; this replaces the recorded nature beds as the default
 * style while keeping the game's SFX clear on top (the AudioEngine ducks this
 * bus whenever a laser/explosion/impact fires).
 */

export const SPACE_LAYERS = [
  { id: 'rumble', label: 'low space rumble', baseGain: 0.5 },
  { id: 'wind', label: 'drifting wind', baseGain: 0.32 },
];

export const SPACE_DETAILS = ['thunder', 'drop', 'ice'];

/** Depth/duration of the automatic background dip for loud gameplay sounds. */
export const DUCK_PRESETS = {
  laser: { depth: 0.18, dur: 0.14 },
  enemyShot: { depth: 0.1, dur: 0.1 },
  explosion: { depth: 0.5, dur: 0.55 },
  playerDeath: { depth: 0.72, dur: 0.9 },
  nova: { depth: 0.68, dur: 0.8 },
  phoenix: { depth: 0.55, dur: 0.7 },
  bossHit: { depth: 0.45, dur: 0.4 },
  podBreak: { depth: 0.35, dur: 0.3 },
  moduleLost: { depth: 0.5, dur: 0.45 },
  bigExplosion: { depth: 0.8, dur: 1.1 },
};

const FADE = 1.8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class SpaceAmbienceEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.destination = destination;
    this.active = false;
    this.motion = 0;
    this.mood = 'stage';
    this.duckUntil = 0;
    this.nodes = [];
    this.sources = [];

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);

    // A small algorithmic reverb shared by the layers and their details.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(ctx, 2.1, 2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(destination);

    this.pink = this.makeNoise(ctx, 'pink');
    this.brown = this.makeNoise(ctx, 'brown');
    this.windLayer = null;
    this.rumbleLayer = null;
    this.nextDetail = 0;
  }

  /* ---------------------------------------------------------------- */
  /* Buffers                                                          */
  /* ---------------------------------------------------------------- */

  makeImpulse(ctx, seconds = 2, decay = 2.5) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buffer = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  makeNoise(ctx, kind) {
    const rate = ctx.sampleRate;
    const seconds = 4;
    const len = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(1, len, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        // Pink-ish approximation by mixing a slow random walk with white.
        last = last * 0.985 + white * 0.015;
        data[i] = white * 0.35 + last * 2.2;
      }
    }
    return buffer;
  }

  loop(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    this.sources.push(src);
    return src;
  }

  lfo(freq, depth, target, type = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = depth;
    osc.connect(gain);
    gain.connect(target);
    osc.start();
    this.nodes.push(osc, gain);
    return { osc, gain };
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  start() {
    if (this.active) return;
    this.active = true;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.linearRampToValueAtTime(1, now + FADE);

    // ---- 1. Low space rumble ----------------------------------------
    const rumble = ctx.createGain();
    rumble.gain.value = 0.42;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;
    rumbleFilter.Q.value = 0.6;
    const rumbleNoise = this.loop(this.brown);
    rumbleNoise.connect(rumbleFilter);
    rumbleFilter.connect(rumble);
    rumble.connect(this.out);
    rumble.connect(this.reverbSend);
    rumbleNoise.start();

    // Sub drone (the “deep ocean” weight), slowly drifting.
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 41;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.2;
    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.value = 160;
    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.out);
    subGain.connect(this.reverbSend);
    sub.start(now);
    this.nodes.push(sub, subGain, subFilter);
    this.sources.push(sub);
    this.lfo(0.035, 3.2, sub.frequency);
    this.lfo(0.05, 26, rumbleFilter.frequency);

    this.rumbleLayer = { gain: rumble, filter: rumbleFilter };

    // ---- 2. Drifting wind -------------------------------------------
    const wind = ctx.createGain();
    wind.gain.value = 0.3;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 620;
    windFilter.Q.value = 0.65;
    const windShelf = ctx.createBiquadFilter();
    windShelf.type = 'highpass';
    windShelf.frequency.value = 220;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const windNoise = this.loop(this.pink);
    windNoise.connect(windFilter);
    windFilter.connect(windShelf);
    windShelf.connect(wind);
    if (panner) {
      wind.connect(panner);
      panner.connect(this.out);
      panner.connect(this.reverbSend);
    } else {
      wind.connect(this.out);
      wind.connect(this.reverbSend);
    }
    windNoise.start(now);
    if (panner) this.lfo(0.055, 0.55, panner.pan); // slow left/right movement
    this.lfo(0.041, 190, windFilter.frequency);
    this.windLayer = { gain: wind, filter: windFilter, panner, shelf: windShelf };

    const nowSec = ctx.currentTime;
    this.nextDetail = nowSec + 8 + Math.random() * 6;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    try {
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0.0001, now + FADE);
    } catch { /* ignore */ }
    for (const src of this.sources) {
      try { src.stop(now + FADE + 0.1); } catch { /* already stopped */ }
    }
    for (const node of this.nodes) {
      try { node.stop && node.stop(now + FADE + 0.1); } catch { /* ignore */ }
    }
    const layers = [this.rumbleLayer, this.windLayer].filter(Boolean);
    setTimeout(() => {
      try { this.out.disconnect(); } catch { /* ignore */ }
      try { this.reverbSend.disconnect(); } catch { /* ignore */ }
      try { this.reverbGain.disconnect(); } catch { /* ignore */ }
      try { this.reverb.disconnect(); } catch { /* ignore */ }
      for (const layer of layers) {
        for (const node of Object.values(layer)) {
          try { node.disconnect && node.disconnect(); } catch { /* ignore */ }
        }
      }
      for (const src of this.sources) {
        try { src.disconnect(); } catch { /* ignore */ }
      }
      this.sources = [];
      this.nodes = [];
    }, Math.ceil((FADE + 0.6) * 1000));
  }

  /* ---------------------------------------------------------------- */
  /* Runtime responses                                                */
  /* ---------------------------------------------------------------- */

  /** 0..1 movement intensity: the wind rises a little with speed. */
  setMotion(level) {
    this.motion = clamp(level, 0, 1);
    if (!this.active || !this.windLayer) return;
    const now = this.ctx.currentTime;
    const base = 620;
    const targetGain = 0.3 + this.motion * 0.16;
    const targetFreq = base + this.motion * 260;
    this.windLayer.gain.gain.setTargetAtTime(targetGain, now, 0.25);
    this.windLayer.filter.frequency.setTargetAtTime(targetFreq, now, 0.4);
  }

  /** Scene mood shapes the detail frequency and the rumble weight a little. */
  setMood(mood) {
    if (!mood || mood === this.mood) return;
    this.mood = mood;
    if (!this.active || !this.rumbleLayer) return;
    const now = this.ctx.currentTime;
    const weight = mood === 'boss' ? 0.52 : mood === 'gameover' ? 0.3 : 0.42;
    this.rumbleLayer.gain.gain.setTargetAtTime(weight, now, 0.8);
  }

  /** Dip the ambience so gameplay SFX stay clearly on top. */
  duck(depth = 0.5, seconds = 0.4) {
    if (!this.active) return;
    const now = this.ctx.currentTime;
    const target = Math.max(0.0001, 1 - clamp(depth, 0, 0.95));
    const end = now + Math.max(0.08, seconds);
    this.duckUntil = Math.max(this.duckUntil, end);
    try {
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setTargetAtTime(target, now, 0.035);
      this.out.gain.setTargetAtTime(1, end, 0.35);
    } catch { /* ignore */ }
  }

  /** Per-frame scheduling of sparse random details. */
  tick() {
    if (!this.active) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (this.duckUntil && now > this.duckUntil + 0.2) this.duckUntil = 0;

    if (now < this.nextDetail) return;
    const moodRange = {
      boss: [6, 12],
      title: [10, 20],
      gameover: [14, 24],
      stage: [8, 20],
    }[this.mood] || [8, 20];
    const gap = moodRange[0] + Math.random() * (moodRange[1] - moodRange[0]);
    this.nextDetail = now + gap;
    const kind = SPACE_DETAILS[Math.floor(Math.random() * SPACE_DETAILS.length)];
    if (kind === 'thunder') this.playThunder();
    else if (kind === 'drop') this.playDrop();
    else this.playIce();
  }

  /* ---------------------------------------------------------------- */
  /* Details                                                          */
  /* ---------------------------------------------------------------- */

  playThunder() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 3.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    gain.connect(this.reverbSend);
    src.start(now);
    src.stop(now + 3.5);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(44, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 2.4);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.1, now + 0.3);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    sub.connect(subGain);
    subGain.connect(this.out);
    sub.start(now);
    sub.stop(now + 2.8);
    this.cleanupLater([src, sub, filter, gain, subGain], now + 4);
  }

  playDrop() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.out);
    gain.connect(this.reverbSend);
    osc.start(now);
    osc.stop(now + 0.14);
    this.cleanupLater([osc, gain], now + 0.4);
  }

  playIce() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const count = 2 + Math.floor(Math.random() * 2);
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const t = now + i * (0.025 + Math.random() * 0.05);
      const src = ctx.createBufferSource();
      src.buffer = this.pink;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2600 + Math.random() * 2400;
      filter.Q.value = 2.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.05);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.out);
      gain.connect(this.reverbSend);
      src.start(t);
      src.stop(t + 0.18);
      nodes.push(src, filter, gain);
    }
    this.cleanupLater(nodes, now + 0.6);
  }

  cleanupLater(nodes, at) {
    setTimeout(() => {
      for (const node of nodes) {
        try { node.disconnect(); } catch { /* ignore */ }
      }
    }, Math.max(100, Math.ceil((at - this.ctx.currentTime) * 1000) + 400));
  }

  /** State snapshot for the headless audio probe. */
  getState() {
    return {
      active: this.active,
      motion: Math.round(this.motion * 100) / 100,
      mood: this.mood,
      layers: SPACE_LAYERS.map((l) => l.id),
      details: SPACE_DETAILS.slice(),
    };
  }
}
