import { INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import type { Diet } from "./types";

// What each diet rules out. Gluten-free rules nothing out: the dough is swapped instead (see forDiet).
export function dietAllows(diet: Diet | null | undefined, ingredients: readonly IngredientId[]): boolean {
  if (diet === "veggie") return ingredients.every((id) => !INGREDIENTS_BY_ID[id].meat && !INGREDIENTS_BY_ID[id].fish);
  if (diet === "noPork") return ingredients.every((id) => INGREDIENTS_BY_ID[id].meat !== "pork");
  return true;
}

// A recipe's ingredients as this customer wants them.
export const forDiet = (diet: Diet | null | undefined, ingredients: readonly IngredientId[]): IngredientId[] =>
  diet === "glutenFree" ? ingredients.map((id) => (id === "pate" ? "pateSG" : id)) : [...ingredients];
