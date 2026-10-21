import type { IngredientId } from "../data/ingredients";
import { CLASSIC_RECIPES, type ClassicRecipe } from "../data/recipes";
import { appealOf, fairPrice, haveSameIngredients, isBase } from "./pizza";
import { levelForXp, menuCapacity } from "./progression";
import { pushToast } from "./toasts";
import type { GameState, Recipe } from "./types";

// Recipes stay "new" (boosted demand, tagged in the UI) for this many days after being added.
export const NEW_RECIPE_DAYS = 2;

export const canCook = (state: GameState, recipe: { ingredients: readonly IngredientId[] }): boolean =>
  recipe.ingredients.every((id) => state.unlocked[id]);

// Nonna's secret recipes, by id, with the level she shares them at.
const SIGNATURE_LEVELS: ReadonlyMap<string, number> = new Map(
  CLASSIC_RECIPES.filter((classic) => classic.signatureLevel).map((classic) => [classic.id, classic.signatureLevel ?? 0]),
);
export const signatureLevel = (recipeId: string): number | undefined => SIGNATURE_LEVELS.get(recipeId);

export const recipeAppeal = (recipe: { id: string; ingredients: readonly IngredientId[]; classic: boolean }): number =>
  appealOf(recipe.ingredients, recipe.classic, SIGNATURE_LEVELS.has(recipe.id));

// Recipes actually offered tonight: on the menu and with every supplier signed.
export const activeMenu = (state: GameState): Recipe[] => state.recipes.filter((recipe) => recipe.onMenu && canCook(state, recipe));

export const menuIsFull = (state: GameState): boolean => activeMenu(state).length >= menuCapacity(levelForXp(state.xp));

export const isNewRecipe = (state: GameState, recipe: Recipe): boolean => recipe.newUntil >= state.day;

export const knowsRecipe = (state: GameState, recipeId: string): boolean => state.recipes.some((recipe) => recipe.id === recipeId);

// Classic recipes have no stored name: it is translated from their id when shown.
export const createClassicRecipe = (classic: ClassicRecipe, { onMenu, newUntil }: { onMenu: boolean; newUntil: number }): Recipe => {
  return {
    id: classic.id,
    name: null,
    ingredients: classic.ingredients,
    price: fairPrice(classic.ingredients),
    classic: true,
    custom: false,
    onMenu,
    newUntil,
  };
};

// Adds classics whose ingredients are all unlocked, and Nonna's recipes once the level is reached;
// called after each unlock and level up. Mutates state.
export const discoverClassics = (state: GameState): void => {
  const level = levelForXp(state.xp);
  CLASSIC_RECIPES.forEach((classic) => {
    if (knowsRecipe(state, classic.id)) return;
    if (!canCook(state, classic)) return;
    if (classic.signatureLevel && level < classic.signatureLevel) return;
    const onMenu = !menuIsFull(state);
    state.recipes.push(createClassicRecipe(classic, { onMenu, newUntil: state.day + NEW_RECIPE_DAYS }));
    const key = classic.signatureLevel ? "nonnaRecipe" : "classicDiscovered";
    pushToast(state, { key, params: { recipeId: classic.id, onMenu } }, "gold");
  });
};

export const MAX_FILLINGS = 8;

/** Translation key under "editor.errors" in src/i18n. */
export type RecipeError = "missingName" | "noTopping" | "duplicateIngredients" | "duplicateName";

// Returns why the recipe can't be saved, or null if it can.
// displayName turns a recipe into the name the player sees (classic names are translated).
export const validateRecipe = (
  recipes: readonly Recipe[],
  name: string,
  ingredients: readonly IngredientId[],
  displayName: (recipe: Recipe) => string,): RecipeError | null => {
  if (!name) return "missingName";
  if (ingredients.length < 2) return "noTopping";
  if (recipes.some((recipe) => haveSameIngredients(recipe.ingredients, ingredients))) return "duplicateIngredients";
  if (recipes.some((recipe) => displayName(recipe).toLowerCase() === name.toLowerCase())) return "duplicateName";
  return null;
};

// The recipe a pizza is, whatever its dough (a gluten-free Margherita is still a Margherita).
const withRegularDough = (ingredients: readonly IngredientId[]): IngredientId[] =>
  ingredients.map((id) => (isBase(id) ? "pate" : id));
export const findRecipeByIngredients = (state: GameState, ingredients: readonly IngredientId[]): Recipe | undefined =>
  state.recipes.find((recipe) => haveSameIngredients(recipe.ingredients, withRegularDough(ingredients)));
