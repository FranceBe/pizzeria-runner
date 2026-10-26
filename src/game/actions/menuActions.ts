import { makeId } from "../../utils/random";
import { adjustPrice, sortByLayer } from "../pizza";
import { findRecipe, menuCapacityOf, menuIsFull, NEW_RECIPE_DAYS } from "../menu";
import { chooseSpecial, dropSpecialIfOffMenu } from "../special";
import { levelForXp } from "../progression";
import { pushToast } from "../toasts";
import type { ActionHandlers } from "../types";


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
      pushToast(state, { key: "menuFull", params: { capacity: menuCapacityOf(state), level } }, "warn");
      return;
    }
    recipe.onMenu = !recipe.onMenu;
    dropSpecialIfOffMenu(state);
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
    dropSpecialIfOffMenu(state);
  },

  // One recipe for the week (see game/special.ts).
  setSpecial(state, { recipeId }) {
    chooseSpecial(state, recipeId);
  },
} satisfies Partial<ActionHandlers>;
