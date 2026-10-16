import { INGREDIENTS_BY_ID, KIND_LAYER_ORDER } from "../data/ingredients.js";
import { GOOD_PAIRINGS, BAD_PAIRINGS } from "../data/recipes.js";
import { clamp, roundToHalf } from "../utils/math.js";

const kindOf = (id) => INGREDIENTS_BY_ID[id].kind;

// Cheeses and toppings: what goes on top of the dough and sauce.
export const isFilling = (id) => kindOf(id) === "cheese" || kindOf(id) === "topping";
export const isSauce = (id) => kindOf(id) === "sauce";
export const fillingsOf = (ingredients) => ingredients.filter(isFilling);

// Dough first, then sauce, cheeses, toppings; ties keep the ingredient list order.
export function sortByLayer(ingredients) {
  return [...ingredients].sort(
    (a, b) =>
      KIND_LAYER_ORDER[kindOf(a)] - KIND_LAYER_ORDER[kindOf(b)] ||
      INGREDIENTS_BY_ID[a].listOrder - INGREDIENTS_BY_ID[b].listOrder,
  );
}

const setKey = (ingredients) => [...ingredients].sort().join("|");
export const haveSameIngredients = (a, b) => a.length === b.length && setKey(a) === setKey(b);

export const ingredientCost = (ingredients) => ingredients.reduce((total, id) => total + INGREDIENTS_BY_ID[id].cost, 0);

// Suggested price: a flat base plus a markup on ingredients, rounded to 50 cents.
export const fairPrice = (ingredients) => roundToHalf(3.5 + 1.6 * ingredientCost(ingredients));

export const MIN_PRICE = 2;
export const MAX_PRICE = 60;
export const PRICE_STEP = 0.5;
export const adjustPrice = (price, delta) => clamp(roundToHalf(price + delta), MIN_PRICE, MAX_PRICE);

export function findPairings(ingredients) {
  const present = new Set(ingredients);
  const bothPresent = ([a, b]) => present.has(a) && present.has(b);
  return { good: GOOD_PAIRINGS.filter(bothPresent), bad: BAD_PAIRINGS.filter(bothPresent) };
}

export const MIN_APPEAL = 0.3;
export const MAX_APPEAL = 1.6;

// How much customers want a recipe, from MIN_APPEAL to MAX_APPEAL (about 1 for a decent pizza).
export function appealOf(ingredients, isClassic) {
  const fillings = fillingsOf(ingredients);
  const fillingCount = fillings.length;
  const cheeseCount = fillings.filter((id) => kindOf(id) === "cheese").length;
  const hasSauce = ingredients.some(isSauce);
  const { good, bad } = findPairings(ingredients);

  let appeal = 0.75 + 0.07 * Math.min(fillingCount, 6) + 0.12 * good.length - 0.25 * bad.length;
  if (!hasSauce) appeal -= 0.1;
  if (cheeseCount === 0) appeal -= 0.15;
  if (cheeseCount >= 3) appeal += 0.1;
  if (fillingCount > 7) appeal -= 0.08 * (fillingCount - 7);
  if (isClassic) appeal += 0.1;
  return clamp(appeal, MIN_APPEAL, MAX_APPEAL);
}

export const appealToStars = (appeal) =>
  clamp(Math.round(((appeal - MIN_APPEAL) / (MAX_APPEAL - MIN_APPEAL)) * 4) + 1, 1, 5);

// Demand multiplier for a price: cheap boosts demand a little, expensive kills it fast (floor 0.1).
export function priceAttractiveness(price, fair) {
  const ratio = price / fair;
  return ratio <= 1 ? 1 + (1 - ratio) * 0.6 : Math.max(0.1, 1 - (ratio - 1) * 2);
}

// Translation key under "editor.priceNote" in src/i18n.
export function priceLevel(price, fair) {
  const ratio = price / fair;
  if (ratio <= 0.9) return "gentle";
  if (ratio <= 1.05) return "fair";
  if (ratio <= 1.25) return "high";
  return "tooHigh";
}
