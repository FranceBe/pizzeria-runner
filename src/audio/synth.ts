// The game's sound effects, synthesised in code with the Web Audio API: oscillators, a noise buffer, filters and gain
// envelopes. No recordings, no libraries. Every effect is drawn on any audio context, so the same code renders it
// ahead into a buffer (OfflineAudioContext, see engine.ts) and plays it live if that buffer isn't ready yet.
// All the numbers to tweak are in SOUND, below. The chime, the till and the sizzle follow what the game's first
// (recorded) sounds were made of: their pitches, lengths and textures, measured from the recordings.

// The one-shot effects. The oven's sizzle is a loop of its own (createSizzle).
export const EFFECT_IDS = ["newOrder", "payment", "fanfareSmall", "fanfareMedium", "fanfareBig"] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

// [frequency ratio to the fundamental, level]: the partials of a struck note.
type Partials = readonly (readonly [number, number])[];

interface Note {
  /** Hz. */
  frequency: number;
  /** Seconds from the start of the effect. */
  at: number;
  /** Seconds, until the note has died away. */
  length: number;
  level: number;
}

interface Fanfare {
  notes: readonly Note[];
  /** A soft octave above each note, detuned a little: the shimmer. */
  shimmer: number;
  /** A low note under it all, for the biggest one. */
  bass?: Note;
}

// A clink of coins: a few bright tones struck together, dying away fast.
interface Clink {
  at: number;
  /** [Hz, level]. */
  tones: readonly (readonly [number, number])[];
  decay: number;
}

// Note names to Hz.
const G4 = 392, C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5, D6 = 1174.66;
const E6 = 1318.51, E7 = 2637.02, G6 = 1567.98, B6 = 1975.53, A7 = 3520, C3 = 130.81;

