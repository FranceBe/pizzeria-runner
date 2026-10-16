import { INGREDIENTS } from "../data/ingredients.js";
import { MARGHERITA } from "../data/recipes.js";
import { createClassicRecipe } from "./menu.js";
import { detectLanguage } from "../i18n/index.js";

// The key name says v1 for history; the version actually lives in the saved `version` field.
const STORAGE_KEY = "forno-lento-save-v1";
export const SAVE_VERSION = 3;

export function createInitialState(language = detectLanguage()) {
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
    settings: { showHelp: true, language },
    phase: "prep", // prep | service | summary
    purchasesToday: 0,
    lastNonnaVisitDay: 0,
    service: null,
    summary: null,
    toasts: [],
    pops: [],
  };
}

/* ---------------------------------------------------------------
   Save migrations. Each step upgrades a save by one version; they run in order.
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

// Version 1: saves written before the code cleanup, with short field names.
function migrateFromVersion1(saved) {
  const { v, ...rest } = renameKeys(saved, { nonnaDay: "lastNonnaVisitDay" });
  return {
    ...rest,
    recipes: (rest.recipes || []).map((recipe) => renameKeys(recipe, { ings: "ingredients" })),
    settings: renameKeys(rest.settings, { help: "showHelp" }),
    service: migrateService(rest.service),
    summary: renameKeys(rest.summary, { best: "bestSeller" }),
  };
}

// Version 2: sales were counted by recipe name, which can't be translated.
// Old entries keep their name and simply show it as is.
function migrateFromVersion2(saved) {
  const result = { ...saved };
  if (result.service?.stats) {
    const byRecipe = Object.fromEntries(
      Object.entries(result.service.stats.byRecipe || {}).map(([name, count]) => [name, { name, count }]),
    );
    result.service = { ...result.service, stats: { ...result.service.stats, byRecipe } };
  }
  if (Array.isArray(result.summary?.bestSeller)) {
    const [name, count] = result.summary.bestSeller;
    result.summary = { ...result.summary, bestSeller: { recipeId: name, name, count } };
  }
  return result;
}

// MIGRATIONS[n] upgrades a version n + 1 save to version n + 2.
const MIGRATIONS = [migrateFromVersion1, migrateFromVersion2];

// Saves from before versioning have neither `version` nor `v`: they are version 1.
const versionOf = (saved) => saved.version ?? saved.v ?? 1;

export function migrateSave(saved) {
  let migrated = saved;
  for (let version = versionOf(saved); version < SAVE_VERSION; version++) {
    migrated = MIGRATIONS[version - 1](migrated);
  }
  return migrated === saved ? saved : { ...migrated, version: SAVE_VERSION };
}

// Fills in anything a save from an older version is missing.
export function hydrateState(saved) {
  const migrated = migrateSave(saved);
  const defaults = createInitialState();
  return {
    ...defaults,
    ...migrated,
    toasts: [],
    pops: [],
    upgrades: { ...defaults.upgrades, ...(migrated.upgrades || {}) },
    settings: { ...defaults.settings, ...(migrated.settings || {}) },
    stock: migrated.stock || defaults.stock,
    unlocked: { ...defaults.unlocked, ...(migrated.unlocked || {}) },
  };
}

// Toasts and pops are transient UI feedback, not worth saving.
export function toSaveData(state) {
  const { toasts, pops, ...saveData } = state;
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
