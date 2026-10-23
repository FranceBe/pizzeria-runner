import { describe, it, expect } from "vitest";
import { CUE_EFFECTS } from "./cues";
import { EFFECT_IDS, createSizzle, drawEffect, effectSeconds, noiseBuffer } from "./synth";

// A stand-in for an audio context: records every node, what it connects to, and when sources start and stop.
class FakeParam {
  value = 0;
  setValueAtTime(value: number) { this.value = value; return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
class FakeNode {
  outputs: unknown[] = [];
  isDisconnected = false;
  connect<T>(target: T): T { this.outputs.push(target); return target; }
  disconnect() { this.isDisconnected = true; }
}
class FakeSource extends FakeNode {
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  buffer: unknown = null;
  loop = false;
  type = "";
  frequency = new FakeParam();
  detune = new FakeParam();
  start(when = 0) { this.startedAt = when; }
  stop(when = 0) { this.stoppedAt = when; }
}
class FakeContext {
  sampleRate = 8000;
  currentTime = 0;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  nodes: FakeNode[] = [];
  buffers = 0;
  private add<T extends FakeNode>(node: T): T { this.nodes.push(node); if (node instanceof FakeSource) this.sources.push(node); return node; }
  createOscillator() { return this.add(new FakeSource()); }
  createBufferSource() { return this.add(new FakeSource()); }
  createGain() { return this.add(Object.assign(new FakeNode(), { gain: new FakeParam() })); }
  createBiquadFilter() { return this.add(Object.assign(new FakeNode(), { type: "", frequency: new FakeParam(), Q: new FakeParam() })); }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    this.buffers += 1;
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
}
const fake = () => new FakeContext();
const asContext = (context: FakeContext) => context as unknown as AudioContext;

// Follows a node's outputs: does the sound reach the destination?
const reaches = (node: unknown, destination: FakeNode, seen = new Set<unknown>()): boolean => {
  if (node === destination) return true;
  if (!(node instanceof FakeNode) || seen.has(node)) return false;
  seen.add(node);
  return node.outputs.some((output) => reaches(output, destination, seen));
};

describe("synthesised effects", () => {
  it("every cue asks for an effect that exists", () => {
    CUE_EFFECTS.forEach((id) => expect(EFFECT_IDS).toContain(id));
    EFFECT_IDS.forEach((id) => expect(effectSeconds(id)).toBeGreaterThan(0));
  });

  it.each(EFFECT_IDS)("%s goes to the effects' output, is over within its rendered length, and lets go of its nodes", (id) => {
    const context = fake();
    const destination = new FakeNode();
    drawEffect(asContext(context), destination as unknown as AudioNode, id, 1);
    expect(context.sources.length).toBeGreaterThan(0);
    context.sources.forEach((source) => {
      expect(reaches(source, destination)).toBe(true);
      expect(source.startedAt).toBeGreaterThanOrEqual(1);
      expect(source.stoppedAt).not.toBeNull();
      expect(source.stoppedAt as number).toBeLessThanOrEqual(1 + effectSeconds(id));
      expect(source.onended).toBeTypeOf("function");
    });
    // Once over, every node is disconnected.
    context.sources.forEach((source) => source.onended?.());
    expect(context.nodes.every((node) => node.isDisconnected)).toBe(true);
  });

  it("the bell is short and the fanfares grow", () => {
    expect(effectSeconds("newOrder")).toBeLessThan(1.2);
    expect(effectSeconds("fanfareSmall")).toBeLessThan(effectSeconds("fanfareMedium"));
    expect(effectSeconds("fanfareMedium")).toBeLessThan(effectSeconds("fanfareBig"));
  });

  it("make their white noise once per context, and reuse it", () => {
    const context = fake();
    const first = noiseBuffer(asContext(context));
    drawEffect(asContext(context), context.destination as unknown as AudioNode, "payment", 0);
    drawEffect(asContext(context), context.destination as unknown as AudioNode, "payment", 1);
    expect(noiseBuffer(asContext(context))).toBe(first);
    expect(context.buffers).toBe(1);
  });
});

describe("the oven's sizzle", () => {
  it("is hiss, crackle and bubbles looped together, then stops and lets go of everything", () => {
    const context = fake();
    const sizzle = createSizzle(asContext(context), context.destination as unknown as AudioNode);
    const loops = context.sources.filter((source) => source.loop);
    expect(loops).toHaveLength(3);
    loops.forEach((loop) => expect(reaches(loop, context.destination)).toBe(true));
    // Its tracks are drawn once: a second sizzle on the same context draws nothing new.
    const buffers = context.buffers;
    createSizzle(asContext(context), context.destination as unknown as AudioNode).stop();
    expect(context.buffers).toBe(buffers);
    sizzle.stop();
    context.sources.forEach((source) => expect(source.stoppedAt).not.toBeNull());
    context.sources.forEach((source) => source.onended?.());
    expect(context.nodes.every((node) => node.isDisconnected)).toBe(true);
  });
});
