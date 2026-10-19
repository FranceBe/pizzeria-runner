import { describe, it, expect, vi, afterEach } from "vitest";
import { DESSERT_QUICK_BONUS, DESSERT_RETURN_SECONDS } from "../data/progression";
import { makeCustomer, play, serviceOf, stateInService, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { createCustomer } from "./customers";
import type { GameState, Recipe } from "./types";

afterEach(() => vi.restoreAllMocks());

const CHOCO: Recipe = {
  id: "chocobanane", name: null, ingredients: ["pate", "chocolat", "banane"], price: 8, classic: true, custom: false, onMenu: true, newUntil: 0,
};

// A service with a dessert pizza on the menu, its ingredients in stock, and more customers still to come.
function withDessert(customers = [makeCustomer()]): GameState {
  const state = stateInService(customers, { stock: { pate: 9, tomate: 9, mozza: 9, basilic: 9, chocolat: 9, banane: 9 } });
  state.unlocked.chocolat = true;
  state.unlocked.banane = true;
  state.recipes.push(CHOCO);
  serviceOf(state).customersToCome = 5;
  serviceOf(state).nextArrivalIn = 999;
  return state;
}

function serveMargherita(state: GameState): GameState {
  const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
}

describe("coming back for dessert", () => {
  it("happens now and then to a happy customer, who comes back later tonight on top of the evening's customers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    let state = serveMargherita(withDessert());
    expect(serviceOf(state).dessertReturns).toEqual([{ name: "Luca", inSeconds: expect.any(Number) }]);
    expect(serviceOf(state).customers).toHaveLength(0);
    state = play(state, { type: "tick", seconds: DESSERT_RETURN_SECONDS[1] });
    const luca = serviceOf(state).customers[0];
    expect(luca).toMatchObject({ name: "Luca", forDessert: true, recipeId: "chocobanane", drink: null, asUsual: false });
    expect(luca.visitNumber).toBeUndefined();
    expect(serviceOf(state).customersToCome).toBe(5);
    expect(serviceOf(state).dessertReturns).toEqual([]);
  });

  it("adds a bonus when the dessert comes quickly, and isn't counted as another visit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = withDessert([makeCustomer({ forDessert: true, recipeId: "chocobanane", ingredients: ["pate", "chocolat", "banane"], price: 8 })]);
    state.customerBook.Luca = { skin: "#fff", hair: "#000", hairStyle: 0, visits: 1, orders: { margherita: 1 } };
    const baked = play(state, ...toggle("pate", "chocolat", "banane"), { type: "bake" }, { type: "tick", seconds: 10 });
    const served = play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    expect(served.money - baked.money).toBe(8 + DESSERT_QUICK_BONUS);
    expect(served.customerBook.Luca?.visits).toBe(1);
  });

  it("needs a dessert on the menu, a happy customer, and an evening that goes on", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const noDessert = withDessert();
    noDessert.recipes = noDessert.recipes.filter((recipe) => recipe.id !== CHOCO.id);
    expect(serviceOf(serveMargherita(noDessert)).dessertReturns ?? []).toEqual([]);
    expect(serviceOf(serveMargherita(withDessert([makeCustomer({ waitedSeconds: 80 })]))).dessertReturns ?? []).toEqual([]);
    const lastOne = withDessert([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })]);
    serviceOf(lastOne).customersToCome = 0;
    expect(serviceOf(serveMargherita(lastOne)).dessertReturns ?? []).toEqual([]);
  });

  it("orders only from the dessert pizzas", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(createCustomer(withDessert(), "regular", { name: "Luca", forDessert: true })?.recipeId).toBe("chocobanane");
    const noDessert = withDessert();
    noDessert.recipes = noDessert.recipes.filter((recipe) => recipe.id !== CHOCO.id);
    expect(createCustomer(noDessert, "regular", { name: "Luca", forDessert: true })).toBeNull();
  });
});
