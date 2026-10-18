import { INGREDIENTS, INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import { MARGHERITA } from "../data/recipes";
import { detectLanguage, type Language } from "../i18n/languages";
import type { JsonObject } from "../utils/saveCode";
import type { AccessoryId } from "../data/customers";
import { unlockAchievements } from "./achievements";
import { fitAccessory } from "./looks";
import { createClassicRecipe } from "./menu";
import { goodPairingsIn, pairingKey } from "./pairings";
import type { GameState, LifetimeStats, SaveData } from "./types";

// The key name says v1 for history; the version actually lives in the saved `version` field.
const STORAGE_KEY = "forno-lento-save-v1";
export const SAVE_VERSION = 8;

const emptyLifetimeStats = (): LifetimeStats => ({
  served: 0,
  revenue: 0,
  tips: 0,
  happyServed: 0,
  asUsualServed: 0,
  deliveries: 0,
  criticsPleased: 0,
  wasteFreeDays: 0,
  bestDay: null,
  byRecipe: {},
  sweetServed: 0,
  drinksSold: 0,
  happyTables: 0,
  birthdays: 0,
  questsDone: 0,
  dailyChallenges: 0,
  questRewards: 0,
});

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
    upgrades: { oven: 0, salle: 0, deco: 0, commis: 0, terrasse: 0, livraison: 0, bar: 0, oven2: 0, oven3: 0, annexe: 0 },
    settings: { showHelp: true, language, theme: "auto", largeText: false, tutorialDone: false },
    phase: "prep",
    purchasesToday: 0,
    lastNonnaVisitDay: 0,
    lastNonnaLoanDay: 0,
    dayStart: null,
    customerBook: {},
    event: null,
    chefSpecial: null,
    discoveredPairings: [],
    achievements: {},
    history: [],
    lifetime: emptyLifetimeStats(),
    bestChallengeScore: 0,
    challengeResult: null,
    dailyChallenge: null,
    quest: null,
    questLog: [],
    cosmetics: { owned: ["awning:red", "sign:classic", "wall:mint"], awning: "red", sign: "classic", wall: "mint" },
    secretIngredient: false,
    secretStock: 0,
    secretCodeFound: false,
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

const isIngredientId = (value: unknown): value is IngredientId => typeof value === "string" && value in INGREDIENTS_BY_ID;

// Version 3: before the journal. Pairings already used in the player's recipes count as discovered,
// so the recipe editor keeps showing them; the customer book gives a fair count of pizzas served.
function migrateFromVersion3(saved: JsonObject): JsonObject {
  const discovered = new Set<string>();
  asObjectList(saved.recipes).forEach((recipe) => {
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(isIngredientId) : [];
    goodPairingsIn(ingredients).forEach((pairing) => discovered.add(pairingKey(pairing)));
  });
  const served = Object.values(asObject(saved.customerBook) ?? {})
    .map((entry) => asObject(entry)?.visits)
    .reduce<number>((total, visits) => total + (typeof visits === "number" ? visits : 0), 0);
  return { ...saved, discoveredPairings: [...discovered], lifetime: { ...emptyLifetimeStats(), served } };
}

// Version 4: before seasons, tables, drinks, quests and the daily challenge. Everything new starts empty,
// which hydrateState fills in; challenge results from version 4 have no date, so they are dropped.
const migrateFromVersion4 = ({ challengeResult, ...saved }: JsonObject): JsonObject => saved;

// Version 5: before accessories and Nonna's secret. Everything new is optional or has a default.
const migrateFromVersion5 = (saved: JsonObject): JsonObject => saved;

// Version 6: before pauses, closing early, restarting the day and Nonna's loans. The new fields have defaults.
const migrateFromVersion6 = (saved: JsonObject): JsonObject => saved;

// Version 7: faces were drawn without looking at names. Feminine names lose any moustache or beard they were given.
function migrateFromVersion7(saved: JsonObject): JsonObject {
  const book = asObject(saved.customerBook);
  if (!book) return saved;
  const customerBook = Object.fromEntries(
    Object.entries(book).map(([name, value]) => {
      const entry = asObject(value);
      if (!entry || typeof entry.accessory !== "string") return [name, value];
      // Unknown accessories pass through untouched; only facial hair is checked.
      return [name, { ...entry, accessory: fitAccessory(name, entry.accessory as AccessoryId) }];
    }),
  );
  return { ...saved, customerBook };
}

// MIGRATIONS[n] upgrades a version n + 1 save to version n + 2.
const MIGRATIONS: readonly ((saved: JsonObject) => JsonObject)[] = [
  migrateFromVersion1,
  migrateFromVersion2,
  migrateFromVersion3,
  migrateFromVersion4,
  migrateFromVersion5,
  migrateFromVersion6,
  migrateFromVersion7,
];

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
  const state: GameState = {
    ...defaults,
    ...migrated,
    toasts: [],
    pops: [],
    upgrades: { ...defaults.upgrades, ...migrated.upgrades },
    settings: { ...defaults.settings, ...migrated.settings },
    stock: migrated.stock ?? defaults.stock,
    unlocked: { ...defaults.unlocked, ...migrated.unlocked },
    customerBook: migrated.customerBook ?? {},
    lifetime: { ...defaults.lifetime, ...migrated.lifetime },
    cosmetics: { ...defaults.cosmetics, ...migrated.cosmetics },
  };
  // Records, without a toast, what an older save had already earned.
  unlockAchievements(state, { silent: true });
  return state;
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

// Starts over after a crash, keeping the broken save aside (under BROKEN_SAVE_KEY) rather than deleting it.
const BROKEN_SAVE_KEY = "forno-lento-broken-save";
export function setBrokenSaveAside(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localStorage.setItem(BROKEN_SAVE_KEY, raw);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was saved in the first place.
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaveData(state)));
  } catch {
    // Storage full or blocked (private browsing): the game keeps running, it just won't persist.
  }
}
