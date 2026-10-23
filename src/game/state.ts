import { ensureTonightGoal } from "./tonight";
import { ensureRushPlan } from "./evening";
import { weekOf } from "./weekly";
import { INGREDIENTS, INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import { MARGHERITA } from "../data/recipes";
import { LANGUAGES, detectLanguage, type Language } from "../i18n/languages";
import type { JsonObject } from "../utils/saveCode";
import type { AccessoryId } from "../data/customers";
import { unlockAchievements } from "./achievements";
import { fitAccessory } from "./looks";
import { createClassicRecipe } from "./menu";
import { goodPairingsIn, pairingKey } from "./pairings";
import type { GameState, LifetimeStats, SaveData } from "./types";
import { LOCALS_COUNT, MAX_REGULARS, REGULAR_SAME_ORDERS } from "./regulars";

// The key name says v1 for history; the version actually lives in the saved `version` field.
const STORAGE_KEY = "forno-lento-save-v1";
export const SAVE_VERSION = 12;

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
  stars: 0,
  bestStreak: 0,
  celebrities: 0,
  batchGolds: 0,
});

export const createInitialState = (language: Language = detectLanguage()): GameState => {
  const unlocked: Partial<Record<IngredientId, boolean>> = {};
  // Free from the start, except festival ingredients, which follow the calendar (see game/calendar.ts).
  INGREDIENTS.filter((ingredient) => ingredient.supplierFee === 0 && !ingredient.festival).forEach((ingredient) => (unlocked[ingredient.id] = true));
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
    upgrades: { oven: 0, salle: 0, deco: 0, commis: 0, drawer: 0, terrasse: 0, livraison: 0, bar: 0, oven2: 0, annexe: 0 },
    settings: {
      showHelp: true,
      language,
      theme: "auto",
      largeText: false,
      // Low at first: the game may open from a shared link, in an office or on a train.
      musicVolume: 0.08,
      effectsVolume: 0.2,
      musicMuted: false,
      effectsMuted: false,
      tutorialDone: false,
      useDrawer: true,
      commisFade: true,
      playerName: "",
    },
    phase: "prep",
    purchasesToday: 0,
    lastNonnaVisitDay: 0,
    lastNonnaLoanDay: 0,
    dayStart: null,
    customerBook: {},
    event: null,
    special: null,
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
    mammaSecret: false,
    reviews: [],
    reviewScore: { count: 0, total: 0 },
    press: [],
    locals: [],
    mammaStock: 0,
    lateIngredient: null,
    festival: null,
    weekly: null,
    tonightGoal: null,
    rushPlan: null,
    competitor: null,
    postcards: {},
    celebrityWall: [],
    secretCodeFound: false,
    service: null,
    summary: null,
    toasts: [],
    pops: [],
  };
};

/* ---------------------------------------------------------------
   Save migrations. Each step upgrades a save by one version; they run in order.
   Saves are untrusted JSON, so this section works on plain objects and only
   hydrateState turns the result into a GameState.
---------------------------------------------------------------- */
const asObject = (value: unknown): JsonObject | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined;

const asObjectList = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.map(asObject).filter((item): item is JsonObject => item !== undefined) : [];

const renameKeys = (object: JsonObject, renames: Record<string, string>): JsonObject => {
  const result = { ...object };
  Object.entries(renames).forEach(([oldKey, newKey]) => {
    if (oldKey in result) {
      result[newKey] = result[oldKey];
      delete result[oldKey];
    }
  });
  return result;
};

const renameKeysIfObject = (value: unknown, renames: Record<string, string>): unknown => {
  const object = asObject(value);
  return object ? renameKeys(object, renames) : value;
};

const migrateService = (value: unknown): unknown => {
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
};

// Version 1: saves written before the code cleanup, with short field names.
const migrateFromVersion1 = (saved: JsonObject): JsonObject => {
  const { v, ...rest } = renameKeys(saved, { nonnaDay: "lastNonnaVisitDay" });
  return {
    ...rest,
    recipes: asObjectList(rest.recipes).map((recipe) => renameKeys(recipe, { ings: "ingredients" })),
    settings: renameKeysIfObject(rest.settings, { help: "showHelp" }),
    service: migrateService(rest.service),
    summary: renameKeysIfObject(rest.summary, { best: "bestSeller" }),
  };
};

