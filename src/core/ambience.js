/**
 * Nature ambience engine (Phase 3 audio direction).
 *
 * Replaces the music soundtrack with layered recordings of the natural world:
 * forest, rivers, wind, rain, thunder and cave water. Each scene maps to a
 * "bed" of 1–2 looping field recordings, crossfaded seamlessly and decorated
 * with occasional randomized accents so the loop never feels mechanical.
 *
 * All samples are public-domain / CC0 (see assets/audio/nature/CREDITS.md).
 * Every sample is optional: if a file cannot be fetched or decoded, the layer
 * falls back to filtered-noise synthesis (wind/water/rain/cave) so audio can
 * never break gameplay — no music required.
 */

export const NATURE_FILES = {
  forest: 'assets/audio/nature/forest-ambience.ogg',
  river: 'assets/audio/nature/river-stones.ogg',
  rivulet: 'assets/audio/nature/rivulet-woods.ogg',
  wind: 'assets/audio/nature/wind.ogg',
  rainSoft: 'assets/audio/nature/rain-soft.ogg',
  rainThunder: 'assets/audio/nature/rain-thunder.ogg',
  cavern: 'assets/audio/nature/cavern.ogg',
};

/**
 * Scene beds. `gain` is mixed under the user's ambience volume; accents are
 * short slices played at random offsets/gaps (never looped).
 */
export const NATURE_BEDS = {
  title: {
    layers: [
      { url: NATURE_FILES.forest, gain: 0.5, kind: 'forest' },
      { url: NATURE_FILES.wind, gain: 0.12, kind: 'wind' },
    ],
    accent: { url: NATURE_FILES.rivulet, gain: 0.1, minGap: 16, maxGap: 30, maxOffset: 5, duration: 3.2 },
  },
  garden: {
    layers: [
      { url: NATURE_FILES.river, gain: 0.58, kind: 'water' },
      { url: NATURE_FILES.forest, gain: 0.16, kind: 'forest' },
    ],
    accent: { url: NATURE_FILES.rivulet, gain: 0.12, minGap: 12, maxGap: 24, maxOffset: 5, duration: 3 },
  },
  catacomb: {
    layers: [
      { url: NATURE_FILES.cavern, gain: 0.5, kind: 'cave' },
      { url: NATURE_FILES.rivulet, gain: 0.12, kind: 'water' },
    ],
  },
  cathedral: {
    layers: [
      { url: NATURE_FILES.wind, gain: 0.46, kind: 'wind' },
      { url: NATURE_FILES.rainThunder, gain: 0.1, kind: 'rain' },
    ],
  },
  boss: {
    layers: [
      { url: NATURE_FILES.rainThunder, gain: 0.5, kind: 'rain' },
      { url: NATURE_FILES.wind, gain: 0.42, kind: 'wind' },
    ],
  },
  gameover: {
    layers: [
      { url: NATURE_FILES.rainSoft, gain: 0.42, kind: 'rain' },
      { url: NATURE_FILES.wind, gain: 0.08, kind: 'wind' },
    ],
  },
};

/** Choose a bed for the current music hook + stage theme. */
export function bedForScene(track, themeId) {
  if (track === 'title') return 'title';
  if (track === 'boss') return 'boss';
  if (track === 'gameover') return 'gameover';
  if (themeId === 'catacombs') return 'catacomb';
  if (themeId === 'cathedral') return 'cathedral';
  return 'garden';
}

const FADE = 2.6; // seconds of overlap when looping or changing scenes

function kindForUrl(url) {
  if (url.includes('wind')) return 'wind';
  if (url.includes('rain')) return 'rain';
  if (url.includes('cavern')) return 'cave';
  if (url.includes('river') || url.includes('rivulet')) return 'water';
  return 'forest';
}

