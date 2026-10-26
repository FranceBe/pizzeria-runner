import { describe, it, expect } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, toJson } from "../test/helpers";
import { STOVE_BURNERS, STOVE_SECONDS, TRATTORIA_MENU_ROOM, UPGRADES } from "../data/progression";
import { CLASSIC_RECIPES } from "../data/recipes";
import { INGREDIENTS } from "../data/ingredients";
import { cooksInOven, dishOf, appealOf } from "./pizza";
import { dietAllows } from "./diets";
import { ovensOf, ovenWithRoom } from "./service";
import { findRecipeByIngredients, menuCapacityOf, validateRecipe } from "./menu";
import { achievementProgress } from "./achievements";
import { dailyCharges } from "./economy";
import { hydrateState } from "./state";
import { canOfferSlice } from "./slice";
import { levelForXp, menuCapacity } from "./progression";
import type { GameState } from "./types";

const XP_LEVEL_10 = 30000;
const CARBONARA = ["spaghetti", "guanciale", "oeuf", "pecorino"] as const;
const LASAGNA = ["lasagne", "ragu", "mozza", "parmesan"] as const;
const TRATTORIA_INGREDIENTS = INGREDIENTS.filter((ingredient) => ingredient.trattoria).map((ingredient) => ingredient.id);

// A level 10 pizzeria with the trattoria open (at the given level) and every pasta ingredient in stock.
const trattoria = (level = 1, overrides: Partial<GameState> = {}): Partial<GameState> => {
  const base = makeState();
  return {
    xp: XP_LEVEL_10,
    money: 5000,
    upgrades: { ...base.upgrades, trattoria: level },
    unlocked: { ...base.unlocked, ...Object.fromEntries([...TRATTORIA_INGREDIENTS, "oeuf", "parmesan"].map((id) => [id, true])) },
    stock: { ...base.stock, ...Object.fromEntries([...TRATTORIA_INGREDIENTS, "oeuf", "parmesan", "mozza"].map((id) => [id, 10])) },
    ...overrides,
  };
};

describe("the trattoria's dishes", () => {
  it("tells a plate of pasta from a pizza, and which ones go in the oven (pizzas and lasagne)", () => {
    expect(dishOf(["pate", "tomate"])).toBe("pizza");
    expect(dishOf([...CARBONARA])).toBe("pasta");
    expect(cooksInOven(["pate", "tomate"])).toBe(true);
    expect(cooksInOven([...CARBONARA])).toBe(false);
    expect(cooksInOven([...LASAGNA])).toBe(true);
  });

  it("makes plates of pasta a little more appealing than a pizza with as few things on it", () => {
    expect(appealOf(["spaghetti", "tomate", "pecorino"], false)).toBeGreaterThan(appealOf(["pate", "tomate", "pecorino"], false));
  });

  it("keeps every pasta away from a gluten-free customer", () => {
    expect(dietAllows("glutenFree", [...CARBONARA])).toBe(false);
    expect(dietAllows("glutenFree", ["pateSG", "tomate"])).toBe(true);
    expect(dietAllows(null, [...CARBONARA])).toBe(true);
  });

  it("has eight pasta classics, each with exactly one pasta and none with a pizza dough", () => {
    const pasta = CLASSIC_RECIPES.filter((classic) => dishOf(classic.ingredients) === "pasta");
    expect(pasta).toHaveLength(8);
    pasta.forEach((classic) => {
      expect(classic.ingredients.filter((id) => INGREDIENTS.find((x) => x.id === id)?.pasta)).toHaveLength(1);
      expect(classic.ingredients).not.toContain("pate");
    });
  });
});

describe("the trattoria upgrade", () => {
  it("opens at level 9 and costs its daily charge", () => {
    expect(UPGRADES.trattoria.requiredLevel[0]).toBe(9);
    const closed = makeState({ xp: XP_LEVEL_10 });
    expect(dailyCharges(makeState(trattoria())) - dailyCharges(closed)).toBe(UPGRADES.trattoria.dailyCharge);
  });

  it("keeps its suppliers away until it is open", () => {
    const closed = play(makeState({ xp: XP_LEVEL_10, money: 5000 }), { type: "signSupplier", ingredientId: "spaghetti" });
    expect(closed.unlocked.spaghetti).toBeFalsy();
    expect(closed.money).toBe(5000);
    const open = play(makeState({ xp: XP_LEVEL_10, money: 5000, upgrades: { ...makeState().upgrades, trattoria: 1 } }), { type: "signSupplier", ingredientId: "spaghetti" });
    expect(open.unlocked.spaghetti).toBe(true);
    expect(open.money).toBeLessThan(5000);
  });

  it("makes room on the menu for four more dishes", () => {
    const closed = makeState({ xp: XP_LEVEL_10 });
    expect(menuCapacityOf(closed)).toBe(menuCapacity(levelForXp(XP_LEVEL_10)));
    expect(menuCapacityOf(makeState(trattoria()))).toBe(menuCapacityOf(closed) + TRATTORIA_MENU_ROOM);
  });
});

