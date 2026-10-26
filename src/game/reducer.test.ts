import { describe, it, expect, vi, afterEach } from "vitest";
import type { IngredientId } from "../data/ingredients";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { gameReducer } from "./reducer";
import type { GameAction, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const addIngredients = (ids: readonly IngredientId[]): GameAction[] => toggle(...ids);

// Ticks until every pizza in the oven is baked.
const waitForOven = (state: GameState): GameState => play(state, { type: "tick", seconds: 10 });

describe("gameReducer", () => {
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
    expect(serviceOf(state).customersToCome).toBe(6);
  });

  it("refuses to open with an empty menu", () => {
    const empty = makeState();
    empty.recipes[0].onMenu = false;
    const state = play(empty, { type: "openRestaurant" });
    expect(state.phase).toBe("prep");
    expect(state.toasts[0]).toMatchObject({ key: "emptyMenu", kind: "warn" });
  });

  it("lets customers in over time", () => {
    const state = play(makeState(), { type: "openRestaurant" }, { type: "tick", seconds: 1 });
    expect(serviceOf(state).customers).toHaveLength(1);
    expect(serviceOf(state).selectedCustomerId).toBe(serviceOf(state).customers[0].id);
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
    expect(serviceOf(state).board).toEqual([]);
  });

  it("takes ingredients from stock and gives them back when removed", () => {
    let state = play(stateInService([]), ...addIngredients(["pate", "tomate"]));
    expect(serviceOf(state).board).toEqual(["pate", "tomate"]);
    expect(state.stock.tomate).toBe(7);
    state = play(state, ...addIngredients(["tomate"]));
    expect(serviceOf(state).board).toEqual(["pate"]);
    expect(state.stock.tomate).toBe(8);
  });

  it("swaps sauces instead of stacking them", () => {
    const start = stateInService([]);
    start.unlocked.creme = true;
    start.stock.creme = 2;
    const state = play(start, ...addIngredients(["pate", "tomate", "creme"]));
    expect(serviceOf(state).board).toEqual(["pate", "creme"]);
    expect(state.stock.tomate).toBe(8);
  });

  it("won't remove the dough from under the toppings", () => {
    const state = play(stateInService([]), ...addIngredients(["pate", "tomate", "pate"]));
    expect(serviceOf(state).board).toEqual(["pate", "tomate"]);
  });

  it("counts a trashed pizza as waste", () => {
    const state = play(stateInService([]), ...addIngredients(["pate", "tomate"]), { type: "trashBoard" });
    expect(serviceOf(state).board).toEqual([]);
    expect(serviceOf(state).stats.waste).toBeCloseTo(1.0);
  });
});

describe("baking and serving", () => {
  it("bakes a pizza and moves it to the pass", () => {
    let state = play(stateInService([makeCustomer()]), ...addIngredients(MARGHERITA), { type: "bake" });
    expect(serviceOf(state).oven).toHaveLength(1);
    state = waitForOven(state);
    expect(serviceOf(state).oven).toHaveLength(0);
    expect(serviceOf(state).ready[0].ingredients).toEqual(MARGHERITA);
  });

  it("refuses to bake when the oven is full", () => {
    const state = play(stateInService([]), ...addIngredients(["pate"]), { type: "bake" }, ...addIngredients(["pate"]), { type: "bake" });
    expect(serviceOf(state).oven).toHaveLength(1);
    expect(serviceOf(state).board).toEqual(["pate"]);
  });

  it("serves the matching customer, gets paid and ends the day with the last one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no tip
    let state = play(stateInService([makeCustomer()], { money: 0 }), ...addIngredients(MARGHERITA), { type: "bake" });
    state = waitForOven(state);
    state = play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[0].id });

    expect(state.money).toBe(7 - 6); // paid 7, then evening charges of 6
    expect(state.xp).toBe(6 + 2 * 2 + 2 * 5); // two fillings, two pairings discovered (tomato & basil, mozzarella & basil)
    expect(state.phase).toBe("summary");
    expect(state.summary).toMatchObject({ served: 1, revenue: 7, tips: 0, charges: 6, bestSeller: { recipeId: "margherita", count: 1 } });
    expect(state.summary?.orders).toEqual([
      { customerName: "Luca", recipeId: "margherita", recipeName: null, ingredients: MARGHERITA, price: 7, tip: 0, stars: 5, reason: "perfect" },
    ]);
    expect(state.pops).toMatchObject([{ amount: 7, kind: "money" }]);
  });

  it("won't serve a pizza nobody ordered", () => {
    let state = play(stateInService([makeCustomer()]), ...addIngredients(["pate", "tomate"]), { type: "bake" });
    state = waitForOven(state);
    state = play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[0].id });
    expect(serviceOf(state).ready).toHaveLength(1);
    expect(serviceOf(state).customers).toHaveLength(1);
  });

  it("lets the level-1 commis spread fresh dough after each bake", () => {
    const state = play(stateInService([], { upgrades: { oven: 0, salle: 0, deco: 0, commis: 1, drawer: 0, terrasse: 0, livraison: 0, bar: 0, waiter: 0, oven2: 0, trattoria: 0, annexe: 0 }, commis: { name: "Charlie", fatigue: 0 } }), ...addIngredients(["pate"]), { type: "bake" });
    expect(serviceOf(state).board).toEqual(["pate"]);
    expect(state.stock.pate).toBe(6);
  });
});

