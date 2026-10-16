import { INGREDIENTS } from "../data/ingredients.js";
import { MARGHERITA } from "../data/recipes.js";
import { createClassicRecipe } from "./menu.js";

// The key name says v1 for history; the version actually lives in the saved `version` field.
const STORAGE_KEY = "forno-lento-save-v1";
export const SAVE_VERSION = 2;

export function createInitialState() {
  const unlocked = {};
  INGREDIENTS.filter((ingredient) => ingredient.supplierFee === 0).forEach((ingredient) => (unlocked[ingredient.id] = true));
  return {
    version: SAVE_VERSION,
    name: "Forno Lento",
    money: 20,
    debt: 0,
    day: 1,
    xp: 0,
    stock: { pate: 8, tomate: 8, mozza: 8, basilic: 8 },
    unlocked,
    recipes: [createClassicRecipe(MARGHERITA, { onMenu: true, newUntil: 0 })],
    upgrades: { oven: 0, salle: 0, deco: 0, commis: 0 },
    settings: { showHelp: true },
    phase: "prep", // prep | service | summary
    purchasesToday: 0,
    lastNonnaVisitDay: 0,
    service: null,
    summary: null,
    toasts: [],
  };
}

/* ---------------------------------------------------------------
   Migration of saves written before the code cleanup (version 1, short field names)
---------------------------------------------------------------- */
function renameKeys(object, renames) {
  if (!object) return object;
  const result = { ...object };
  Object.entries(renames).forEach(([oldKey, newKey]) => {
    if (oldKey in result) {
      result[newKey] = result[oldKey];
      delete result[oldKey];
    }
  });
  return result;
}

function migrateService(service) {
  if (!service) return service;
  const { total, ...rest } = renameKeys(service, {
    toSpawn: "customersToCome",
    spawnTimer: "nextArrivalIn",
    selected: "selectedCustomerId",
  });
  return {
    ...rest,
    customers: (rest.customers || []).map((customer) =>
      renameKeys(customer, {
        ings: "ingredients",
        add: "extraIngredient",
        rem: "removedIngredient",
        waited: "waitedSeconds",
        sayIdx: "lineIndex",
      }),
    ),
    oven: (rest.oven || []).map((pizza) =>
      renameKeys(pizza, { uid: "id", ings: "ingredients", t: "bakedSeconds", dur: "bakeDuration" }),
    ),
    ready: (rest.ready || []).map((pizza) => renameKeys(pizza, { uid: "id", ings: "ingredients" })),
  };
}

export function migrateSave(saved) {
  if ((saved.version ?? 0) >= SAVE_VERSION) return saved;
  const { v, ...rest } = renameKeys(saved, { nonnaDay: "lastNonnaVisitDay" });
  return {
    ...rest,
    version: SAVE_VERSION,
    recipes: (rest.recipes || []).map((recipe) => renameKeys(recipe, { ings: "ingredients" })),
    settings: renameKeys(rest.settings, { help: "showHelp" }),
    service: migrateService(rest.service),
  };
}

// Fills in anything a save from an older version is missing.
export function hydrateState(saved) {
  const migrated = migrateSave(saved);
  const defaults = createInitialState();
  return {
    ...defaults,
    ...migrated,
    toasts: [],
    upgrades: { ...defaults.upgrades, ...(migrated.upgrades || {}) },
    settings: { ...defaults.settings, ...(migrated.settings || {}) },
    stock: migrated.stock || defaults.stock,
    unlocked: { ...defaults.unlocked, ...(migrated.unlocked || {}) },
  };
}

// Toasts are transient UI messages, not worth saving.
export function toSaveData(state) {
  const { toasts, ...saveData } = state;
  return saveData;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? hydrateState(JSON.parse(raw)) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaveData(state)));
  } catch {
    // Storage full or blocked (private browsing): the game keeps running, it just won't persist.
  }
}
