import { makeId } from "../../utils/random";
import { adjustPrice, sortByLayer } from "../pizza";
import { menuIsFull, NEW_RECIPE_DAYS } from "../menu";
import { levelForXp, menuCapacity } from "../progression";
import { pushToast } from "../toasts";
import type { ActionHandlers, GameState, Recipe, RecipeId } from "../types";

const findRecipe = (state: GameState, recipeId: RecipeId): Recipe | undefined =>
  state.recipes.find((recipe) => recipe.id === recipeId);

export const menuActions = {
  changePrice(state, { recipeId, delta }) {
    const recipe = findRecipe(state, recipeId);
    if (recipe) recipe.price = adjustPrice(recipe.price, delta);
  },

  toggleOnMenu(state, { recipeId }) {
    const recipe = findRecipe(state, recipeId);
    if (!recipe) return;
    if (!recipe.onMenu && menuIsFull(state)) {
      const level = levelForXp(state.xp);
      pushToast(state, { key: "menuFull", params: { capacity: menuCapacity(level), level } }, "warn");
      return;
    }
    recipe.onMenu = !recipe.onMenu;
  },

  addRecipe(state, { name, ingredients, price }) {
    const onMenu = !menuIsFull(state);
    state.recipes.push({
      id: `c-${makeId()}`,
      name,
      ingredients: sortByLayer(ingredients),
      price,
      classic: false,
      custom: true,
      onMenu,
      newUntil: state.day + NEW_RECIPE_DAYS,
    });
    pushToast(state, { key: "recipeAdded", params: { name, onMenu } }, "gold");
  },

  deleteRecipe(state, { recipeId }) {
    state.recipes = state.recipes.filter((recipe) => recipe.id !== recipeId);
    if (state.chefSpecial === recipeId) state.chefSpecial = null;
  },

  // One recipe at most; choosing the current one again clears it.
  setChefSpecial(state, { recipeId }) {
    state.chefSpecial = recipeId === state.chefSpecial ? null : recipeId;
  },
} satisfies Partial<ActionHandlers>;