export const SOUND = {
  // A new order: three soft mallet notes rising quickly (G4, C5, G5), like a marimba: each note's fundamental with a
  // partial about four times higher. Each note holds, fading a little, until the next one takes over; the last one
  // rings a little longer. A third of a second in all, pleasant on repeat.
  chime: {
    notes: [
      { frequency: G4, at: 0.005, length: 0.09, level: 0.36 },
      { frequency: C5, at: 0.095, length: 0.09, level: 0.36 },
      { frequency: G5, at: 0.185, length: 0.11, level: 0.4 },
    ],
    partials: [[1, 1], [3.9, 0.3], [6.5, 0.07]] as Partials,
    attack: 0.006,
    // While it holds, a note fades to this share of its level, then lets go this quickly.
    sustain: 0.45,
    release: 0.025,
  },
  // A payment: the drawer's click (a burst of bright noise), then coins jingling for a quarter of a second, a first
  // handful (A5 with B6) then brighter ones (A7 over A5 and E5), over a glint of very high noise all along.
  till: {
    click: { at: 0.015, seconds: 0.03, highpassHz: 6000, level: 0.36 },
    clinks: [
      { at: 0.03, tones: [[A5, 0.26], [B6, 0.2], [E7, 0.12]], decay: 0.11 },
      { at: 0.06, tones: [[A5, 0.18], [B6, 0.15], [E7, 0.09]], decay: 0.1 },
      { at: 0.09, tones: [[A5, 0.13], [B6, 0.12]], decay: 0.1 },
      { at: 0.145, tones: [[A7, 0.26], [A5, 0.21], [E5, 0.13]], decay: 0.11 },
      { at: 0.175, tones: [[A7, 0.22], [A5, 0.17], [E5, 0.1]], decay: 0.1 },
      { at: 0.205, tones: [[A7, 0.13], [A5, 0.1]], decay: 0.08 },
    ] as readonly Clink[],
    glint: { at: 0.02, seconds: 0.23, highpassHz: 13000, level: 0.09 },
    attack: 0.002,
  },
  // Major arpeggios, warm (triangle waves) with a little shimmer. Small: a quick success; medium: a level or an
  // achievement; big: the biggest win.
  fanfares: {
    fanfareSmall: {
      notes: [
        { frequency: G5, at: 0, length: 0.22, level: 0.22 },
        { frequency: B5, at: 0.08, length: 0.22, level: 0.22 },
        { frequency: D6, at: 0.16, length: 0.45, level: 0.24 },
      ],
      shimmer: 0.05,
    },
    fanfareMedium: {
      notes: [
        { frequency: C5, at: 0, length: 0.25, level: 0.22 },
        { frequency: E5, at: 0.1, length: 0.25, level: 0.22 },
        { frequency: G5, at: 0.2, length: 0.25, level: 0.22 },
        // The last one rings as a chord.
        { frequency: C6, at: 0.32, length: 0.9, level: 0.24 },
        { frequency: G5, at: 0.32, length: 0.9, level: 0.12 },
        { frequency: E5, at: 0.32, length: 0.9, level: 0.1 },
      ],
      shimmer: 0.07,
    },
    fanfareBig: {
      notes: [
        { frequency: C5, at: 0, length: 0.22, level: 0.2 },
        { frequency: E5, at: 0.09, length: 0.22, level: 0.2 },
        { frequency: G5, at: 0.18, length: 0.22, level: 0.2 },
        { frequency: C6, at: 0.27, length: 0.3, level: 0.22 },
        // A second, higher run…
        { frequency: A5, at: 0.45, length: 0.22, level: 0.18 },
        { frequency: C6, at: 0.53, length: 0.22, level: 0.2 },
        { frequency: E6, at: 0.61, length: 0.22, level: 0.2 },
        // …and a big chord to finish, held.
        { frequency: G6, at: 0.72, length: 1.5, level: 0.2 },
        { frequency: E6, at: 0.72, length: 1.5, level: 0.14 },
        { frequency: C6, at: 0.72, length: 1.5, level: 0.14 },
        { frequency: G5, at: 0.72, length: 1.5, level: 0.1 },
      ],
      shimmer: 0.09,
      bass: { frequency: C3, at: 0.72, length: 1.6, level: 0.18 },
    },
  } satisfies Record<"fanfareSmall" | "fanfareMedium" | "fanfareBig", Fanfare>,
  fanfareAttack: 0.012,
  // The oven's sizzle, while any pizza bakes, at one steady level: a bright hiss (most of it between 4 and 16 kHz,
  // its colour drifting slowly so it never sounds like radio static), dense fine crackle, now and then a small pop,
  // and bubbles: low round "blops" rising in pitch, alone or in twos, like cheese bubbling.
  sizzle: {
    hissHighpassHz: 1500,
    hissPeakHz: 6500,
    hissPeakQ: 0.5,
    hissLevel: 0.45,
    // The peak wanders this far, this slowly; the level breathes a little too.
    driftHz: 2500,
    driftRate: 0.09,
    breathDepth: 0.2,
    breathRate: 0.21,
    crackleHighpassHz: 900,
    crackleLevel: 1.5,
    crackleSeconds: 5.3,
    cracklesPerSecond: 120,
    popsPerSecond: 2,
    bubbles: {
      // A loop of its own, its length unlike the others', so the three rarely line up the same way.
      seconds: 6.1,
      // Groups of one or two bubbles, this many groups a second.
      groupsPerSecond: 1.8,
      largestGroup: 2,
      lowHz: 150,
      highHz: 450,
      // A bubble's pitch rises this much while it lasts.
      rise: 1.5,
      minSeconds: 0.035,
      maxSeconds: 0.085,
      lowpassHz: 1600,
      level: 1.5,
    },
    level: 0.3,
    fadeIn: 0.25,
    fadeOut: 0.2,
  },
  // Seconds of white noise, made once per audio context and reused by everything.
  noiseSeconds: 2,
};

const TAIL = 0.1;

// How long an effect lasts, tail included: the length of its pre-rendered buffer.
export const effectSeconds = (id: EffectId): number => {
  if (id === "newOrder") return Math.max(...SOUND.chime.notes.map((note) => note.at + note.length)) + TAIL;
  if (id === "payment") return Math.max(...SOUND.till.clinks.map((clink) => clink.at + clink.decay), SOUND.till.glint.at + SOUND.till.glint.seconds) + TAIL;
  const fanfare: Fanfare = SOUND.fanfares[id];
  const ends = [...fanfare.notes, ...(fanfare.bass ? [fanfare.bass] : [])].map((note) => note.at + note.length);
  return Math.max(...ends) + TAIL;
};

