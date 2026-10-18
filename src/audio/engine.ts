// Sound, with the Web Audio API: loops (music, the oven's sizzle) loop without the gap <audio loop> leaves,
// and fades happen live (the sizzle stops when the oven empties, the music softens on pause).
// Browsers keep the AudioContext suspended until the player touches the page: unlock() is called on the first input.
import musicOgg from "../assets/sounds/music.ogg";
import musicM4a from "../assets/sounds/music.m4a";
import newOrderWav from "../assets/sounds/new-order.wav";
import paymentWav from "../assets/sounds/payment.wav";
import sizzleWav from "../assets/sounds/sizzle-loop.wav";

export type EffectId = "newOrder" | "payment";

// Safari on older iPhones can't decode Ogg Vorbis: it gets the AAC copy.
const canPlayOgg = (): boolean =>
  typeof Audio === "function" && new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";

const EFFECT_URLS: Record<EffectId, string> = { newOrder: newOrderWav, payment: paymentWav };

// The music's own length: an AAC copy can carry a little padding, which must not end up in the loop.
const MUSIC_SECONDS = 141.816;
// The sizzle sits under the music, a little quieter than the other effects.
const SIZZLE_LEVEL = 0.45;
// Fades, in seconds (time constants of an exponential approach).
const QUICK_FADE = 0.08;
const SOFT_FADE = 0.4;

interface Loop {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private music: Loop | null = null;
  private sizzle: Loop | null = null;
  private wantsMusic = false;
  private wantsSizzle = false;
  private musicLevel = 0;
  private effectsLevel = 0;

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
    const context = new window.AudioContext();
    this.musicBus = context.createGain();
    this.effectsBus = context.createGain();
    this.musicBus.gain.value = this.musicLevel;
    this.effectsBus.gain.value = this.effectsLevel;
    this.musicBus.connect(context.destination);
    this.effectsBus.connect(context.destination);
    this.context = context;
    return context;
  }

  // On the first click, tap or key press. Resuming takes a moment: loops start once sound actually runs.
  unlock(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "running") this.onRunning();
    else void context.resume().then(() => this.onRunning());
  }

  private onRunning(): void {
    void this.refreshMusic();
    if (this.wantsSizzle && !this.sizzle) {
      this.wantsSizzle = false;
      this.setSizzle(true);
    }
    this.preloadEffects();
  }

  // When the page is hidden (another tab, the phone locked), sound stops; it comes back with the page.
  setPageVisible(isVisible: boolean): void {
    if (!this.context) return;
    if (isVisible) void this.context.resume();
    else void this.context.suspend();
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const context = this.ensureContext();
    const loading = context
      ? fetch(url)
          .then((response) => response.arrayBuffer())
          .then((data) => context.decodeAudioData(data))
          .catch(() => null)
      : Promise.resolve(null);
    this.buffers.set(url, loading);
    return loading;
  }

  private startLoop(buffer: AudioBuffer, bus: GainNode, level: number, loopSeconds?: number): Loop | null {
    const context = this.context;
    if (!context) return null;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    if (loopSeconds && buffer.duration > loopSeconds) source.loopEnd = loopSeconds;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(level, context.currentTime, SOFT_FADE / 4);
    source.connect(gain).connect(bus);
    source.start();
    return { source, gain };
  }

  private stopLoop(loop: Loop, fade: number): void {
    const context = this.context;
    if (!context) return;
    loop.gain.gain.cancelScheduledValues(context.currentTime);
    loop.gain.gain.setTargetAtTime(0, context.currentTime, fade);
    loop.source.stop(context.currentTime + fade * 6);
  }

  // Music on or off, faded both ways. Keeps playing across screens; starts once the page is unlocked.
  setMusic(isOn: boolean): void {
    this.wantsMusic = isOn;
    void this.refreshMusic();
  }

  private async refreshMusic(): Promise<void> {
    if (!this.context || this.context.state !== "running") return;
    if (this.wantsMusic && !this.music) {
      const buffer = await this.load(canPlayOgg() ? musicOgg : musicM4a);
      // The player may have turned it off while it was loading.
      if (buffer && this.wantsMusic && !this.music && this.musicBus) this.music = this.startLoop(buffer, this.musicBus, 1, MUSIC_SECONDS);
    } else if (!this.wantsMusic && this.music) {
      this.stopLoop(this.music, SOFT_FADE);
      this.music = null;
    }
  }

  // The oven's sizzle while something bakes; it fades out quickly when the last pizza comes out.
  setSizzle(isOn: boolean): void {
    if (isOn === this.wantsSizzle) return;
    this.wantsSizzle = isOn;
    if (!this.context || this.context.state !== "running" || !this.effectsBus) return;
    if (!isOn && this.sizzle) {
      this.stopLoop(this.sizzle, QUICK_FADE);
      this.sizzle = null;
      return;
    }
    void this.load(sizzleWav).then((buffer) => {
      if (buffer && this.wantsSizzle && !this.sizzle && this.effectsBus) this.sizzle = this.startLoop(buffer, this.effectsBus, SIZZLE_LEVEL);
    });
  }

  // A one-shot effect: the fade is already in the file.
  play(id: EffectId): void {
    if (!this.context || this.context.state !== "running" || !this.effectsBus || this.effectsLevel === 0) return;
    const bus = this.effectsBus;
    void this.load(EFFECT_URLS[id]).then((buffer) => {
      if (!buffer || !this.context) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(bus);
      source.start();
    });
  }

  // Volumes from 0 to 1, reached smoothly: no click when a slider moves or the game pauses.
  setLevels(music: number, effects: number): void {
    this.musicLevel = music;
    this.effectsLevel = effects;
    const context = this.context;
    if (!context || !this.musicBus || !this.effectsBus) return;
    this.musicBus.gain.setTargetAtTime(music, context.currentTime, QUICK_FADE);
    this.effectsBus.gain.setTargetAtTime(effects, context.currentTime, QUICK_FADE);
  }

  // Loads the short sounds ahead, so the first order and payment play on time.
  preloadEffects(): void {
    if (!this.context) return;
    [...Object.values(EFFECT_URLS), sizzleWav].forEach((url) => void this.load(url));
  }
}

export const audio = new AudioEngine();
