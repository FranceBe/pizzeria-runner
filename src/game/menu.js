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

export function createClassicRecipe(classic, { onMenu, newUntil }) {
  return {
    id: classic.id,
    name: classic.name,
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
    pushToast(state, `Nouvelle recette : ${classic.name}${onMenu ? " (ajoutée à la carte)" : ""}`, "gold");
  });
}

export const MAX_FILLINGS = 8;

// Returns an error message for the recipe editor, or null if the recipe can be saved.
export function validateRecipe(recipes, name, ingredients) {
  if (!name) return "Donne-lui un nom.";
  if (ingredients.length < 2) return "Ajoute au moins un ingrédient sur la pâte.";
  if (recipes.some((recipe) => haveSameIngredients(recipe.ingredients, ingredients))) return "Cette combinaison existe déjà dans ton carnet.";
  if (recipes.some((recipe) => recipe.name.toLowerCase() === name.toLowerCase())) return "Une pizza porte déjà ce nom.";
  return null;
}

export function recipeNameFor(state, ingredients) {
  const recipe = state.recipes.find((r) => haveSameIngredients(r.ingredients, ingredients));
  return recipe ? recipe.name : "Pizza improvisée";
}
