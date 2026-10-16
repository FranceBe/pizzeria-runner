import { INGREDIENTS, type IngredientId } from "../data/ingredients";
import { MARGHERITA } from "../data/recipes";
import { detectLanguage, type Language } from "../i18n/languages";
import type { JsonObject } from "../utils/saveCode";
import { createClassicRecipe } from "./menu";
import type { GameState, SaveData } from "./types";

// The key name says v1 for history; the version actually lives in the saved `version` field.
const STORAGE_KEY = "forno-lento-save-v1";
export const SAVE_VERSION = 3;

export function createInitialState(language: Language = detectLanguage()): GameState {
  const unlocked: Partial<Record<IngredientId, boolean>> = {};
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
    settings: { showHelp: true, language, tutorialDone: false },
    phase: "prep",
    purchasesToday: 0,
    lastNonnaVisitDay: 0,
    customerBook: {},
    service: null,
    summary: null,
    toasts: [],
    pops: [],
  };
}

/* ---------------------------------------------------------------
   Save migrations. Each step upgrades a save by one version; they run in order.
   Saves are untrusted JSON, so this section works on plain objects and only
   hydrateState turns the result into a GameState.
---------------------------------------------------------------- */
const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined;

const asObjectList = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.map(asObject).filter((item): item is JsonObject => item !== undefined) : [];

function renameKeys(object: JsonObject, renames: Record<string, string>): JsonObject {
  const result = { ...object };
  Object.entries(renames).forEach(([oldKey, newKey]) => {
    if (oldKey in result) {
      result[newKey] = result[oldKey];
      delete result[oldKey];
    }
  });
  return result;
}

const renameKeysIfObject = (value: unknown, renames: Record<string, string>): unknown => {
  const object = asObject(value);
  return object ? renameKeys(object, renames) : value;
};

function migrateService(value: unknown): unknown {
  const service = asObject(value);
  if (!service) return value;
  const { total, ...rest } = renameKeys(service, {
    toSpawn: "customersToCome",
    spawnTimer: "nextArrivalIn",
    selected: "selectedCustomerId",
  });
  return {
    ...rest,
    customers: asObjectList(rest.customers).map((customer) =>
      renameKeys(customer, {
        ings: "ingredients",
        add: "extraIngredient",
        rem: "removedIngredient",
        waited: "waitedSeconds",
        sayIdx: "lineIndex",
      }),
    ),
    oven: asObjectList(rest.oven).map((pizza) =>
      renameKeys(pizza, { uid: "id", ings: "ingredients", t: "bakedSeconds", dur: "bakeDuration" }),
    ),
    ready: asObjectList(rest.ready).map((pizza) => renameKeys(pizza, { uid: "id", ings: "ingredients" })),
  };
}

// Version 1: saves written before the code cleanup, with short field names.
function migrateFromVersion1(saved: JsonObject): JsonObject {
  const { v, ...rest } = renameKeys(saved, { nonnaDay: "lastNonnaVisitDay" });
  return {
    ...rest,
    recipes: asObjectList(rest.recipes).map((recipe) => renameKeys(recipe, { ings: "ingredients" })),
    settings: renameKeysIfObject(rest.settings, { help: "showHelp" }),
    service: migrateService(rest.service),
    summary: renameKeysIfObject(rest.summary, { best: "bestSeller" }),
  };
}

// Version 2: sales were counted by recipe name, which can't be translated.
// Old entries keep their name and simply show it as is.
function migrateFromVersion2(saved: JsonObject): JsonObject {
  const result = { ...saved };
  const service = asObject(result.service);
  const stats = asObject(service?.stats);
  if (service && stats) {
    const byRecipe = Object.fromEntries(
      Object.entries(asObject(stats.byRecipe) ?? {}).map(([name, count]) => [name, { name, count }]),
    );
    result.service = { ...service, stats: { ...stats, byRecipe } };
  }
  const summary = asObject(result.summary);
  if (summary && Array.isArray(summary.bestSeller)) {
    const [name, count] = summary.bestSeller;
    result.summary = { ...summary, bestSeller: { recipeId: name, name, count } };
  }
  return result;
}

// MIGRATIONS[n] upgrades a version n + 1 save to version n + 2.
const MIGRATIONS: readonly ((saved: JsonObject) => JsonObject)[] = [migrateFromVersion1, migrateFromVersion2];

// Saves from before versioning have neither `version` nor `v`: they are version 1.
const versionOf = (saved: JsonObject): number =>
  typeof saved.version === "number" ? saved.version : typeof saved.v === "number" ? saved.v : 1;

export function migrateSave(saved: JsonObject): JsonObject {
  let migrated = saved;
  for (let version = versionOf(saved); version < SAVE_VERSION; version++) {
    migrated = MIGRATIONS[version - 1](migrated);
  }
  return migrated === saved ? saved : { ...migrated, version: SAVE_VERSION };
}

// Fills in anything a save from an older version is missing.
export function hydrateState(saved: JsonObject): GameState {
  // Past this point the save is trusted to have the current shape: migrations took care of older ones.
  const migrated = migrateSave(saved) as Partial<GameState>;
  const defaults = createInitialState();
  return {
    ...defaults,
    ...migrated,
    toasts: [],
    pops: [],
    upgrades: { ...defaults.upgrades, ...migrated.upgrades },
    settings: { ...defaults.settings, ...migrated.settings },
    stock: migrated.stock ?? defaults.stock,
    unlocked: { ...defaults.unlocked, ...migrated.unlocked },
    customerBook: migrated.customerBook ?? {},
  };
}

// Toasts and pops are transient UI feedback, not worth saving.
export function toSaveData(state: GameState): SaveData {
  const { toasts, pops, ...saveData } = state;
  return saveData;
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? asObject(JSON.parse(raw)) : undefined;
    return saved ? hydrateState(saved) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaveData(state)));
  } catch {
    // Storage full or blocked (private browsing): the game keeps running, it just won't persist.
  }
}
