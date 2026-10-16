import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer } from "../test/helpers.js";
import { gameReducer } from "./reducer.js";

afterEach(() => vi.restoreAllMocks());

const MARGHERITA = ["pate", "tomate", "mozza", "basilic"];
const addIngredients = (ids) => ids.map((id) => ({ type: "toggleIngredient", ingredientId: id }));

// Ticks until every pizza in the oven is baked.
const waitForOven = (state) => play(state, { type: "tick", seconds: 10 });

describe("gameReducer", () => {
  it("ignores unknown actions", () => {
    const state = makeState();
    expect(gameReducer(state, { type: "nope" })).toBe(state);
  });

  it("ignores ticks outside service", () => {
    const state = makeState();
    expect(gameReducer(state, { type: "tick", seconds: 1 })).toBe(state);
  });

  it("never mutates the previous state", () => {
    const state = makeState();
    const before = JSON.stringify(state);
    play(state, { type: "buyIngredient", ingredientId: "pate", quantity: 1 });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("opening the restaurant", () => {
  it("starts a service with the forecast number of customers", () => {
    const state = play(makeState(), { type: "openRestaurant" });
    expect(state.phase).toBe("service");
    expect(state.service.customersToCome).toBe(6);
  });

  it("refuses to open with an empty menu", () => {
    const empty = makeState();
    empty.recipes[0].onMenu = false;
    const state = play(empty, { type: "openRestaurant" });
    expect(state.phase).toBe("prep");
    expect(state.toasts[0].kind).toBe("warn");
  });

  it("lets customers in over time", () => {
    const state = play(makeState(), { type: "openRestaurant" }, { type: "tick", seconds: 1 });
    expect(state.service.customers).toHaveLength(1);
    expect(state.service.selectedCustomerId).toBe(state.service.customers[0].id);
  });

  it("ends the day if the menu is emptied mid-service", () => {
    let state = play(makeState(), { type: "openRestaurant" }, { type: "toggleOnMenu", recipeId: "margherita" });
    state = play(state, { type: "tick", seconds: 1 });
    expect(state.phase).toBe("summary");
  });
});

describe("building a pizza", () => {
  it("needs dough first", () => {
    const state = play(stateInService([]), ...addIngredients(["tomate"]));
    expect(state.service.board).toEqual([]);
  });

  it("takes ingredients from stock and gives them back when removed", () => {
    let state = play(stateInService([]), ...addIngredients(["pate", "tomate"]));
    expect(state.service.board).toEqual(["pate", "tomate"]);
    expect(state.stock.tomate).toBe(7);
    state = play(state, ...addIngredients(["tomate"]));
    expect(state.service.board).toEqual(["pate"]);
    expect(state.stock.tomate).toBe(8);
  });

  it("swaps sauces instead of stacking them", () => {
    const start = stateInService([]);
    start.unlocked.creme = true;
    start.stock.creme = 2;
    const state = play(start, ...addIngredients(["pate", "tomate", "creme"]));
    expect(state.service.board).toEqual(["pate", "creme"]);
    expect(state.stock.tomate).toBe(8);
  });

  it("won't remove the dough from under the toppings", () => {
    const state = play(stateInService([]), ...addIngredients(["pate", "tomate", "pate"]));
    expect(state.service.board).toEqual(["pate", "tomate"]);
  });

  it("counts a trashed pizza as waste", () => {
    const state = play(stateInService([]), ...addIngredients(["pate", "tomate"]), { type: "trashBoard" });
    expect(state.service.board).toEqual([]);
    expect(state.service.stats.waste).toBeCloseTo(1.0);
  });
});

describe("baking and serving", () => {
  it("bakes a pizza and moves it to the pass", () => {
    let state = play(stateInService([makeCustomer()]), ...addIngredients(MARGHERITA), { type: "bake" });
    expect(state.service.oven).toHaveLength(1);
    state = waitForOven(state);
    expect(state.service.oven).toHaveLength(0);
    expect(state.service.ready[0].ingredients).toEqual(MARGHERITA);
  });

  it("refuses to bake when the oven is full", () => {
    const state = play(stateInService([]), ...addIngredients(["pate"]), { type: "bake" }, ...addIngredients(["pate"]), { type: "bake" });
    expect(state.service.oven).toHaveLength(1);
    expect(state.service.board).toEqual(["pate"]);
  });

  it("serves the matching customer, gets paid and ends the day with the last one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no tip
    let state = play(stateInService([makeCustomer()], { money: 0 }), ...addIngredients(MARGHERITA), { type: "bake" });
    state = waitForOven(state);
    state = play(state, { type: "servePizza", pizzaId: state.service?.ready[0].id });

    expect(state.money).toBe(7 - 6); // paid 7, then evening charges of 6
    expect(state.xp).toBe(6 + 2 * 2);
    expect(state.phase).toBe("summary");
    expect(state.summary).toMatchObject({ served: 1, revenue: 7, tips: 0, charges: 6, bestSeller: ["Margherita", 1] });
  });

  it("won't serve a pizza nobody ordered", () => {
    let state = play(stateInService([makeCustomer()]), ...addIngredients(["pate", "tomate"]), { type: "bake" });
    state = waitForOven(state);
    state = play(state, { type: "servePizza", pizzaId: state.service.ready[0].id });
    expect(state.service.ready).toHaveLength(1);
    expect(state.service.customers).toHaveLength(1);
  });

  it("lets the level-2 commis assemble the selected order", () => {
    const state = play(stateInService([makeCustomer()], { upgrades: { oven: 0, salle: 0, deco: 0, commis: 2 } }), { type: "assembleOrder" });
    expect(state.service.board).toEqual(MARGHERITA);
    expect(state.stock.basilic).toBe(7);
  });

  it("lets the level-1 commis spread fresh dough after each bake", () => {
    const state = play(stateInService([], { upgrades: { oven: 0, salle: 0, deco: 0, commis: 1 } }), ...addIngredients(["pate"]), { type: "bake" });
    expect(state.service.board).toEqual(["pate"]);
    expect(state.stock.pate).toBe(6);
  });
});

describe("end of day", () => {
  it("returns board ingredients to stock and counts unserved pizzas as waste", () => {
    let state = play(stateInService([makeCustomer(), makeCustomer({ id: "cust-2" })]), ...addIngredients(MARGHERITA), { type: "bake" });
    state = waitForOven(state);
    const pizzaId = state.service.ready[0].id;
    state = play(state, ...addIngredients(MARGHERITA), { type: "bake" });
    state = waitForOven(state);
    state = play(state, ...addIngredients(["pate"]));
    state.service.customers = state.service.customers.slice(0, 1);
    state = play(state, { type: "servePizza", pizzaId });
    expect(state.phase).toBe("summary");
    expect(state.summary.waste).toBeCloseTo(2.1);
    expect(state.stock.pate).toBe(8 - 3 + 1);
  });

  it("starts the next day", () => {
    const state = play(makeState({ phase: "summary", summary: {}, purchasesToday: 12 }), { type: "startNextDay" });
    expect(state).toMatchObject({ day: 2, phase: "prep", summary: null, purchasesToday: 0 });
  });
});

describe("shopping", () => {
  it("buys ingredients", () => {
    const state = play(makeState({ money: 10 }), { type: "buyIngredient", ingredientId: "mozza", quantity: 5 });
    expect(state.stock.mozza).toBe(13);
    expect(state.money).toBeCloseTo(5.5);
    expect(state.purchasesToday).toBeCloseTo(4.5);
  });

  it("refuses when money is short", () => {
    const state = play(makeState({ money: 1 }), { type: "buyIngredient", ingredientId: "mozza", quantity: 5 });
    expect(state.stock.mozza).toBe(8);
    expect(state.money).toBe(1);
  });

  it("restocks the whole menu to a target quantity", () => {
    const state = play(makeState({ money: 100 }), { type: "restock", targetQuantity: 10 });
    expect(state.stock).toMatchObject({ pate: 10, tomate: 10, mozza: 10, basilic: 10 });
  });

  it("signs a supplier, gives free portions and discovers classics", () => {
    const state = play(makeState({ money: 100 }), { type: "signSupplier", ingredientId: "origan" });
    expect(state.unlocked.origan).toBe(true);
    expect(state.stock.origan).toBe(4);
    expect(state.money).toBe(88);
    expect(state.recipes.map((r) => r.id)).toContain("marinara");
  });

  it("won't sign a supplier above the player's level", () => {
    const state = play(makeState({ money: 1000 }), { type: "signSupplier", ingredientId: "truffe" });
    expect(state.unlocked.truffe).toBeUndefined();
    expect(state.money).toBe(1000);
  });

  it("lets Nonna drop off margherita ingredients", () => {
    const state = play(makeState({ day: 4 }), { type: "callNonna" });
    expect(state.stock.pate).toBe(12);
    expect(state.lastNonnaVisitDay).toBe(4);
  });

  it("buys an upgrade when level and money allow", () => {
    const state = play(makeState({ money: 100 }), { type: "buyUpgrade", upgradeKey: "salle" });
    expect(state.upgrades.salle).toBe(1);
    expect(state.money).toBe(50);
  });

  it("won't buy an upgrade above the player's level", () => {
    const state = play(makeState({ money: 1000 }), { type: "buyUpgrade", upgradeKey: "oven" });
    expect(state.upgrades.oven).toBe(0);
  });
});

describe("menu", () => {
  it("changes a recipe price in 50-cent steps", () => {
    const state = play(makeState(), { type: "changePrice", recipeId: "margherita", delta: 0.5 });
    expect(state.recipes[0].price).toBe(7.5);
  });

  it("adds a custom recipe to the menu when there is room", () => {
    const state = play(makeState(), { type: "addRecipe", name: "La Simple", ingredients: ["mozza", "pate"], price: 5 });
    const recipe = state.recipes.find((r) => r.name === "La Simple");
    expect(recipe).toMatchObject({ custom: true, onMenu: true, ingredients: ["pate", "mozza"], newUntil: 3 });
  });

  it("refuses to put a recipe on a full menu", () => {
    let state = makeState();
    for (let i = 0; i < 4; i++) {
      state = play(state, { type: "addRecipe", name: `R${i}`, ingredients: ["pate", "mozza"], price: 5 });
    }
    const lastAdded = state.recipes.at(-1);
    expect(lastAdded.onMenu).toBe(false);
    state = play(state, { type: "toggleOnMenu", recipeId: lastAdded.id });
    expect(state.recipes.at(-1).onMenu).toBe(false);
  });

  it("deletes a recipe", () => {
    const state = play(makeState(), { type: "deleteRecipe", recipeId: "margherita" });
    expect(state.recipes).toEqual([]);
  });
});

describe("settings", () => {
  it("renames the pizzeria, capped at 32 characters", () => {
    const state = play(makeState(), { type: "renamePizzeria", name: "x".repeat(50) });
    expect(state.name).toHaveLength(32);
  });

  it("toggles the help", () => {
    const state = play(makeState(), { type: "toggleHelp" });
    expect(state.settings.showHelp).toBe(false);
  });

  it("imports a save, migrating it if needed", () => {
    const state = play(makeState(), { type: "importSave", saveData: { money: 99, recipes: [], settings: { help: false } } });
    expect(state.money).toBe(99);
    expect(state.settings.showHelp).toBe(false);
    expect(state.toasts[0].text).toBe("Partie chargée.");
  });

  it("resets the game", () => {
    const state = play(makeState({ day: 30, money: 999 }), { type: "resetGame" });
    expect(state).toMatchObject({ day: 1, money: 20 });
  });

  it("dismisses a toast", () => {
    let state = play(makeState(), { type: "buyIngredient", ingredientId: "pate", quantity: 1000 });
    state = play(state, { type: "dismissToast", toastId: state.toasts[0].id });
    expect(state.toasts).toEqual([]);
  });
});
