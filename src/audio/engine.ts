// Sound, with the Web Audio API: the music loops without the gap <audio loop> leaves, and fades happen live (the
// sizzle stops when the oven empties, the music softens on pause). The effects are synthesised (synth.ts): the
// one-shot ones are rendered once into buffers in the background, and played live until theirs is ready.
// Browsers keep the AudioContext suspended until the player touches the page: unlock() is called on the first input.
import musicOgg from "../assets/sounds/music.ogg";
import musicM4a from "../assets/sounds/music.m4a";
import { EFFECT_IDS, createSizzle, drawEffect, effectSeconds, type EffectId, type Sizzle } from "./synth";

export type { EffectId } from "./synth";

// Safari on older iPhones can't decode Ogg Vorbis: it gets the AAC copy.
const canPlayOgg = (): boolean =>
  typeof Audio === "function" && new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";

// The music's own length: an AAC copy can carry a little padding, which must not end up in the loop.
const MUSIC_SECONDS = 141.816;
// Fades, in seconds (time constants of an exponential approach).
const QUICK_FADE = 0.08;
const SOFT_FADE = 0.4;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

interface Loop {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  // The one-shot effects, rendered ahead; an effect without one yet is played live.
  private effects = new Map<EffectId, AudioBuffer>();
  private isRendering = false;
  private music: Loop | null = null;
  private sizzle: Sizzle | null = null;
  private wantsSizzle = false;
  private wantsMusic = false;
  private musicLevel = 0;
  private effectsLevel = 0;
  private hasRun = false;

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    // Older iPhones only have the prefixed constructor.
    const Context = typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as WebkitWindow).webkitAudioContext);
    if (!Context) return null;
    // iPhone: play like a music app, so the side silent switch doesn't mute the game (iOS 17+).
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session) session.type = "playback";
    const context = new Context();
    this.musicBus = context.createGain();
    this.effectsBus = context.createGain();
    this.musicBus.gain.value = this.musicLevel;
    this.effectsBus.gain.value = this.effectsLevel;
    this.musicBus.connect(context.destination);
    this.effectsBus.connect(context.destination);
    this.context = context;
    return context;
  }

  // On every tap, click or key press until sound runs (and again after iOS interrupts it, back from another app).
  // Resuming takes a moment: loops start once sound actually runs.
  unlock(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "running") {
      if (!this.hasRun) this.onRunning();
      return;
    }
    // iPhone: a sound started inside the touch itself is what really unlocks audio there.
    const silence = context.createBufferSource();
    silence.buffer = context.createBuffer(1, 1, 22050);
    silence.connect(context.destination);
    silence.start(0);
    void context.resume().then(() => this.onRunning(), () => undefined);
  }


  private onRunning(): void {
    this.hasRun = true;
    void this.refreshMusic();
    this.refreshSizzle();
    this.renderEffects();
  }

  // When the page is hidden (another tab, the phone locked), sound stops; it comes back with the page.
  setPageVisible(isVisible: boolean): void {
    if (!this.context) return;
    // iOS may refuse to resume without a touch: then the next tap does it (see unlock).
    if (isVisible) this.context.resume().catch(() => undefined);
    else this.context.suspend().catch(() => undefined);
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const context = this.ensureContext();
    const loading = context
      ? fetch(url)
          .then((response) => response.arrayBuffer())
          // The callback form also works on older iPhones, whose decodeAudioData returns no promise.
          .then((data) => new Promise<AudioBuffer>((resolve, reject) => void context.decodeAudioData(data, resolve, reject)))
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
    loop.source.onended = () => {
      loop.source.disconnect();
      loop.gain.disconnect();
    };
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
      // A browser can claim to play Ogg and still fail to decode it: then the AAC copy.
      const buffer = (canPlayOgg() ? await this.load(musicOgg) : null) ?? (await this.load(musicM4a));
      // The player may have turned it off while it was loading.
      if (buffer && this.wantsMusic && !this.music && this.musicBus) this.music = this.startLoop(buffer, this.musicBus, 1, MUSIC_SECONDS);
    } else if (!this.wantsMusic && this.music) {
      this.stopLoop(this.music, SOFT_FADE);
      this.music = null;
    }
  }

  // The oven's sizzle, one loop for every oven: on from the first pizza in until the last one comes out, then faded out.
  setSizzle(isOn: boolean): void {
    this.wantsSizzle = isOn;
    this.refreshSizzle();
  }

  private refreshSizzle(): void {
    const context = this.context;
    if (!context || context.state !== "running" || !this.effectsBus) return;
    if (this.wantsSizzle && !this.sizzle) this.sizzle = createSizzle(context, this.effectsBus);
    if (!this.wantsSizzle && this.sizzle) {
      this.sizzle.stop();
      this.sizzle = null;
    }
  }

  // A one-shot effect: its rendered buffer if ready, else drawn live (same sound). `live` always draws it live (the
  // dev sound lab, to hear a change at once).
  play(id: EffectId, { live = false }: { live?: boolean } = {}): void {
    const context = this.context;
    const bus = this.effectsBus;
    if (!context || context.state !== "running" || !bus || this.effectsLevel === 0) return;
    const buffer = live ? undefined : this.effects.get(id);
    if (!buffer) {
      drawEffect(context, bus, id, context.currentTime + 0.01);
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(bus);
    source.onended = () => source.disconnect();
    source.start();
  }

  // Forgets the rendered effects and renders them again (the dev sound lab, after a change in synth.ts).
  rerenderEffects(): void {
    this.effects.clear();
    this.isRendering = false;
    this.renderEffects();
  }

  // Renders the one-shot effects into buffers, one after the other while the browser is idle, never in the way of
  // the first screen. Once, after sound first runs.
  private renderEffects(): void {
    const context = this.context;
    const Offline = typeof window === "undefined" ? undefined : (window.OfflineAudioContext ?? (window as WebkitWindow).webkitOfflineAudioContext);
    if (!context || !Offline || this.isRendering) return;
    this.isRendering = true;
    const pending = EFFECT_IDS.filter((id) => !this.effects.has(id));
    // Safari has no requestIdleCallback: a short timeout instead.
    const whenIdle = (next: () => void) => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(next, { timeout: 2000 });
      else window.setTimeout(next, 50);
    };
    const renderNext = () => {
      const id = pending.shift();
      if (!id) return;
      const rate = context.sampleRate;
      const offline = new Offline(1, Math.ceil(effectSeconds(id) * rate), rate);
      drawEffect(offline, offline.destination, id, 0);
      // Older Safari renders through an event rather than a promise.
      new Promise<AudioBuffer>((resolve, reject) => {
        offline.oncomplete = (event) => resolve(event.renderedBuffer);
        offline.startRendering()?.then(resolve, reject);
      })
        .then((buffer) => this.effects.set(id, buffer))
        .catch(() => undefined)
        .finally(() => whenIdle(renderNext));
    };
    whenIdle(renderNext);
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
}

export const audio = new AudioEngine();

// Dev only: the engine at hand in the browser console (window.fornoAudio), to try sounds while tweaking synth.ts.
if (import.meta.env.DEV && typeof window !== "undefined") (window as Window & { fornoAudio?: AudioEngine }).fornoAudio = audio;
