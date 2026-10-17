import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle } from "../test/helpers";
import { findRecipeByIngredients } from "./menu";
import { appealOf, isDessert } from "./pizza";
import { ovensOf, ovenSlots } from "./service";
import { shortcutAction } from "./shortcuts";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const withUpgrades = (upgrades: Partial<GameState["upgrades"]>, overrides: Partial<GameState> = {}): Partial<GameState> => ({
  ...overrides,
  upgrades: { ...makeState().upgrades, ...upgrades },
});

describe("extra ovens", () => {
  it("start with one slow slot, then improve like the first oven", () => {
    const state = makeState(withUpgrades({ oven: 3, oven2: 1 }));
    expect(ovensOf(state)).toEqual([
      { index: 0, slots: 3, bakeSeconds: 2.2 },
      { index: 1, slots: 1, bakeSeconds: 6 },
    ]);
    expect(ovenSlots(makeState(withUpgrades({ oven: 3, oven2: 4, oven3: 2 })))).toBe(3 + 3 + 2);
  });

  it("take a pizza when the first oven is full, and bake it at their own speed", () => {
    let state = stateInService([makeCustomer()], withUpgrades({ oven2: 1 }));
    state = play(state, ...toggle("pate"), { type: "bake" }, ...toggle("pate"), { type: "bake" });
    expect(serviceOf(state).oven.map((pizza) => [pizza.ovenIndex, pizza.bakeDuration])).toEqual([[0, 6], [1, 6]]);
    state = play(state, ...toggle("pate"), { type: "bake" });
    expect(state.toasts.at(-1)?.key).toBe("ovenFull");
  });
});

describe("gluten-free dough", () => {
  it("replaces the regular dough on the board, and still counts as the recipe", () => {
    const state = play(stateInService([makeCustomer()], { unlocked: { ...makeState().unlocked, pateSG: true }, stock: { pate: 5, pateSG: 5, tomate: 5 } }),
      ...toggle("pate", "pateSG"));
    expect(serviceOf(state).board).toEqual(["pateSG"]);
    expect(state.stock).toMatchObject({ pate: 5, pateSG: 4 });
    expect(findRecipeByIngredients(state, ["pateSG", "tomate", "mozza", "basilic"])?.id).toBe("margherita");
  });

  it("is what the 0 key spreads for a gluten-free order", () => {
    const state = stateInService([makeCustomer({ diet: "glutenFree", ingredients: ["pateSG", "tomate", "mozza", "basilic"] })]);
    expect(shortcutAction(state, "0")).toEqual({ type: "toggleIngredient", ingredientId: "pateSG" });
  });
});

describe("drinks", () => {
  it("go to whoever ordered them and are paid right away", () => {
    const state = stateInService([makeCustomer(), makeCustomer({ id: "cust-2", name: "Sofia", drink: "vin" })], { money: 0 });
    const served = play(state, { type: "serveDrink", drinkId: "vin" });
    expect(serviceOf(served).customers[1].drinkServed).toBe(true);
    expect(served.money).toBe(4.5);
    expect(serviceOf(served).stats.drinks).toBe(4.5);
    expect(served.lifetime.drinksSold).toBe(1);
    expect(play(served, { type: "serveDrink", drinkId: "vin" }).toasts.at(-1)?.key).toBe("nobodyWantsDrink");
  });

  it("have a keyboard shortcut for the selected customer", () => {
    const state = stateInService([makeCustomer({ drink: "limonade" })]);
    expect(shortcutAction(state, "d")).toEqual({ type: "serveDrink", drinkId: "limonade" });
  });
});

describe("dessert pizzas", () => {
  it("need neither cheese nor sauce, but don't mix with meat", () => {
    const choco = ["pate", "chocolat", "banane", "noisette"] as const;
    expect(isDessert(choco)).toBe(true);
    expect(isDessert(["pate", "tomate", "mozza", "miel"])).toBe(false);
    expect(appealOf(choco, true)).toBeGreaterThan(appealOf(["pate", "chocolat", "banane", "salami"], true));
    expect(appealOf(["pate", "banane", "fraise"], false)).toBeGreaterThan(appealOf(["pate", "jambon", "champi"], false) - 0.2);
  });
});
