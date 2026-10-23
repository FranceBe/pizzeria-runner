import { describe, it, expect } from "vitest";
import { makeState, play, serviceOf } from "../test/helpers";
import { HALFTIME_SECONDS, MATCH_FIRST_HALF_PACE, MATCH_HALFTIME, MATCH_KICKOFF } from "../data/events";
import { EVENING_MINUTES, OPENING_MINUTES } from "./clock";
import { arrivalPace } from "./evening";
import type { GameState } from "./types";

// The service at this time on the evening's clock.
const at = (state: GameState, minutes: number): GameState => {
  const service = serviceOf(state);
  const elapsed = ((minutes - OPENING_MINUTES) / EVENING_MINUTES) * (service.expectedSeconds ?? 1);
  return { ...state, service: { ...service, elapsed } };
};
const matchNight = (): GameState => play(makeState({ day: 8, xp: 5000, event: "match" }), { type: "openRestaurant" });
const toastKeys = (state: GameState) => state.toasts.map((toast) => toast.key);

describe("the match on TV", () => {
  it("has its own rush at half-time instead of the evening's", () => {
    expect(serviceOf(matchNight()).rushAtServed).toBeNull();
  });

  it("quietens the street at kick-off", () => {
    const before = play(at(matchNight(), MATCH_KICKOFF - 5), { type: "tick", seconds: 0.1 });
    expect(arrivalPace(before, serviceOf(before))).toBe(1);
    const kickedOff = play(at(before, MATCH_KICKOFF + 1), { type: "tick", seconds: 0.1 });
    expect(serviceOf(kickedOff).matchKickedOff).toBe(true);
    expect(toastKeys(kickedOff)).toContain("kickoff");
    expect(arrivalPace(kickedOff, serviceOf(kickedOff))).toBe(MATCH_FIRST_HALF_PACE);
  });

  it("brings everyone in at half-time, once", () => {
    const halftime = play(at(play(at(matchNight(), MATCH_KICKOFF + 1), { type: "tick", seconds: 0.1 }), MATCH_HALFTIME + 1), { type: "tick", seconds: 0.1 });
    const service = serviceOf(halftime);
    expect(service.halftimeCame).toBe(true);
    expect(service.rush?.secondsLeft).toBeCloseTo(HALFTIME_SECONDS, 0);
    expect(toastKeys(halftime)).toContain("halftime");
    expect(arrivalPace(halftime, service)).toBe(1);
  });

  it("changes nothing on other evenings", () => {
    const ordinary = play(at(play(makeState({ day: 8 }), { type: "openRestaurant" }), MATCH_HALFTIME + 1), { type: "tick", seconds: 0.1 });
    expect(serviceOf(ordinary).halftimeCame).toBeUndefined();
  });
});

describe("last orders", () => {
  it("are said once, when the evening's last customer comes in", () => {
    const opened = play(makeState(), { type: "openRestaurant" });
    const lastOne = { ...opened, service: { ...serviceOf(opened), customersToCome: 1, customers: [], nextArrivalIn: 0 } };
    const after = play(lastOne, { type: "tick", seconds: 0.1 });
    expect(toastKeys(after)).toContain("lastOrders");
    const later = play(after, { type: "tick", seconds: 0.1 });
    expect(toastKeys(later).filter((key) => key === "lastOrders")).toHaveLength(1);
  });
});
