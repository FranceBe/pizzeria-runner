import { describe, it, expect } from "vitest";
import { makeState, play, serviceOf } from "../test/helpers";
import { createChallenge, createChallengeCustomer, localDate } from "./challenge";
import type { GameState } from "./types";

const DATE = "2026-10-17";
const ready = (): GameState => makeState({ settings: { ...makeState().settings, tutorialDone: true } });

// Lets the first customers in and returns what they ordered.
const firstOrders = (state: GameState): string[] => {
  const after = play(state, { type: "tick", seconds: 1 }, { type: "tick", seconds: 5 }, { type: "tick", seconds: 5 });
  return serviceOf(after).customers.map((customer) => `${customer.name}:${customer.recipeId}`);
};

describe("daily challenge", () => {
  it("has the same menu and the same customers for everyone on a date", () => {
    expect(createChallenge(DATE)).toEqual(createChallenge(DATE));
    const a = play(ready(), { type: "startChallenge", date: DATE });
    const b = play(makeState({ money: 999, xp: 3000, settings: { ...ready().settings } }), { type: "startChallenge", date: DATE });
    expect(firstOrders(a)).toEqual(firstOrders(b));
  });

  it("changes from one day to the next", () => {
    const sequence = (date: string) => {
      const challenge = createChallenge(date);
      return [challenge.menu.join(), ...Array.from({ length: 5 }, () => createChallengeCustomer(challenge, new Set()).name)].join();
    };
    expect(sequence(DATE)).not.toBe(sequence("2026-10-18"));
  });

  it("only uses savoury classics, whatever the player has unlocked", () => {
    const { menu } = createChallenge(DATE);
    expect(menu).toHaveLength(4);
    expect(menu).not.toContain("chocobanane");
    expect(menu).not.toContain("nonna");
  });

  it("keeps the best score of the day", () => {
    const state = makeState({ dailyChallenge: { date: DATE, best: 50 } });
    const result = play(play({ ...state, settings: { ...state.settings, tutorialDone: true } }, { type: "startChallenge", date: DATE }), {
      type: "tick",
      seconds: 200,
    });
    expect(result.challengeResult?.isNewBest).toBe(false);
    expect(result.dailyChallenge).toEqual({ date: DATE, best: 50 });
  });

  it("formats today's date in the local time zone", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
