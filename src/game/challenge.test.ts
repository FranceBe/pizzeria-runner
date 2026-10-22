import { describe, it, expect } from "vitest";
import { makeState, play, serviceOf } from "../test/helpers";
import { CHALLENGE_ARRIVALS, ROYALE_FASTEST_PACE, createChallenge, createChallengeCustomer, localDate, nextChallengeArrival } from "./challenge";
import { challengePoints } from "./serving";
import { CLASSIC_RECIPES } from "../data/recipes";
import {
  MAX_POINTS_PER_PIZZA, MIN_ARRIVAL_SECONDS, ROYALE_MIN_ARRIVAL_SECONDS, isPlausibleScore, maxServedAfter,
} from "../multiplayer/protocol";
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

describe("a match against friends", () => {
  const SEED = "room-seed-1234";
  const finished = (state: GameState) => play(state, ...Array.from({ length: 125 }, () => ({ type: "tick", seconds: 1 }) as const));

  it("gives every player the same customers from the room's seed, even on their very first game", () => {
    const newcomer = makeState();
    expect(newcomer.settings.tutorialDone).toBe(false);
    const a = play(newcomer, { type: "startChallenge", date: SEED, multiplayer: true });
    const b = play(makeState({ money: 999, xp: 3000, settings: { ...ready().settings } }), { type: "startChallenge", date: SEED, multiplayer: true });
    expect(a.phase).toBe("service");
    expect(serviceOf(a).challenge?.multiplayer).toBe(true);
    expect(firstOrders(a)).toEqual(firstOrders(b));
    // The daily challenge still waits for the tutorial.
    expect(play(makeState(), { type: "startChallenge", date: DATE }).phase).toBe("prep");
  });

  it("has no pause: everyone shares the clock", () => {
    const state = play(ready(), { type: "startChallenge", date: SEED, multiplayer: true }, { type: "togglePause" });
    expect(serviceOf(state).paused).toBeFalsy();
  });

  it("ends like the daily challenge, without counting as one", () => {
    const before = ready();
    const state = finished(play(before, { type: "startChallenge", date: SEED, multiplayer: true }));
    expect(state.phase).toBe("prep");
    expect(state.challengeResult).toMatchObject({ multiplayer: true, date: SEED, isNewBest: false });
    expect(state.dailyChallenge).toEqual(before.dailyChallenge);
    expect(state.bestChallengeScore).toBe(before.bestChallengeScore);
    expect(state.lifetime.dailyChallenges).toBe(before.lifetime.dailyChallenges);
  });
});

