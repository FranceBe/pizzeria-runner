import { INGREDIENTS_BY_ID, KIND_LAYER_ORDER, type IngredientId, type IngredientKind } from "../data/ingredients";
import { GOOD_PAIRINGS, BAD_PAIRINGS, type Pairing } from "../data/recipes";
import { clamp, roundToHalf } from "../utils/math";

const kindOf = (id: IngredientId): IngredientKind => INGREDIENTS_BY_ID[id].kind;

// Cheeses and toppings: what goes on top of the dough and sauce.
export const isFilling = (id: IngredientId): boolean => kindOf(id) === "cheese" || kindOf(id) === "topping";
export const isSauce = (id: IngredientId): boolean => kindOf(id) === "sauce";
export const fillingsOf = (ingredients: readonly IngredientId[]): IngredientId[] => ingredients.filter(isFilling);

// Dough first, then sauce, cheeses, toppings; ties keep the ingredient list order.
export function sortByLayer(ingredients: readonly IngredientId[]): IngredientId[] {
  return [...ingredients].sort(
    (a, b) =>
      KIND_LAYER_ORDER[kindOf(a)] - KIND_LAYER_ORDER[kindOf(b)] ||
      INGREDIENTS_BY_ID[a].listOrder - INGREDIENTS_BY_ID[b].listOrder,
  );
}

const setKey = (ingredients: readonly IngredientId[]): string => [...ingredients].sort().join("|");
export const haveSameIngredients = (a: readonly IngredientId[], b: readonly IngredientId[]): boolean =>
  a.length === b.length && setKey(a) === setKey(b);

export const ingredientCost = (ingredients: readonly IngredientId[]): number =>
  ingredients.reduce((total, id) => total + INGREDIENTS_BY_ID[id].cost, 0);

// Suggested price: a flat base plus a markup on ingredients, rounded to 50 cents.
export const fairPrice = (ingredients: readonly IngredientId[]): number => roundToHalf(3.5 + 1.6 * ingredientCost(ingredients));

export const MIN_PRICE = 2;
export const MAX_PRICE = 60;
export const PRICE_STEP = 0.5;
export const adjustPrice = (price: number, delta: number): number => clamp(roundToHalf(price + delta), MIN_PRICE, MAX_PRICE);

export function findPairings(ingredients: readonly IngredientId[]): { good: Pairing[]; bad: Pairing[] } {
  const present = new Set(ingredients);
  const bothPresent = ([a, b]: Pairing) => present.has(a) && present.has(b);
  return { good: GOOD_PAIRINGS.filter(bothPresent), bad: BAD_PAIRINGS.filter(bothPresent) };
}

export const MIN_APPEAL = 0.3;
export const MAX_APPEAL = 1.6;

// How much customers want a recipe, from MIN_APPEAL to MAX_APPEAL (about 1 for a decent pizza).
export function appealOf(ingredients: readonly IngredientId[], isClassic: boolean): number {
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

export const appealToStars = (appeal: number): number =>
  clamp(Math.round(((appeal - MIN_APPEAL) / (MAX_APPEAL - MIN_APPEAL)) * 4) + 1, 1, 5);

// Demand multiplier for a price: cheap boosts demand a little, expensive kills it fast (floor 0.1).
export function priceAttractiveness(price: number, fair: number): number {
  const ratio = price / fair;
  return ratio <= 1 ? 1 + (1 - ratio) * 0.6 : Math.max(0.1, 1 - (ratio - 1) * 2);
}

/** Translation key under "editor.priceNote" in src/i18n. */
export type PriceLevel = "gentle" | "fair" | "high" | "tooHigh";

export function priceLevel(price: number, fair: number): PriceLevel {
  const ratio = price / fair;
  if (ratio <= 0.9) return "gentle";
  if (ratio <= 1.05) return "fair";
  if (ratio <= 1.25) return "high";
  return "tooHigh";
}
