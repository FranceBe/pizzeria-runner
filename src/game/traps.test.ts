import { describe, it, expect } from "vitest";
import { makeState, play, serviceOf } from "../test/helpers";
import { TRAP_HEAD_START_SECONDS, challengeRecipe } from "./challenge";
import type { GameState } from "./types";

// A Pizza Royale (or a plain match) just started, nobody at the counter yet.
const match = (royale: boolean): GameState => {
  const state = makeState();
  state.settings.tutorialDone = true;
  return play(state, { type: "startChallenge", date: "2026-10-23", multiplayer: true, royale });
};

describe("a Pizza Royale trap", () => {
  it("brings in at once a tricky customer: a recipe of the match with one more filling and one fewer, already waiting", () => {
    const state = play(match(true), { type: "receiveTrap", from: "Léa" });
    const [customer] = serviceOf(state).customers;
    expect(customer.trapFrom).toBe("Léa");
    expect(customer.waitedSeconds).toBe(TRAP_HEAD_START_SECONDS);
    const recipe = challengeRecipe(customer.recipeId as Parameters<typeof challengeRecipe>[0]);
    expect(serviceOf(state).challenge?.menu).toContain(recipe.id);
    if (customer.extraIngredient) {
      expect(recipe.ingredients).not.toContain(customer.extraIngredient);
      expect(customer.ingredients).toContain(customer.extraIngredient);
      // Its pan is on the line: another recipe of the match uses it.
      expect(serviceOf(state).challenge?.menu.some((id) => challengeRecipe(id).ingredients.includes(customer.extraIngredient!))).toBe(true);
    }
    if (customer.removedIngredient) expect(customer.ingredients).not.toContain(customer.removedIngredient);
    expect(state.toasts.map((toast) => toast.key)).toContain("trapReceived");
  });

  it("leaves the match's own customers as everyone's", () => {
    const plain = match(true);
    const trapped = play(match(true), { type: "receiveTrap", from: "Léa" });
    const next = (state: GameState) => {
      const service = serviceOf(state);
      service.nextArrivalIn = 0;
      return serviceOf(play(state, { type: "tick", seconds: 0.01 })).customers.filter((customer) => !customer.trapFrom)[0]?.recipeId;
    };
    expect(next(trapped)).toBe(next(plain));
  });

  it("only exists in a Pizza Royale", () => {
    expect(serviceOf(play(match(false), { type: "receiveTrap", from: "Léa" })).customers).toHaveLength(0);
    expect(play(makeState(), { type: "receiveTrap", from: "Léa" }).service).toBeNull();
  });
});
