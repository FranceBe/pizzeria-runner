import { describe, it, expect } from "vitest";
import { makeCustomer, makeState, play, serviceOf, stateInService } from "../test/helpers";
import { LIGHTNING_SECONDS, TONIGHT_REWARD } from "../data/tonight";
import { ensureTonightGoal } from "./tonight";
import type { GameState, TonightGoal } from "./types";

const withGoal = (state: GameState, goal: Partial<TonightGoal>): GameState => ({
  ...state,
  tonightGoal: { day: state.day, kind: "allHot", target: 1, progress: 0, status: "open", ...goal },
});
// A pizza for the first waiting customer, on the pass for this long.
const serveFirst = (state: GameState, waitingSeconds = 0): GameState => {
  const customer = serviceOf(state).customers[0];
  const ready = { ...state, service: { ...serviceOf(state), ready: [{ id: "p1", ingredients: [...customer.ingredients], waitingSeconds }] } };
  return play(ready, { type: "servePizza", pizzaId: "p1" });
};

describe("tonight's goal", () => {
  it("is drawn each morning from the second day, one per day", () => {
    const first = makeState({ day: 1 });
    ensureTonightGoal(first);
    expect(first.tonightGoal).toBeNull();
    const next = play(makeState({ day: 1 }), { type: "startNextDay" });
    expect(next.tonightGoal).toMatchObject({ day: 2, status: "open", progress: 0 });
    const again = { ...next };
    ensureTonightGoal(again);
    expect(again.tonightGoal).toBe(next.tonightGoal);
  });

  it("pays once reached, and only once", () => {
    const state = withGoal(stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Luca" })]), { kind: "lightning", target: 1 });
    const served = serveFirst(state);
    expect(served.tonightGoal?.status).toBe("done");
    expect(served.money - state.money).toBeGreaterThanOrEqual(TONIGHT_REWARD);
    const twice = serveFirst(served);
    expect(twice.money - served.money).toBeLessThan(TONIGHT_REWARD);
  });

  it("counts only customers served quickly for the lightning goal", () => {
    const slow = withGoal(stateInService([makeCustomer({ waitedSeconds: LIGHTNING_SECONDS + 1 }), makeCustomer({ id: "c2", name: "Luca" })]), { kind: "lightning", target: 1 });
    expect(serveFirst(slow).tonightGoal).toMatchObject({ status: "open", progress: 0 });
  });

  it("is missed as soon as a pizza goes out lukewarm, for the all-hot goal", () => {
    const state = withGoal(stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Luca" })]), { kind: "allHot", target: 5 });
    expect(serveFirst(state, 0).tonightGoal).toMatchObject({ status: "open", progress: 1 });
    expect(serveFirst(state, 30).tonightGoal?.status).toBe("missed");
  });

  it("is missed once the clock passes 23:00 with customers still waiting, for the on-time goal", () => {
    const state = withGoal(play(makeState({ day: 2 }), { type: "openRestaurant" }), { kind: "onTime" });
    const late = { ...state, service: { ...serviceOf(state), elapsed: (serviceOf(state).expectedSeconds ?? 0) * 1.05 } };
    expect(play(late, { type: "tick", seconds: 0.1 }).tonightGoal?.status).toBe("missed");
  });

  it("settles at closing: held all evening is reached, closing early is missed", () => {
    const hot = withGoal(stateInService([makeCustomer()]), { kind: "allHot", target: 1 });
    expect(serveFirst(hot).tonightGoal?.status).toBe("done");
    expect(serveFirst(hot).summary?.tonightGoal?.status).toBe("done");
    // Its bonus counts in the day's profit, as everything the till took in.
    const summary = serveFirst(hot).summary;
    expect(summary?.bonuses).toBe(TONIGHT_REWARD);
    expect(summary?.net).toBeCloseTo((summary?.revenue ?? 0) + (summary?.tips ?? 0) + TONIGHT_REWARD - (summary?.charges ?? 0) - (summary?.purchases ?? 0));
    const early = withGoal(stateInService([makeCustomer()]), { kind: "onTime" });
    expect(play(early, { type: "closeEarly" }).tonightGoal?.status).toBe("missed");
  });

  it("stays out of challenges", () => {
    const state = withGoal(play(makeState({ day: 2, settings: { ...makeState().settings, tutorialDone: true } }), { type: "startChallenge", date: "2026-10-23" }), { kind: "onTime" });
    const late = { ...state, service: { ...serviceOf(state), elapsed: 99_999 } };
    expect(play(late, { type: "tick", seconds: 1 }).tonightGoal?.status).toBe("open");
  });
});