// Version 2: sales were counted by recipe name, which can't be translated.
// Old entries keep their name and simply show it as is.
const migrateFromVersion2 = (saved: JsonObject): JsonObject => {
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
};

const isIngredientId = (value: unknown): value is IngredientId => typeof value === "string" && value in INGREDIENTS_BY_ID;

// Version 3: before the journal. Pairings already used in the player's recipes count as discovered,
// so the recipe editor keeps showing them; the customer book gives a fair count of pizzas served.
const migrateFromVersion3 = (saved: JsonObject): JsonObject => {
  const discovered = new Set<string>();
  asObjectList(saved.recipes).forEach((recipe) => {
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(isIngredientId) : [];
    goodPairingsIn(ingredients).forEach((pairing) => discovered.add(pairingKey(pairing)));
  });
  const served = Object.values(asObject(saved.customerBook) ?? {})
    .map((entry) => asObject(entry)?.visits)
    .reduce<number>((total, visits) => total + (typeof visits === "number" ? visits : 0), 0);
  return { ...saved, discoveredPairings: [...discovered], lifetime: { ...emptyLifetimeStats(), served } };
};

// Version 4: before seasons, tables, drinks, quests and the daily challenge. Everything new starts empty,
// which hydrateState fills in; challenge results from version 4 have no date, so they are dropped.
const migrateFromVersion4 = ({ challengeResult, ...saved }: JsonObject): JsonObject => saved;

// Version 5: before accessories and Nonna's secret. Everything new is optional or has a default.
const migrateFromVersion5 = (saved: JsonObject): JsonObject => saved;

// Version 6: before pauses, closing early, restarting the day and Nonna's loans. The new fields have defaults.
const migrateFromVersion6 = (saved: JsonObject): JsonObject => saved;

// Version 7: faces were drawn without looking at names. Feminine names lose any moustache or beard they were given.
const migrateFromVersion7 = (saved: JsonObject): JsonObject => {
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
};

// Version 8: before group orders, incidents, streaks, stars, weekly missions, celebrities and festivals.
// Everything new has a default; a quest already running keeps working as it was.
const migrateFromVersion8 = (saved: JsonObject): JsonObject => saved;

// Version 9: anyone with the same pizza ordered three times was a regular, and there could be dozens. Being a regular
// is now a status (see regulars.ts), at most MAX_REGULARS at a time: the most frequent visitors among the old ones keep
// it, and join the neighbourhood if they weren't in it. Everyone's orders so far count as made with a choice.
const migrateFromVersion9 = (saved: JsonObject): JsonObject => {
  const book = asObject(saved.customerBook);
  if (!book) return saved;
  const entries = Object.entries(book).flatMap(([name, value]) => {
    const entry = asObject(value);
    return entry ? [{ name, entry }] : [];
  });
  const timesOrdered = (entry: JsonObject) =>
    Math.max(0, ...Object.values(asObject(entry.orders) ?? {}).filter((count): count is number => typeof count === "number"));
  const visits = (entry: JsonObject) => (typeof entry.visits === "number" ? entry.visits : 0);
  const keep = new Set(
    entries
      .filter(({ entry }) => timesOrdered(entry) >= REGULAR_SAME_ORDERS && entry.lapsed !== true)
      .sort((a, b) => visits(b.entry) - visits(a.entry))
      .slice(0, MAX_REGULARS)
      .map(({ name }) => name),
  );
  const customerBook = Object.fromEntries(
    entries.map(({ name, entry }) => {
      const { lapsed, ...rest } = entry;
      return [name, { ...rest, choiceOrders: rest.orders, ...(keep.has(name) ? { regular: true } : {}) }];
    }),
  );
  const oldLocals = Array.isArray(saved.locals) ? saved.locals.filter((name): name is string => typeof name === "string") : [];
  const locals = [...new Set([...keep, ...oldLocals])].slice(0, LOCALS_COUNT);
  return { ...saved, customerBook, locals };
};

