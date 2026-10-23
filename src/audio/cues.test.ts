import { describe, it, expect } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { cuesBetween, effectsLevel, isSizzling, musicLevel, snapshotOf } from "./cues";

describe("sound cues", () => {
  it("ring for a new customer and for a payment", () => {
    const before = stateInService([makeCustomer()]);
    const arrived = { ...before, service: { ...serviceOf(before), customers: [...serviceOf(before).customers, makeCustomer({ id: "c2", name: "Zoé" })] } };
    expect(cuesBetween(snapshotOf(before), snapshotOf(arrived))).toEqual({ newOrder: true, payment: false, fanfare: null });
    const paid = { ...before, service: { ...serviceOf(before), stats: { ...serviceOf(before).stats, served: 1 } } };
    expect(cuesBetween(snapshotOf(before), snapshotOf(paid))).toEqual({ newOrder: false, payment: true, fanfare: null });
    expect(cuesBetween(snapshotOf(before), snapshotOf(before))).toEqual({ newOrder: false, payment: false, fanfare: null });
  });

  it("ring when the group order comes in and when it is paid", () => {
    const state = stateInService([]);
    const withBatch = { ...state, service: { ...serviceOf(state), batch: { elapsed: 0 } } };
    expect(cuesBetween(snapshotOf(state), snapshotOf(withBatch)).newOrder).toBe(true);
    const delivered = { ...state, service: { ...serviceOf(state), stats: { ...serviceOf(state).stats, questRewards: 20 } } };
    expect(cuesBetween(snapshotOf(state), snapshotOf(delivered)).payment).toBe(true);
  });

  it("celebrate wins with a fanfare: small for a quest, a mission or tonight's goal, medium for a level or an achievement, big for a best score", () => {
    const state = stateInService([makeCustomer()], { xp: 0 });
    const fanfare = (after: typeof state) => cuesBetween(snapshotOf(state), snapshotOf(after)).fanfare;
    expect(fanfare({ ...state, lifetime: { ...state.lifetime, questsDone: state.lifetime.questsDone + 1 } })).toBe("fanfareSmall");
    expect(fanfare({ ...state, tonightGoal: { day: state.day, kind: "allHot", target: 5, progress: 5, status: "done" } })).toBe("fanfareSmall");
    expect(fanfare({ ...state, weekly: { week: 0, bonusPaid: false, missions: [{ kind: "served", target: 1, progress: 1, done: true }] } })).toBe("fanfareSmall");
    expect(fanfare({ ...state, xp: 100_000 })).toBe("fanfareMedium");
    expect(fanfare({ ...state, achievements: { ...state.achievements, firstPizza: 1 } })).toBe("fanfareMedium");
    expect(fanfare({ ...state, challengeResult: { date: "2026-10-23", score: 99, served: 5, happy: 3, isNewBest: true } })).toBe("fanfareBig");
    // Only the biggest plays.
    expect(fanfare({ ...state, xp: 100_000, lifetime: { ...state.lifetime, questsDone: 9 } })).toBe("fanfareMedium");
    // A friends' match's best isn't the daily challenge's (its podium plays the fanfare), and a new morning, or another
    // save loaded, celebrates nothing.
    expect(fanfare({ ...state, challengeResult: { date: "x", score: 99, served: 5, happy: 3, isNewBest: true, multiplayer: true } })).toBeNull();
    expect(fanfare({ ...state, day: state.day + 1, xp: 100_000 })).toBeNull();
  });

  it("sizzle until the last pizza is out, at one level however many bake", () => {
    const state = stateInService([makeCustomer()]);
    const baking = (id: string, bakedSeconds: number) => ({ id, ingredients: [...MARGHERITA], bakedSeconds, bakeDuration: 6 });
    const two = { ...state, service: { ...serviceOf(state), oven: [baking("a", 5), baking("b", 0)] } };
    // The first one out, the second still in: the oven keeps sizzling.
    expect(isSizzling(play(two, { type: "tick", seconds: 2 }))).toBe(true);
    expect(isSizzling(play(two, { type: "tick", seconds: 7 }))).toBe(false);
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