describe("Pizza Royale", () => {
  const SEED = "royale-seed";
  const royale = (): GameState => play(ready(), { type: "startChallenge", date: SEED, multiplayer: true, seconds: 300, royale: true }, { type: "tick", seconds: 1 });
  // The service with what is on the board, in the oven and on the pass set by hand.
  const withKitchen = (state: GameState, kitchen: Partial<GameState["service"] & object>): GameState => ({
    ...state,
    service: { ...serviceOf(state), ...kitchen },
  });

  it("is only ever a match against friends, five minutes at most", () => {
    const state = royale();
    expect(serviceOf(state).challenge).toMatchObject({ royale: true, multiplayer: true });
    expect(serviceOf(state).challenge?.secondsLeft).toBeCloseTo(299);
    expect(serviceOf(play(ready(), { type: "startChallenge", date: DATE, royale: true })).challenge?.royale).toBeUndefined();
  });

  it("puts out a player who bakes a pizza nobody is waiting for, counting those already baking", () => {
    const state = royale();
    const order = serviceOf(state).customers[0].ingredients;
    const wanting = serviceOf(state).customers.filter((customer) => customer.ingredients.join() === order.join()).length;
    // The pizza someone ordered: fine, as many times as people ordered it.
    const baked = play(withKitchen(state, { board: [...order] }), { type: "bake" });
    expect(baked.phase).toBe("service");
    const oneTooMany = withKitchen(baked, {
      board: [...order],
      oven: [],
      // Enough of it baked already, on the pass.
      ready: Array.from({ length: wanting }, (_, index) => ({ id: `r${index}`, ingredients: [...order] })),
    });
    const out = play(oneTooMany, { type: "bake" });
    expect(out.phase).toBe("prep");
    expect(out.challengeResult).toMatchObject({ royale: true, out: "unwantedPizza" });
    // A pizza of nothing anyone ordered.
    expect(play(withKitchen(state, { board: ["pate"] }), { type: "bake" }).challengeResult?.out).toBe("unwantedPizza");
  });

  it("puts out a player who throws anything away", () => {
    const state = royale();
    expect(play(withKitchen(state, { board: ["pate"] }), { type: "trashBoard" }).challengeResult?.out).toBe("waste");
    expect(play(withKitchen(state, { board: [] }), { type: "trashBoard" }).phase).toBe("service");
    const onThePass = withKitchen(state, { ready: [{ id: "r1", ingredients: ["pate"] }] });
    expect(play(onThePass, { type: "trashReadyPizza", pizzaId: "r1" }).challengeResult?.out).toBe("waste");
    expect(play(onThePass, { type: "trashUnwantedPizzas" }).challengeResult?.out).toBe("waste");
  });

  it("forgives nothing in an ordinary challenge", () => {
    const state = play(ready(), { type: "startChallenge", date: SEED, multiplayer: true }, { type: "tick", seconds: 1 });
    expect(play(withKitchen(state, { board: ["pate"] }), { type: "trashBoard" }).phase).toBe("service");
    expect(play(withKitchen(state, { board: ["pate"] }), { type: "bake" }).phase).toBe("service");
  });

  it("brings customers in faster and faster", () => {
    const at = (secondsLeft: number) => nextChallengeArrival({ ...createChallenge(SEED, true, 300, true), secondsLeft });
    expect(at(0)).toBeCloseTo(at(300) * ROYALE_FASTEST_PACE);
    expect(nextChallengeArrival(createChallenge(SEED, true, 300))).toBeCloseTo(at(300));
  });

  it("stops for the last one standing when the room says it is over", () => {
    const state = play(royale(), { type: "endMatch" });
    expect(state.phase).toBe("prep");
    expect(state.challengeResult).toMatchObject({ royale: true, multiplayer: true });
    expect(state.challengeResult?.out).toBeUndefined();
  });
});

describe("what the multiplayer server accepts as a score", () => {
  it("knows the most a pizza is worth and how quickly customers can come", () => {
    const best = Math.max(...CLASSIC_RECIPES.map((recipe) => challengePoints(recipe.ingredients, 0)));
    expect(MAX_POINTS_PER_PIZZA).toBeGreaterThanOrEqual(best);
    expect(MIN_ARRIVAL_SECONDS).toBe(CHALLENGE_ARRIVALS.min);
    expect(ROYALE_MIN_ARRIVAL_SECONDS).toBeCloseTo(CHALLENGE_ARRIVALS.min * ROYALE_FASTEST_PACE);
  });

  it("lets an honest player's best possible match through", () => {
    // A customer the moment one can come, each served at once, each worth the most.
    const seconds = 120;
    const served = maxServedAfter(seconds - 3, "challenge");
    expect(isPlausibleScore({ score: served * MAX_POINTS_PER_PIZZA, served }, { score: 0, served: 0 }, seconds, "challenge")).toBe(true);
    expect(isPlausibleScore({ score: 0, served: served + 2 }, { score: 0, served: 0 }, seconds, "challenge")).toBe(false);
    expect(isPlausibleScore({ score: 41, served: 1 }, { score: 0, served: 0 }, seconds, "challenge")).toBe(false);
    expect(isPlausibleScore({ score: 10, served: 1 }, { score: 20, served: 1 }, seconds, "challenge")).toBe(false);
  });
});