// Nodes that start and stop on their own are let go once they end, so nothing piles up over a long evening.
const releaseOnEnd = (source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void => {
  source.onended = () => {
    source.disconnect();
    nodes.forEach((node) => node.disconnect());
  };
};

// White noise, made once per context and shared by every sound.
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
export const noiseBuffer = (context: BaseAudioContext): AudioBuffer => {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;
  const buffer = context.createBuffer(1, Math.ceil(SOUND.noiseSeconds * context.sampleRate), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
  noiseBuffers.set(context, buffer);
  return buffer;
};

// A sine-ish tone with a quick attack and an exponential decay. `type` may warm it up (triangle).
const tone = (
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
  { frequency, at, length, level }: Note,
  options: { type?: OscillatorType; attack: number; detune?: number; hold?: { sustain: number; release: number } },
): void => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.value = frequency;
  oscillator.detune.value = options.detune ?? 0;
  const begin = start + at;
  gain.gain.setValueAtTime(0, begin);
  gain.gain.linearRampToValueAtTime(level, begin + options.attack);
  // Held: fades gently for its length, then lets go quickly; otherwise it dies away over its length.
  const end = options.hold ? begin + length + options.hold.release : begin + length;
  if (options.hold) gain.gain.exponentialRampToValueAtTime(level * options.hold.sustain, begin + length);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(destination);
  oscillator.start(begin);
  oscillator.stop(end + 0.02);
  releaseOnEnd(oscillator, gain);
};

// A mallet note held until the next one: its partials, the higher ones fading further while it holds.
const struck = (context: BaseAudioContext, destination: AudioNode, start: number, note: Note): void => {
  const { partials, attack, sustain, release } = SOUND.chime;
  partials.forEach(([ratio, share], index) => {
    const hold = { sustain: sustain / (1 + index), release };
    tone(context, destination, start, { ...note, frequency: note.frequency * ratio, level: note.level * share }, { attack, hold });
  });
};

// A burst of high-passed noise: the till's click, a coin's glint.
const noiseBurst = (context: BaseAudioContext, destination: AudioNode, begin: number, seconds: number, highpassHz: number, level: number): void => {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpassHz;
  const gain = context.createGain();
  gain.gain.setValueAtTime(level, begin);
  gain.gain.exponentialRampToValueAtTime(0.0001, begin + seconds);
  source.connect(filter).connect(gain).connect(destination);
  source.start(begin, Math.random() * (SOUND.noiseSeconds - seconds));
  source.stop(begin + seconds + 0.01);
  releaseOnEnd(source, filter, gain);
};

// Draws a one-shot effect on any context (live or offline), starting at `start` (its time), into `destination`.
export const drawEffect = (context: BaseAudioContext, destination: AudioNode, id: EffectId, start: number): void => {
  if (id === "newOrder") {
    SOUND.chime.notes.forEach((note) => struck(context, destination, start, note));
    return;
  }
  if (id === "payment") {
    const { click, clinks, glint, attack } = SOUND.till;
    noiseBurst(context, destination, start + click.at, click.seconds, click.highpassHz, click.level);
    noiseBurst(context, destination, start + glint.at, glint.seconds, glint.highpassHz, glint.level);
    clinks.forEach((clink) => {
      clink.tones.forEach(([frequency, level]) => tone(context, destination, start, { frequency, at: clink.at, length: clink.decay, level }, { attack }));
    });
    return;
  }
  const fanfare: Fanfare = SOUND.fanfares[id];
  const attack = SOUND.fanfareAttack;
  fanfare.notes.forEach((note) => {
    tone(context, destination, start, note, { type: "triangle", attack });
    tone(context, destination, start, { ...note, frequency: note.frequency * 2, level: note.level * fanfare.shimmer * 4 }, { attack, detune: 6 });
  });
  if (fanfare.bass) tone(context, destination, start, fanfare.bass, { type: "triangle", attack: attack * 3 });
};

const between = (low: number, high: number): number => low + Math.random() * (high - low);

// A buffer drawn once per context and kept: the crackle and bubble tracks.
const drawnOnce = (cache: WeakMap<BaseAudioContext, AudioBuffer>, context: BaseAudioContext, seconds: number, draw: (data: Float32Array, rate: number) => void): AudioBuffer => {
  const cached = cache.get(context);
  if (cached) return cached;
  const buffer = context.createBuffer(1, Math.ceil(seconds * context.sampleRate), context.sampleRate);
  draw(buffer.getChannelData(0), context.sampleRate);
  cache.set(context, buffer);
  return buffer;
};

// The crackle track: dense tiny clicks and, now and then, a small rounder pop.
const crackleBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const crackleBuffer = (context: BaseAudioContext): AudioBuffer =>
  drawnOnce(crackleBuffers, context, SOUND.sizzle.crackleSeconds, (data, rate) => {
    const { crackleSeconds, cracklesPerSecond, popsPerSecond } = SOUND.sizzle;
    // A burst of noise dying away; smoothing lowers its pitch (a pop is rounder than a click).
    const burst = (at: number, seconds: number, level: number, smoothing: number) => {
      const length = Math.floor(seconds * rate);
      let last = 0;
      for (let index = 0; index < length && at + index < data.length; index++) {
        last = last * smoothing + (Math.random() * 2 - 1) * (1 - smoothing);
        data[at + index] += last * level * Math.exp((-6 * index) / length);
      }
    };
    for (let crackle = 0; crackle < Math.round(cracklesPerSecond * crackleSeconds); crackle++) {
      burst(Math.floor(Math.random() * data.length), between(0.001, 0.005), between(0.3, 1), 0.15);
    }
    for (let pop = 0; pop < Math.round(popsPerSecond * crackleSeconds); pop++) {
      burst(Math.floor(Math.random() * data.length), between(0.01, 0.022), between(0.5, 0.9), 0.6);
    }
  });

// The bubble track: low round blops whose pitch rises as they burst, alone or in quick twos.
const bubbleBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const bubbleBuffer = (context: BaseAudioContext): AudioBuffer =>
  drawnOnce(bubbleBuffers, context, SOUND.sizzle.bubbles.seconds, (data, rate) => {
    const { seconds, groupsPerSecond, largestGroup, lowHz, highHz, rise, minSeconds, maxSeconds } = SOUND.sizzle.bubbles;
    const bubble = (at: number) => {
      const length = Math.floor(between(minSeconds, maxSeconds) * rate);
      // Pitches spread evenly to the ear (log scale).
      const from = lowHz * Math.pow(highHz / lowHz, Math.random());
      const level = between(0.4, 1);
      let phase = 0;
      for (let index = 0; index < length; index++) {
        const progress = index / length;
        phase += (2 * Math.PI * from * Math.pow(rise, progress)) / rate;
        // A quick swell, then gone: the bubble bursts.
        const envelope = Math.min(1, index / (0.004 * rate)) * Math.exp(-5 * progress);
        data[(at + index) % data.length] += Math.sin(phase) * envelope * level;
      }
    };
    for (let group = 0; group < Math.round(groupsPerSecond * seconds); group++) {
      let at = Math.floor(Math.random() * data.length);
      const count = 1 + Math.floor(Math.random() * largestGroup);
      for (let index = 0; index < count; index++) {
        bubble(at);
        at += Math.floor(between(0.04, 0.09) * rate);
      }
    }
  });

export interface Sizzle {
  /** Fades it out and lets go of everything. */
  stop: () => void;
}

// The oven's sizzle, one loop for every oven: fades in, plays at one level while any pizza bakes, fades out and lets
// go of everything once stopped.
export const createSizzle = (context: AudioContext, destination: AudioNode): Sizzle => {
  const p = SOUND.sizzle;
  const nodes: AudioNode[] = [];
  const make = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const filter = (type: BiquadFilterType, frequency: number, q?: number) => {
    const node = make(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    if (q !== undefined) node.Q.value = q;
    return node;
  };
  const gain = (value: number) => {
    const node = make(context.createGain());
    node.gain.value = value;
    return node;
  };
  const loop = (buffer: AudioBuffer) => {
    const source = make(context.createBufferSource());
    source.buffer = buffer;
    source.loop = true;
    return source;
  };
  const lfo = (rate: number) => {
    const oscillator = make(context.createOscillator());
    oscillator.frequency.value = rate;
    return oscillator;
  };

  const output = gain(0);
  output.connect(destination);

  // The hiss: noise, high-passed, with a wandering peak and a breathing level.
  const hiss = loop(noiseBuffer(context));
  const peak = filter("bandpass", p.hissPeakHz, p.hissPeakQ);
  const hissGain = gain(p.hissLevel);
  const drift = lfo(p.driftRate);
  drift.connect(gain(p.driftHz)).connect(peak.frequency);
  const breath = lfo(p.breathRate);
  breath.connect(gain(p.hissLevel * p.breathDepth)).connect(hissGain.gain);
  hiss.connect(filter("highpass", p.hissHighpassHz)).connect(peak).connect(hissGain).connect(output);

  const crackle = loop(crackleBuffer(context));
  crackle.connect(filter("highpass", p.crackleHighpassHz)).connect(gain(p.crackleLevel)).connect(output);

  const bubbles = loop(bubbleBuffer(context));
  bubbles.connect(filter("lowpass", p.bubbles.lowpassHz)).connect(gain(p.bubbles.level)).connect(output);

  const now = context.currentTime;
  // Every track starts anywhere in its loop, so two evenings never begin the same.
  hiss.start(now, Math.random() * SOUND.noiseSeconds);
  crackle.start(now, Math.random() * p.crackleSeconds);
  bubbles.start(now, Math.random() * p.bubbles.seconds);
  drift.start(now);
  breath.start(now);
  output.gain.setTargetAtTime(p.level, now, p.fadeIn / 3);

  let isStopped = false;
  return {
    stop: () => {
      if (isStopped) return;
      isStopped = true;
      const time = context.currentTime;
      output.gain.cancelScheduledValues(time);
      output.gain.setTargetAtTime(0, time, p.fadeOut / 3);
      const end = time + p.fadeOut * 2;
      [hiss, crackle, bubbles, drift, breath].forEach((source) => source.stop(end));
      hiss.onended = () => nodes.forEach((node) => node.disconnect());
    },
  };
};
