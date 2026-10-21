import { describe, it, expect, vi, afterEach } from "vitest";
import { WOOD_FIRED_TIP_BONUS, WOOD_FIRED_XP_BONUS } from "../data/progression";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { rollTip, tipChance } from "./customers";
import { findRecipeByIngredients } from "./menu";
import { appealOf, isDessert } from "./pizza";
import { ovensOf, ovenSlots, shownEvent } from "./service";
import { hydrateState } from "./state";
import { shortcutAction } from "./shortcuts";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const withUpgrades = (upgrades: Partial<GameState["upgrades"]>, overrides: Partial<GameState> = {}): Partial<GameState> => ({
  ...overrides,
  upgrades: { ...makeState().upgrades, ...upgrades },
});

describe("ovens", () => {
  it("are two at most, two pizzas each: the second starts with one slow slot, then improves like the first", () => {
    const state = makeState(withUpgrades({ oven: 3, oven2: 1 }));
    expect(ovensOf(state)).toEqual([
      { index: 0, slots: 2, bakeSeconds: 3, isWoodFired: true },
      { index: 1, slots: 1, bakeSeconds: 6, isWoodFired: false },
    ]);
    expect(ovenSlots(makeState(withUpgrades({ oven: 3, oven2: 4 })))).toBe(4);
  });

  it("take a pizza when the first oven is full, and bake it at their own speed", () => {
    let state = stateInService([makeCustomer()], withUpgrades({ oven2: 1 }));
    state = play(state, ...toggle("pate"), { type: "bake" }, ...toggle("pate"), { type: "bake" });
    expect(serviceOf(state).oven.map((pizza) => [pizza.ovenIndex, pizza.bakeDuration])).toEqual([[0, 6], [1, 6]]);
    state = play(state, ...toggle("pate"), { type: "bake" });
    expect(state.toasts.at(-1)?.key).toBe("ovenFull");
  });

  it("make better pizzas once wood-fired: more reputation, a tip more likely", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const serve = (ovenLevel: number) => {
      const baked = play(stateInService([makeCustomer()], withUpgrades({ oven: ovenLevel })), ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
      expect(serviceOf(baked).ready[0].woodFired).toBe(ovenLevel === 3);
      return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    };
    expect(serve(3).xp - serve(2).xp).toBe(WOOD_FIRED_XP_BONUS);
    const customer = makeCustomer();
    vi.spyOn(Math, "random").mockReturnValue(tipChance(makeState(), customer) + WOOD_FIRED_TIP_BONUS / 2);
    expect(rollTip(makeState(), customer)).toBe(0);
    expect(rollTip(makeState(), customer, WOOD_FIRED_TIP_BONUS)).toBeGreaterThan(0);
  });

  it("go down to one pizza at a time on a power cut, the wood-fired one if there is one, told as missing wood when all burn wood", () => {
    const cut = (upgrades: Partial<GameState["upgrades"]>) => makeState(withUpgrades(upgrades, { event: "powerCut" }));
    expect(ovensOf(cut({ oven: 1, oven2: 4 }))).toEqual([{ index: 1, slots: 1, bakeSeconds: 3, isWoodFired: true }]);
    expect(shownEvent(cut({ oven: 1, oven2: 4 }), "powerCut")).toBe("powerCut");
    expect(shownEvent(cut({ oven: 3, oven2: 4 }), "powerCut")).toBe("woodShortage");
    expect(shownEvent(cut({ oven: 3 }), "powerCut")).toBe("woodShortage");
  });

  it("lose the third oven of older saves, with everything paid for it back in the till", () => {
    const old = { ...makeState({ money: 100 }), version: 10, upgrades: { ...makeState().upgrades, oven3: 2 } };
    const state = hydrateState(toJson(old));
    expect(state.money).toBe(100 + 1100 + 600);
    expect("oven3" in state.upgrades).toBe(false);
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

describe("dessert pizzas", () => {
  it("need neither cheese nor sauce, but don't mix with meat", () => {
    const choco = ["pate", "chocolat", "banane", "noisette"] as const;
    expect(isDessert(choco)).toBe(true);
    expect(isDessert(["pate", "tomate", "mozza", "miel"])).toBe(false);
    expect(appealOf(choco, true)).toBeGreaterThan(appealOf(["pate", "chocolat", "banane", "salami"], true));
    expect(appealOf(["pate", "banane", "fraise"], false)).toBeGreaterThan(appealOf(["pate", "jambon", "champi"], false) - 0.2);
  });
});