export class AmbienceEngine {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.destination = destination;
    this.key = null;
    this.bed = null;
    this.bufferCache = new Map();
    this.noiseBuffer = this.buildNoise(ctx);
    this.active = true;
  }

  buildNoise(ctx) {
    const len = Math.floor(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06; // pink-ish
      data[i] = last * 5 + white * 0.15;
    }
    return buffer;
  }

  load(url) {
    if (this.bufferCache.has(url)) return Promise.resolve(this.bufferCache.get(url));
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.arrayBuffer();
      })
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buffer) => {
        this.bufferCache.set(url, buffer);
        return buffer;
      });
    this.bufferCache.set(url, promise);
    // Replace the cached promise with the buffer once ready (cache hits above
    // are always resolved values by the time a bed is reused).
    promise.then((buffer) => this.bufferCache.set(url, buffer)).catch(() => this.bufferCache.delete(url));
    return promise;
  }

  setBed(key) {
    if (!NATURE_BEDS[key] || this.key === key) return;
    this.key = key;
    this.fadeOutBed();
    this.startBed(key, NATURE_BEDS[key]);
  }

  startBed(key, def) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0, now);
    bedGain.gain.linearRampToValueAtTime(1, now + FADE);
    bedGain.connect(this.destination);

    const bed = {
      key,
      def,
      gain: bedGain,
      layers: def.layers.map((layerDef) => {
        const bus = ctx.createGain();
        bus.gain.value = 1;
        bus.connect(bedGain);
        return { def: layerDef, bus, buffer: null, loading: true, failed: false, current: null, prev: null, proc: null };
      }),
      accentBuffer: null,
      accentNext: now + 8 + Math.random() * 8,
    };
    this.bed = bed;

    for (const layer of bed.layers) {
      this.load(layer.def.url)
        .then((buffer) => {
          layer.buffer = buffer;
          layer.loading = false;
        })
        .catch((err) => {
          console.warn('[ambience] sample unavailable, synthesizing layer:', layer.def.url, err);
          layer.failed = true;
          layer.loading = false;
          this.installProcedural(layer);
        });
    }
    if (def.accent) {
      this.load(def.accent.url)
        .then((buffer) => { bed.accentBuffer = buffer; })
        .catch(() => { /* accents are optional */ });
    }
  }

  fadeOutBed() {
    const old = this.bed;
    this.bed = null;
    if (!old) return;
    const now = this.ctx.currentTime;
    try {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + FADE);
    } catch { /* ignore */ }
    const stopAt = now + FADE + 0.3;
    for (const layer of old.layers) {
      if (layer.current) {
        try { layer.current.src.stop(stopAt); } catch { /* already stopped */ }
      }
      if (layer.proc) {
        try { layer.proc.src.stop(stopAt); } catch { /* ignore */ }
        layer.proc.stopAt = stopAt;
      }
    }
    setTimeout(() => {
      try { old.gain.disconnect(); } catch { /* ignore */ }
      for (const layer of old.layers) {
        try { layer.bus.disconnect(); } catch { /* ignore */ }
        if (layer.proc) layer.proc.disconnect();
      }
    }, Math.ceil((FADE + 1) * 1000));
  }

  stop() {
    this.fadeOutBed();
    this.key = null;
  }

  /** Per-frame housekeeping: refill loops ahead of the seam, fire accents. */
  tick() {
    if (!this.active) return;
    const bed = this.bed;
    if (!bed) return;
    const now = this.ctx.currentTime;
    for (const layer of bed.layers) {
      if (layer.loading) continue;
      if (layer.failed) continue;
      if (!layer.current) {
        this.startLayerSource(layer, now);
      } else if (now >= layer.current.start + layer.current.duration - FADE) {
        this.startLayerSource(layer, now);
      }
      if (layer.prev && now > layer.prev.stopAt) {
        try { layer.prev.src.disconnect(); } catch { /* ignore */ }
        try { layer.prev.gain.disconnect(); } catch { /* ignore */ }
        layer.prev = null;
      }
    }
    if (bed.accentBuffer && bed.def.accent && now >= bed.accentNext) {
      this.playAccent(bed, now);
    }
  }

  startLayerSource(layer, now) {
    const ctx = this.ctx;
    const buffer = layer.buffer;
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = false;
    const gain = ctx.createGain();
    const target = layer.def.gain;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(target, now + FADE);
    src.connect(gain);
    gain.connect(layer.bus);
    src.start(now);
    const entry = { src, gain, start: now, duration: buffer.duration, stopAt: now + buffer.duration + FADE + 0.2 };
    if (layer.current) {
      const old = layer.current;
      try {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + FADE);
        old.src.stop(now + FADE + 0.1);
      } catch { /* ignore */ }
      layer.prev = old;
    }
    layer.current = entry;
  }

  playAccent(bed, now) {
    const a = bed.def.accent;
    const buffer = bed.accentBuffer;
    const duration = Math.min(a.duration || 3, buffer.duration);
    const maxOffset = Math.max(0, buffer.duration - duration - 0.2);
    const offset = Math.random() * Math.min(a.maxOffset ?? maxOffset, maxOffset);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    const peak = a.gain || 0.1;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.5);
    gain.gain.setValueAtTime(peak, now + duration - 0.8);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    src.connect(gain);
    gain.connect(bed.gain);
    src.start(now, offset, duration);
    src.onended = () => {
      try { gain.disconnect(); } catch { /* ignore */ }
      try { src.disconnect(); } catch { /* ignore */ }
    };
    bed.accentNext = now + a.minGap + Math.random() * (a.maxGap - a.minGap);
  }

  /**
   * Filtered-noise stand-in used when a recording cannot be decoded
   * (e.g. a very old browser without Ogg Vorbis support).
   */
  installProcedural(layer) {
    const ctx = this.ctx;
    const kind = layer.def.kind || kindForUrl(layer.def.url);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.05, (layer.def.gain || 0.4) * 0.6);
    let node = src;
    const chain = [];
    const filters = [];
    const make = (type, freq, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      chain.push(f);
      filters.push(f);
      return f;
    };
    if (kind === 'wind') {
      node.connect(make('bandpass', 480, 0.6));
      node = chain[chain.length - 1];
      node.connect(make('lowpass', 1800, 0.4));
      node = chain[chain.length - 1];
    } else if (kind === 'water') {
      node.connect(make('highpass', 500, 0.5));
      node = chain[chain.length - 1];
      node.connect(make('bandpass', 1400, 0.8));
      node = chain[chain.length - 1];
    } else if (kind === 'rain') {
      node.connect(make('highpass', 1600, 0.4));
      node = chain[chain.length - 1];
      node.connect(make('lowpass', 6800, 0.4));
      node = chain[chain.length - 1];
    } else if (kind === 'cave') {
      node.connect(make('lowpass', 320, 0.5));
      node = chain[chain.length - 1];
      node.connect(make('bandpass', 620, 1.1));
      node = chain[chain.length - 1];
    } else {
      node.connect(make('bandpass', 2600, 0.8));
      node = chain[chain.length - 1];
    }
    node.connect(gain);
    gain.connect(layer.bus);
    // Slow LFO on the filter for movement.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = kind === 'rain' ? 0.12 : 0.18;
    lfoGain.gain.value = kind === 'rain' ? 900 : 420;
    lfo.connect(lfoGain);
    if (filters[0]) lfoGain.connect(filters[0].frequency);
    lfo.start();
    src.start();
    layer.proc = {
      src,
      gain,
      filters,
      lfo,
      lfoGain,
      disconnect: () => {
        try { src.stop(); } catch { /* ignore */ }
        try { lfo.stop(); } catch { /* ignore */ }
        for (const f of filters) { try { f.disconnect(); } catch { /* ignore */ } }
        try { lfoGain.disconnect(); } catch { /* ignore */ }
        try { gain.disconnect(); } catch { /* ignore */ }
        try { src.disconnect(); } catch { /* ignore */ }
      },
    };
  }
}
