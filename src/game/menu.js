import { CLASSIC_RECIPES } from "../data/recipes.js";
import { fairPrice, haveSameIngredients } from "./pizza.js";
import { levelForXp, menuCapacity } from "./progression.js";
import { pushToast } from "./toasts.js";

// Recipes stay "new" (boosted demand, tagged in the UI) for this many days after being added.
export const NEW_RECIPE_DAYS = 2;

export const canCook = (state, recipe) => recipe.ingredients.every((id) => state.unlocked[id]);

// Recipes actually offered tonight: on the menu and with every supplier signed.
export const activeMenu = (state) => state.recipes.filter((recipe) => recipe.onMenu && canCook(state, recipe));

export const menuIsFull = (state) => activeMenu(state).length >= menuCapacity(levelForXp(state.xp));

export const isNewRecipe = (state, recipe) => recipe.newUntil >= state.day;

export const knowsRecipe = (state, recipeId) => state.recipes.some((recipe) => recipe.id === recipeId);

// Classic recipes have no stored name: it is translated from their id when shown.
export function createClassicRecipe(classic, { onMenu, newUntil }) {
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
}

// Adds classics whose ingredients are all unlocked; called after each unlock. Mutates state.
export function discoverClassics(state) {
  CLASSIC_RECIPES.forEach((classic) => {
    if (knowsRecipe(state, classic.id)) return;
    if (!canCook(state, classic)) return;
    const onMenu = !menuIsFull(state);
    state.recipes.push(createClassicRecipe(classic, { onMenu, newUntil: state.day + NEW_RECIPE_DAYS }));
    pushToast(state, "classicDiscovered", { recipeId: classic.id, onMenu }, "gold");
  });
}

export const MAX_FILLINGS = 8;

// Returns a translation key under "editor.errors" in src/i18n, or null if the recipe can be saved.
// displayName turns a recipe into the name the player sees (classic names are translated).
export function validateRecipe(recipes, name, ingredients, displayName) {
  if (!name) return "missingName";
  if (ingredients.length < 2) return "noTopping";
  if (recipes.some((recipe) => haveSameIngredients(recipe.ingredients, ingredients))) return "duplicateIngredients";
  if (recipes.some((recipe) => displayName(recipe).toLowerCase() === name.toLowerCase())) return "duplicateName";
  return null;
}

export const findRecipeByIngredients = (state, ingredients) =>
  state.recipes.find((recipe) => haveSameIngredients(recipe.ingredients, ingredients));
