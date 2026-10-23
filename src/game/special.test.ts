import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { orderWeight } from "./customers";
import { canChooseSpecial, currentSpecial, SPECIAL_BONUS_SHARE, SPECIAL_HOMEMADE_XP, SPECIAL_ORDER_BOOST, specialUntil } from "./special";
import { hydrateState, migrateSave } from "./state";
import type { Customer, GameState, Recipe } from "./types";

afterEach(() => vi.restoreAllMocks());

const ROSSA: Recipe = { id: "c-rossa", name: "Rossa", ingredients: MARGHERITA, price: 10, classic: false, custom: true, onMenu: true, newUntil: 0 };

const serveMargherita = (state: GameState): GameState => {
  const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
};

// One customer at the counter, no tip (so the money is only the price and the special's bonus).
const serving = (customer: Partial<Customer>, special: string | null, recipes?: Recipe[]): GameState => {
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  const state = stateInService([makeCustomer(customer)], { money: 0, ...(recipes ? { recipes } : {}) });
  if (special) state.special = { recipeId: special as Recipe["id"], week: 0, chosenDay: 1, served: 0 };
  return serveMargherita(state);
};

describe("the week's special", () => {
  it("is ordered twice as often", () => {
    const state = makeState();
    const before = orderWeight(state, state.recipes[0]);
    const special = play(state, { type: "setSpecial", recipeId: "margherita" });
    expect(currentSpecial(special)).toEqual({ recipeId: "margherita", week: 0, chosenDay: 1, served: 0 });
    expect(orderWeight(special, special.recipes[0])).toBeCloseTo(before * SPECIAL_ORDER_BOOST);
  });

  it("is chosen in the morning, can be changed that morning only, and holds until the week is over", () => {
    const chosen = play(makeState({ recipes: [...makeState().recipes, ROSSA] }), { type: "setSpecial", recipeId: "margherita" });
    const changed = play(chosen, { type: "setSpecial", recipeId: ROSSA.id });
    expect(currentSpecial(changed)?.recipeId).toBe(ROSSA.id);

    const nextDay = play(changed, { type: "startNextDay" });
    expect(canChooseSpecial(nextDay)).toBe(false);
    expect(play(nextDay, { type: "setSpecial", recipeId: "margherita" }).special?.recipeId).toBe(ROSSA.id);
    expect(play(nextDay, { type: "setSpecial", recipeId: null }).special?.recipeId).toBe(ROSSA.id);
    expect(specialUntil(nextDay.day)).toBe(7);
  });

  it("can't be chosen during service, nor be a pizza off the menu", () => {
    const inService = stateInService([makeCustomer()]);
    expect(play(inService, { type: "setSpecial", recipeId: "margherita" }).special).toBeNull();
    const offMenu = makeState({ recipes: [...makeState().recipes, { ...ROSSA, onMenu: false }] });
    expect(play(offMenu, { type: "setSpecial", recipeId: ROSSA.id }).special).toBeNull();
  });

  it("leaves with its pizza: off the menu or deleted, another one can be chosen", () => {
    const state = play(makeState({ day: 3, recipes: [...makeState().recipes, ROSSA] }), { type: "setSpecial", recipeId: ROSSA.id });
    state.special = { ...state.special!, chosenDay: 2 };
    expect(play(state, { type: "toggleOnMenu", recipeId: ROSSA.id }).special).toBeNull();
    const deleted = play(state, { type: "deleteRecipe", recipeId: ROSSA.id });
    expect(deleted.special).toBeNull();
    expect(play(deleted, { type: "setSpecial", recipeId: "margherita" }).special?.recipeId).toBe("margherita");
  });

  it("is told how it went when the week ends, and a new one is to be chosen", () => {
    const state = makeState({ day: 7, special: { recipeId: "margherita", week: 0, chosenDay: 2, served: 12 } });
    const monday = play(state, { type: "startNextDay" });
    expect(monday.special).toBeNull();
    expect(monday.toasts.map((toast) => toast.key)).toContain("specialWeek");
    expect(canChooseSpecial(monday)).toBe(true);
    const quietWeek = play({ ...state, special: { ...state.special!, served: 0 } }, { type: "startNextDay" });
    expect(quietWeek.toasts.map((toast) => toast.key)).not.toContain("specialWeek");
  });

  it("pays a fifth of its price on top when it goes out quickly, and is counted", () => {
    const plain = serving({}, null);
    const special = serving({}, "margherita");
    expect(special.money - plain.money).toBeCloseTo(7 * SPECIAL_BONUS_SHARE);
    expect(special.special?.served).toBe(1);
    expect(special.pops.map((pop) => pop.kind)).toContain("special");
  });

  it("pays no bonus to a customer kept waiting, but still counts", () => {
    const special = serving({ waitedSeconds: 200 }, "margherita");
    expect(special.pops.map((pop) => pop.kind)).not.toContain("special");
    expect(special.special?.served).toBe(1);
  });

  it("brings reputation too when it is a homemade recipe", () => {
    const recipes = [...makeState().recipes, ROSSA];
    const order = { recipeId: ROSSA.id, recipeName: "Rossa", price: 10 };
    const plain = serving(order, null, recipes);
    const special = serving(order, ROSSA.id, recipes);
    expect(special.xp - plain.xp).toBe(SPECIAL_HOMEMADE_XP);
  });

  it("comes from the chef's special of older saves", () => {
    const { special: _special, ...saved } = toJson(makeState({ day: 9 }));
    const old = { ...saved, version: 11, chefSpecial: "margherita" };
    expect(migrateSave(old).special).toEqual({ recipeId: "margherita", week: 1, chosenDay: 9, served: 0 });
    expect(hydrateState(old)).not.toHaveProperty("chefSpecial");
    const none = { ...old, chefSpecial: null };
    expect(hydrateState(none).special).toBeNull();
  });
});
