// The trattoria, played by the robots: pasta on the stove, lasagne in the oven, evenings that end well.
import { describe, it, expect, vi, afterEach } from "vitest";
import { seededRandom } from "../utils/random";
import { DATES, lateGame } from "../test/fixtures";
import { playDays } from "../test/robot";
import { gameReducer } from "./reducer";
import { activeMenu, menuCapacityOf } from "./menu";
import { dishOf } from "./pizza";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

// Half the menu in pasta: every pasta classic known goes on, pizzas make room for them.
const halfPasta = (state: GameState): GameState => {
  let next = state;
  const pasta = next.recipes.filter((recipe) => dishOf(recipe.ingredients) === "pasta");
  pasta.filter((recipe) => !recipe.onMenu).forEach((recipe) => {
    if (activeMenu(next).length >= menuCapacityOf(next)) {
      const pizza = activeMenu(next).find((candidate) => dishOf(candidate.ingredients) === "pizza");
      if (pizza) next = gameReducer(next, { type: "toggleOnMenu", recipeId: pizza.id });
    }
    next = gameReducer(next, { type: "toggleOnMenu", recipeId: recipe.id });
  });
  return gameReducer(next, { type: "restock", targetQuantity: 15 });
};

describe("the trattoria, played", () => {
  it.each([
    ["careful", 31],
    ["sloppy", 32],
  ] as const)("serves pasta night after night with a %s cook, the stove and the ovens each doing their part", (style, seed) => {
    const random = seededRandom(seed);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = lateGame();
    expect(start.upgrades.trattoria).toBeGreaterThan(0);
    let pastaOnMenu = 0;
    const end = playDays(start, {
      days: 6,
      style,
      random,
      dates: DATES,
      beforeOpening: (state) => {
        const next = halfPasta(state);
        pastaOnMenu = Math.max(pastaOnMenu, activeMenu(next).filter((recipe) => dishOf(recipe.ingredients) === "pasta").length);
        return next;
      },
    });
    expect(pastaOnMenu).toBeGreaterThanOrEqual(4);
    expect(end.lifetime.pastaServed).toBeGreaterThan(5);
    expect(end.achievements.firstPasta).toBeDefined();
    expect(end.achievements.trattoriaMenu).toBeDefined();
  }, 60_000);
});