describe("the stove", () => {
  it("comes after the ovens, with more burners and faster cooking once improved", () => {
    const first = ovensOf(makeState(trattoria(1)));
    expect(first.at(-1)).toEqual({ index: 1, slots: STOVE_BURNERS[1], bakeSeconds: STOVE_SECONDS[1], isWoodFired: false, isStove: true });
    const second = ovensOf(makeState(trattoria(2)));
    expect(second.at(-1)?.slots).toBe(STOVE_BURNERS[2]);
    expect(second.at(-1)?.bakeSeconds).toBeLessThan(STOVE_SECONDS[1]);
    expect(ovensOf(makeState()).some((oven) => oven.isStove)).toBe(false);
  });

  it("cooks pasta on the burners while pizzas and lasagne go in the oven", () => {
    const roomy = trattoria();
    roomy.upgrades = { ...roomy.upgrades!, oven: 3 };
    let state = stateInService([makeCustomer()], roomy);
    state = play(state, ...toggle(...CARBONARA), { type: "bake" });
    state = play(state, ...toggle(...LASAGNA), { type: "bake" });
    state = play(state, ...toggle("pate", "tomate"), { type: "bake" });
    const [carbonara, lasagna, pizza] = serviceOf(state).oven;
    const stove = ovensOf(state).find((oven) => oven.isStove);
    expect(carbonara.ovenIndex).toBe(stove?.index);
    expect(carbonara.bakeDuration).toBe(STOVE_SECONDS[1]);
    expect(lasagna.ovenIndex).toBe(0);
    expect(pizza.ovenIndex).toBe(0);
  });

  it("says the stove is full, not the oven, when every burner is taken", () => {
    let state = stateInService([makeCustomer()], trattoria());
    for (let i = 0; i < STOVE_BURNERS[1]; i++) state = play(state, ...toggle("spaghetti", "pecorino", "poivre"), { type: "bake" });
    expect(ovenWithRoom(state, serviceOf(state), ["penne", "tomate"])).toBeUndefined();
    expect(ovenWithRoom(state, serviceOf(state), ["pate", "tomate"])).toBeDefined();
    state = play(state, ...toggle("penne", "tomate"), { type: "bake" });
    expect(state.toasts.at(-1)?.key).toBe("stoveFull");
  });

  it("never offers a plate of pasta in slices", () => {
    let state = stateInService([makeCustomer(), makeCustomer({ id: "c2" })], trattoria());
    state = play(state, ...toggle("spaghetti", "pecorino", "poivre"), { type: "bake" }, { type: "tick", seconds: 10 });
    expect(canOfferSlice(state, serviceOf(state), serviceOf(state).ready[0].id)).toBe(false);
  });

  it("keeps going on gas during a power cut", () => {
    const cut = ovensOf(makeState(trattoria(1, { event: "powerCut" })));
    expect(cut.filter((oven) => !oven.isStove)).toHaveLength(1);
    expect(cut.find((oven) => oven.isStove)?.slots).toBe(STOVE_BURNERS[1]);
  });
});

