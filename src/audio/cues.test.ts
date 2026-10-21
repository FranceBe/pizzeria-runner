import { describe, it, expect } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { cuesBetween, effectsLevel, isSizzling, musicLevel, snapshotOf } from "./cues";

describe("sound cues", () => {
  it("ring for a new customer and for a payment", () => {
    const before = stateInService([makeCustomer()]);
    const arrived = { ...before, service: { ...serviceOf(before), customers: [...serviceOf(before).customers, makeCustomer({ id: "c2", name: "Zoé" })] } };
    expect(cuesBetween(snapshotOf(before), snapshotOf(arrived))).toEqual({ newOrder: true, payment: false });
    const paid = { ...before, service: { ...serviceOf(before), stats: { ...serviceOf(before).stats, served: 1 } } };
    expect(cuesBetween(snapshotOf(before), snapshotOf(paid))).toEqual({ newOrder: false, payment: true });
    expect(cuesBetween(snapshotOf(before), snapshotOf(before))).toEqual({ newOrder: false, payment: false });
  });

  it("ring when the group order comes in and when it is paid", () => {
    const state = stateInService([]);
    const withBatch = { ...state, service: { ...serviceOf(state), batch: { elapsed: 0 } } };
    expect(cuesBetween(snapshotOf(state), snapshotOf(withBatch)).newOrder).toBe(true);
    const delivered = { ...state, service: { ...serviceOf(state), stats: { ...serviceOf(state).stats, questRewards: 20 } } };
    expect(cuesBetween(snapshotOf(state), snapshotOf(delivered)).payment).toBe(true);
  });

  it("sizzle while something bakes, but not during a pause", () => {
    const baking = play(stateInService([makeCustomer()]), ...toggle(...MARGHERITA), { type: "bake" });
    expect(isSizzling(baking)).toBe(true);
    expect(isSizzling(play(baking, { type: "togglePause" }))).toBe(false);
    expect(isSizzling(play(baking, { type: "tick", seconds: 10 }))).toBe(false);
  });

  it("soften the music on pause and follow the settings", () => {
    const state = makeState();
    // A new game starts quiet: it may open from a shared link.
    expect(musicLevel(state)).toBe(0.08);
    expect(effectsLevel(state)).toBe(0.2);
    const paused = play(play(state, { type: "openRestaurant" }), { type: "togglePause" });
    expect(musicLevel(paused)).toBeCloseTo(0.08 * 0.3);
    expect(musicLevel(play(state, { type: "toggleMute", channel: "music" }))).toBe(0);
    expect(effectsLevel(play(state, { type: "setVolume", channel: "effects", volume: 0.4 }))).toBe(0.4);
  });

  it("keep volumes between 0 and 1, and unmute when the slider moves", () => {
    const muted = play(makeState(), { type: "toggleMute", channel: "music" });
    const moved = play(muted, { type: "setVolume", channel: "music", volume: 7 });
    expect(moved.settings).toMatchObject({ musicVolume: 1, musicMuted: false });
    expect(play(makeState(), { type: "setVolume", channel: "effects", volume: Number.NaN }).settings.effectsVolume).toBe(0);
  });
});
