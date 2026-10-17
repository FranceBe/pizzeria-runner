import { describe, it, expect } from "vitest";
import { makeState, toJson } from "../test/helpers";
import { createInitialState, hydrateState, migrateSave, toSaveData, SAVE_VERSION } from "./state";

// A save as written by the game before the code cleanup (short field names, no `version`).
const VERSION_1_SAVE = {
  v: 1,
  name: "Chez Moi",
  money: 42,
  debt: 0,
  day: 3,
  xp: 120,
  stock: { pate: 5 },
  unlocked: { pate: true, tomate: true, mozza: true, basilic: true },
  recipes: [{ id: "margherita", name: "Margherita", ings: ["pate", "tomate", "mozza", "basilic"], price: 7, classic: true, custom: false, onMenu: true, newUntil: 0 }],
  upgrades: { oven: 1, salle: 0, deco: 0, commis: 0 },
  settings: { help: false },
  phase: "service",
  purchasesToday: 0,
  nonnaDay: 2,
  service: {
    toSpawn: 2,
    total: 5,
    spawnTimer: 1,
    customers: [{ id: "a", name: "Luca", ings: ["pate", "tomate"], add: null, rem: "mozza", price: 7, waited: 12, sayIdx: 1 }],
    board: ["pate"],
    oven: [{ uid: "p1", ings: ["pate", "tomate"], t: 1, dur: 4.5 }],
    ready: [{ uid: "p2", ings: ["pate"] }],
    selected: "a",
    stats: { served: 1, revenue: 7, tips: 0, waste: 0, xp: 10, levelUps: [], byRecipe: {} },
  },
  summary: { day: 3, best: ["Margherita", 4] },
};

describe("createInitialState", () => {
  it("starts with the margherita and the free suppliers", () => {
    const state = createInitialState("en");
    expect(state.recipes.map((r) => r.id)).toEqual(["margherita"]);
    expect(Object.keys(state.unlocked)).toEqual(["pate", "tomate", "mozza", "basilic"]);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.settings).toMatchObject({ language: "en", tutorialDone: false });
    expect(state.customerBook).toEqual({});
  });
});

describe("migrateSave", () => {
  // Migrated saves are still untyped JSON, so these assertions go by path.
  const migrated = migrateSave(VERSION_1_SAVE);

  it("renames recipe and settings fields", () => {
    expect(migrated).toHaveProperty("recipes.0.ingredients", ["pate", "tomate", "mozza", "basilic"]);
    expect(migrated).not.toHaveProperty("recipes.0.ings");
    expect(migrated).toHaveProperty("settings.showHelp", false);
    expect(migrated).toMatchObject({ lastNonnaVisitDay: 2, version: SAVE_VERSION });
    expect(migrated).not.toHaveProperty("v");
  });

  it("migrates a service that was in progress", () => {
    expect(migrated).toMatchObject({ service: { customersToCome: 2, nextArrivalIn: 1, selectedCustomerId: "a" } });
    expect(migrated).not.toHaveProperty("service.total");
    expect(migrated).toHaveProperty("service.customers.0", expect.objectContaining({
      ingredients: ["pate", "tomate"], removedIngredient: "mozza", waitedSeconds: 12, lineIndex: 1,
    }));
    expect(migrated).toHaveProperty("service.oven.0", { id: "p1", ingredients: ["pate", "tomate"], bakedSeconds: 1, bakeDuration: 4.5 });
    expect(migrated).toHaveProperty("service.ready.0", { id: "p2", ingredients: ["pate"] });
  });

  it("converts sales counted by name (versions 1 and 2) into the current format", () => {
    expect(migrated).toHaveProperty("summary.bestSeller", { recipeId: "Margherita", name: "Margherita", count: 4 });
    const version2 = { version: 2, money: 1, recipes: [], service: { stats: { byRecipe: { Regina: 2 } } } };
    expect(migrateSave(version2)).toHaveProperty("service.stats.byRecipe", { Regina: { name: "Regina", count: 2 } });
  });

  it("leaves current saves untouched", () => {
    const current = toJson(createInitialState("fr"));
    expect(migrateSave(current)).toBe(current);
  });
});

describe("hydrateState", () => {
  it("fills in fields missing from old saves", () => {
    const state = hydrateState({ money: 5, recipes: [] });
    expect(state.upgrades).toEqual({ oven: 0, salle: 0, deco: 0, commis: 0, terrasse: 0, livraison: 0, bar: 0, oven2: 0, oven3: 0, annexe: 0 });
    expect(state.toasts).toEqual([]);
    expect(state.money).toBe(5);
  });
});

describe("toSaveData", () => {
  it("drops toasts and money pops", () => {
    const state = makeState({ toasts: [{ id: "x", key: "ovenFull", kind: "" }], pops: [{ id: "y", amount: 7, kind: "money" }] });
    const saveData = toSaveData(state);
    expect(saveData).not.toHaveProperty("toasts");
    expect(saveData).not.toHaveProperty("pops");
    expect(saveData.money).toBe(state.money);
  });
});
