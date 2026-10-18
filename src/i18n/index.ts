import { CLASSIC_RECIPES } from "../data/recipes";
import { formatMoney, formatNumber } from "../utils/format";
import { en } from "./en";
import { fr } from "./fr";
import { DEFAULT_LANGUAGE, type Language } from "./languages";
import type { Dictionary, Translate, TranslationHelpers, Translator } from "./types";

export * from "./languages";
export type * from "./types";

const DICTIONARIES: Record<Language, Dictionary> = { fr, en };

const CLASSIC_IDS: ReadonlySet<string> = new Set(CLASSIC_RECIPES.map((recipe) => recipe.id));

type Params = Record<string, unknown>;
type EntryFunction = (params: Params, helpers: TranslationHelpers) => string;

const lookup = (dictionary: Dictionary, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionary);

// Returns t(key, params). Dictionary entries are either strings with {placeholders},
// or functions (params, helpers) => string for plurals and formatted values.
// Keys and params are checked at compile time (see types.ts); at runtime, a missing key renders as the key itself.
export function createTranslator(language: Language): Translator {
  const dictionary = DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];

  const translate = (key: string, params: Params = {}): string => {
    const entry = lookup(dictionary, key);
    if (typeof entry === "function") return (entry as EntryFunction)(params, helpers);
    if (typeof entry !== "string") return key;
    return entry.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  };

  const helpers: TranslationHelpers = {
    money: (amount) => formatMoney(amount, language),
    number: (value) => formatNumber(value, language),
    ingredient: (id) => translate(`ingredients.${id}`),
    ingredientList: (ids) => ids.map(helpers.ingredient).join(", "),
    toppings: (ids) => helpers.ingredientList(ids.filter((id) => id !== "pate")),
    recipe: ({ id, name }) => (CLASSIC_IDS.has(id) ? translate(`recipes.${id}`) : (name ?? "")),
    upgradeName: (key) => translate(`upgrades.${key}.name`),
    upgradeDescription: (key, level) => translate(`upgrades.${key}.describe`, { level }),
    pairing: ([a, b]) => `${helpers.ingredient(a)} & ${helpers.ingredient(b).toLowerCase()}`,
    achievementName: (id) => translate(`achievements.${id}.name`),
    drink: (id) => translate(`drinks.${id}`),
    questGiver: (giver) => translate(`quests.givers.${giver}`),
    festival: (id) => translate(`festivals.${id}`),
    medal: (medal) => translate(`medals.${medal}`),
  };

  // The typed signature lives on Translate; the implementation is the untyped lookup above.
  const t = ((key: string, params?: Params) => translate(key, params)) as Translate;
  return Object.assign(t, helpers, { language });
}

/**
 * Translates a message stored in the game state (a toast or a tutorial step). Each stored message
 * pairs a key with its own params (see MessageInput), which TypeScript can't follow through the union,
 * hence the untyped call.
 */
export function translateMessage(t: Translator, section: "toasts" | "tutorial", message: { key: string; params?: object }): string {
  const untyped = t as unknown as (key: string, params?: object) => string;
  return untyped(`${section}.${message.key}`, message.params);
}