describe("end of day", () => {
  it("returns board ingredients to stock and counts unserved pizzas as waste", () => {
    let state = play(stateInService([makeCustomer(), makeCustomer({ id: "cust-2" })]), ...addIngredients(MARGHERITA), { type: "bake" });
    state = waitForOven(state);
    const pizzaId = serviceOf(state).ready[0].id;
    state = play(state, ...addIngredients(MARGHERITA), { type: "bake" });
    state = waitForOven(state);
    state = play(state, ...addIngredients(["pate"]));
    serviceOf(state).customers = serviceOf(state).customers.slice(0, 1);
    state = play(state, { type: "servePizza", pizzaId });
    expect(state.phase).toBe("summary");
    expect(state.summary?.waste).toBeCloseTo(2.1);
    expect(state.stock.pate).toBe(8 - 3 + 1);
  });

  it("starts the next day", () => {
    const state = play(makeState({ phase: "summary", purchasesToday: 12 }), { type: "startNextDay" });
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
    expect(state.recipes.map((recipe) => recipe.id)).toContain("marinara");
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
    const recipe = state.recipes.find((candidate) => candidate.name === "La Simple");
    expect(recipe).toMatchObject({ custom: true, onMenu: true, ingredients: ["pate", "mozza"], newUntil: 3 });
  });

  it("refuses to put a recipe on a full menu", () => {
    let state = makeState();
    for (let i = 0; i < 4; i++) {
      state = play(state, { type: "addRecipe", name: `R${i}`, ingredients: ["pate", "mozza"], price: 5 });
    }
    const lastAdded = state.recipes[state.recipes.length - 1];
    expect(lastAdded.onMenu).toBe(false);
    state = play(state, { type: "toggleOnMenu", recipeId: lastAdded.id });
    expect(state.recipes[state.recipes.length - 1].onMenu).toBe(false);
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

  it("switches language", () => {
    const state = play(makeState(), { type: "setLanguage", language: "en" });
    expect(state.settings.language).toBe("en");
  });

  it("imports a save, migrating it if needed and keeping this device's language", () => {
    const saveData = { money: 99, recipes: [], settings: { help: false, language: "en" } };
    const state = play(makeState(), { type: "importSave", saveData });
    expect(state.money).toBe(99);
    expect(state.settings).toMatchObject({ showHelp: false, language: "fr" });
    expect(state.toasts[0].key).toBe("gameLoaded");
  });

  it("resets the game, keeping the language", () => {
    const english = makeState({ day: 30, money: 999 });
    english.settings.language = "en";
    const state = play(english, { type: "resetGame" });
    expect(state).toMatchObject({ day: 1, money: 20 });
    expect(state.settings.language).toBe("en");
  });

  it("dismisses the newest toast along with the older ones", () => {
    const tooMuch: GameAction = { type: "buyIngredient", ingredientId: "pate", quantity: 1000 };
    let state = play(makeState(), tooMuch, tooMuch);
    expect(state.toasts).toHaveLength(2);
    state = play(state, { type: "dismissToast", toastId: state.toasts[1].id });
    expect(state.toasts).toEqual([]);
  });

  it("removes a money pop once shown", () => {
    const state = play(makeState({ pops: [{ id: "p", amount: 7, kind: "money" }] }), { type: "dismissPop", popId: "p" });
    expect(state.pops).toEqual([]);
  });
});

describe("what the reducer shares instead of copying", () => {
  const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value as object).forEach(deepFreeze);
    }
    return value;
  };

  it("never changes the morning's copy or, on a tick, the customer book in place: whole evenings frozen", () => {
    // A busy evening with regulars, stories and birthdays, ticked to its end (the last tick ends the day).
    let state = play(makeState({ day: 12, xp: 6000, upgrades: { ...makeState().upgrades, salle: 3, bar: 2 } }), { type: "openRestaurant" });
    state.customerBook = {
      Luca: { skin: "#e0ac83", hair: "#5b3a22", hairStyle: 1, visits: 9, orders: { margherita: 9 }, regular: true, lastVisit: 11, birthday: 12 },
      Gio: { skin: "#c68b62", hair: "#1b1b1b", hairStyle: 2, visits: 7, orders: { margherita: 7 }, regular: true, lastVisit: 11, story: { id: "student", chapter: 1, dueDay: 12 } },
    };
    deepFreeze(state.customerBook);
    deepFreeze(state.dayStart);
    for (let step = 0; step < 2000 && state.service; step++) {
      // Everyone served straight away, out of band, so the evening runs to its end on ticks alone.
      state = { ...state, service: { ...serviceOf(state), customers: [] } };
      state = gameReducer(state, { type: "tick", seconds: 0.5 });
    }
    expect(state.phase).toBe("summary");
  });

  it("still copies the customer book for the actions that write it", () => {
    const state = stateInService([makeCustomer()]);
    const before = state.customerBook;
    const served = play({ ...state, service: { ...serviceOf(state), ready: [{ id: "p", ingredients: [...MARGHERITA], waitingSeconds: 0 }] } }, { type: "servePizza", pizzaId: "p" });
    expect(served.customerBook).not.toBe(before);
    expect(before).toEqual(state.customerBook);
  });
});
