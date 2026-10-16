import { CLASSIC_RECIPES } from "../data/recipes.js";
import { formatMoney, formatNumber } from "../utils/format.js";
import { en } from "./en.js";
import { fr } from "./fr.js";

const DICTIONARIES = { fr, en };

export const LANGUAGES = ["fr", "en"];
export const DEFAULT_LANGUAGE = "en";

// Each language is labelled in its own language, so it can be found whatever the current one is.
export const LANGUAGE_NAMES = { fr: "Français", en: "English" };

const CLASSIC_IDS = new Set(CLASSIC_RECIPES.map((recipe) => recipe.id));

export function detectLanguage() {
  try {
    return navigator.language.toLowerCase().startsWith("fr") ? "fr" : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

const lookup = (dictionary, key) => key.split(".").reduce((node, part) => node?.[part], dictionary);

// Returns t(key, params). Dictionary entries are either strings with {placeholders},
// or functions (params, t) => string for plurals and formatted values.
// A missing key renders as the key itself, which makes it easy to spot (and the tests catch it).
export function createTranslator(language) {
  const dictionary = DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];

  const t = (key, params = {}) => {
    const entry = lookup(dictionary, key);
    if (typeof entry === "function") return entry(params, t);
    if (typeof entry !== "string") return key;
    return entry.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  };

  t.language = language;
  t.money = (amount) => formatMoney(amount, language);
  t.number = (value) => formatNumber(value, language);
  t.ingredient = (id) => t(`ingredients.${id}`);
  t.ingredientList = (ids) => ids.map(t.ingredient).join(", ");
  // Everything but the dough, for recipe cards.
  t.toppings = (ids) => t.ingredientList(ids.filter((id) => id !== "pate"));
  // Classic recipes are translated; custom ones keep the name the player gave them.
  t.recipe = ({ id, name }) => (CLASSIC_IDS.has(id) ? t(`recipes.${id}`) : name);
  return t;
}