describe("pasta on the menu", () => {
  it("is recognised as its classic, the pasta telling one plate from another", () => {
    const state = makeState(trattoria());
    state.recipes.push({ id: "carbonara", name: null, ingredients: [...CARBONARA], price: 12, classic: true, onMenu: true, newUntil: 0 } as never);
    expect(findRecipeByIngredients(state, [...CARBONARA])?.id).toBe("carbonara");
    expect(findRecipeByIngredients(state, ["penne", "guanciale", "oeuf", "pecorino"])).toBeUndefined();
  });

  it("asks for a pasta (or a dough) in the editor", () => {
    const { recipes } = makeState(trattoria());
    const name = (recipe: { name: string | null; id: string }) => recipe.name ?? recipe.id;
    expect(validateRecipe(recipes, "Sans base", ["tomate", "pecorino"], name)).toBe("noBase");
    expect(validateRecipe(recipes, "Pâtes du jour", ["spaghetti", "tomate", "pecorino"], name)).toBeNull();
  });

  it("is served, counted, and unlocks the pasta achievements", () => {
    let state = stateInService([makeCustomer({ recipeId: "carbonara", ingredients: [...CARBONARA], price: 12 })], trattoria());
    state = play(state, ...toggle(...CARBONARA), { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[0].id });
    expect(state.lifetime.pastaServed).toBe(1);
    expect(state.achievements.firstPasta).toBeDefined();
    expect(achievementProgress(state, "pasta100")).toEqual({ current: 1, target: 100 });
    expect(achievementProgress(state, "allPastaClassics").current).toBe(1);
  });

  it("survives a save round trip", () => {
    const state = makeState(trattoria(2));
    state.lifetime.pastaServed = 7;
    const loaded = hydrateState(toJson(state));
    expect(loaded.upgrades.trattoria).toBe(2);
    expect(loaded.lifetime.pastaServed).toBe(7);
  });
});

describe("the commis at the trattoria", () => {
  // A commis who lays the base after each bake, and two tickets: a carbonara, then a margherita.
  const withCommis = () => {
    const setup = trattoria();
    setup.upgrades = { ...setup.upgrades!, commis: 2, oven: 3 };
    setup.commis = { name: "Charlie", fatigue: 0 };
    const sato = makeCustomer({ id: "sato", recipeId: "carbonara", ingredients: [...CARBONARA], price: 12 });
    return stateInService([sato, makeCustomer({ id: "luca" })], setup);
  };

  it("lays the selected order's pasta after a bake, and follows the tabs: pizza dough, then pasta again", () => {
    let state = play(withCommis(), ...toggle(...CARBONARA), { type: "bake" });
    expect(serviceOf(state).board).toEqual(["spaghetti"]);
    const spaghetti = state.stock.spaghetti ?? 0;
    state = play(state, { type: "switchDish", dish: "pizza" });
    expect(serviceOf(state).board).toEqual(["pate"]);
    expect(state.stock.spaghetti).toBe(spaghetti + 1);
    state = play(state, { type: "switchDish", dish: "pasta" });
    expect(serviceOf(state).board).toEqual(["spaghetti"]);
  });

  it("follows the ticket picked: a pizza's dough, a plate's pasta", () => {
    let state = play(withCommis(), { type: "selectCustomer", customerId: "luca" }, ...toggle("pate"));
    state = play(state, { type: "selectCustomer", customerId: "sato" });
    expect(serviceOf(state).board).toEqual(["spaghetti"]);
    state = play(state, { type: "selectCustomer", customerId: "luca" });
    expect(serviceOf(state).board).toEqual(["pate"]);
  });

  it("stays put when a ticket is picked with the automatic switch off, still following the tabs picked by hand", () => {
    const manual = withCommis();
    manual.settings.autoDish = false;
    let state = play(manual, { type: "selectCustomer", customerId: "luca" }, ...toggle("pate"), { type: "selectCustomer", customerId: "sato" });
    expect(serviceOf(state).board).toEqual(["pate"]);
    state = play(state, { type: "switchDish", dish: "pasta" });
    expect(serviceOf(state).board).toEqual(["spaghetti"]);
  });

  it("never touches a dish already started, nor does anything without the trattoria or a commis", () => {
    const started = play(withCommis(), { type: "selectCustomer", customerId: "luca" }, ...toggle("pate", "tomate"), { type: "selectCustomer", customerId: "sato" });
    expect(serviceOf(started).board).toEqual(["pate", "tomate"]);
    const noCommis = withCommis();
    noCommis.upgrades.commis = 0;
    noCommis.commis = undefined;
    expect(serviceOf(play(noCommis, ...toggle("pate"), { type: "switchDish", dish: "pasta" })).board).toEqual(["pate"]);
    const closed = withCommis();
    closed.upgrades.trattoria = 0;
    expect(serviceOf(play(closed, ...toggle("pate"), { type: "switchDish", dish: "pasta" })).board).toEqual(["pate"]);
  });
});