// Version 10: there was a third oven. It is gone (two ovens of two pizzas are plenty): whatever was paid for it comes
// back to the till, and its evening charges go with it.
const THIRD_OVEN_COSTS = [1100, 600, 1100, 1800];
const migrateFromVersion10 = (saved: JsonObject): JsonObject => {
  const upgrades = asObject(saved.upgrades);
  if (!upgrades || typeof upgrades.oven3 !== "number") return saved;
  const { oven3, ...rest } = upgrades;
  const refund = THIRD_OVEN_COSTS.slice(0, oven3).reduce((total, cost) => total + cost, 0);
  const money = (typeof saved.money === "number" ? saved.money : 0) + refund;
  return { ...saved, upgrades: rest, money };
};

// Version 11: the chef's special, kept until changed, became the week's special. The one in place becomes this week's.
const migrateFromVersion11 = ({ chefSpecial, ...saved }: JsonObject): JsonObject => {
  if (typeof chefSpecial !== "string" || typeof saved.day !== "number") return saved;
  return { ...saved, special: { recipeId: chefSpecial, week: weekOf(saved.day), chosenDay: saved.day, served: 0 } };
};

// MIGRATIONS[n] upgrades a version n + 1 save to version n + 2.
const MIGRATIONS: readonly ((saved: JsonObject) => JsonObject)[] = [
  migrateFromVersion1,
  migrateFromVersion2,
  migrateFromVersion3,
  migrateFromVersion4,
  migrateFromVersion5,
  migrateFromVersion6,
  migrateFromVersion7,
  migrateFromVersion8,
  migrateFromVersion9,
  migrateFromVersion10,
  migrateFromVersion11,
];

// Saves from before versioning have neither `version` nor `v`: they are version 1.
const versionOf = (saved: JsonObject): number =>
  typeof saved.version === "number" ? saved.version : typeof saved.v === "number" ? saved.v : 1;

export const migrateSave = (saved: JsonObject): JsonObject => {
  let migrated = saved;
  for (let version = versionOf(saved); version < SAVE_VERSION; version++) {
    migrated = MIGRATIONS[version - 1](migrated);
  }
  return migrated === saved ? saved : { ...migrated, version: SAVE_VERSION };
};

// Fills in anything a save from an older version is missing.
export const hydrateState = (saved: JsonObject): GameState => {
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
  // A morning without tonight's goal yet (a save from before goals, or a new game set up): it gets one now.
  if (state.phase === "prep") {
    ensureTonightGoal(state);
    ensureRushPlan(state);
  }
  return state;
};

// Toasts and pops are transient UI feedback, not worth saving.
export const toSaveData = (state: GameState): SaveData => {
  const { toasts, pops, ...saveData } = state;
  return saveData;
};

// The language the game will open in: the saved game's, or the browser's for a first visit. Read before the game
// itself, so its texts can be loaded first.
export const savedLanguage = (): Language => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { settings?: { language?: unknown } } | null;
    const language = saved?.settings?.language;
    return LANGUAGES.find((candidate) => candidate === language) ?? detectLanguage();
  } catch {
    return detectLanguage();
  }
};

export const loadState = (): GameState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? asObject(JSON.parse(raw)) : undefined;
    return saved ? hydrateState(saved) : createInitialState();
  } catch {
    return createInitialState();
  }
};

// Starts over after a crash, keeping the broken save aside (under BROKEN_SAVE_KEY) rather than deleting it.
const BROKEN_SAVE_KEY = "forno-lento-broken-save";
export const setBrokenSaveAside = (): void => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localStorage.setItem(BROKEN_SAVE_KEY, raw);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was saved in the first place.
  }
};

export const saveState = (state: GameState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaveData(state)));
  } catch {
    // Storage full or blocked (private browsing): the game keeps running, it just won't persist.
  }
};
