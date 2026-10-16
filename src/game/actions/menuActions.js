import { makeId } from "../../utils/random.js";
import { adjustPrice, sortByLayer } from "../pizza.js";
import { menuIsFull, NEW_RECIPE_DAYS } from "../menu.js";
import { levelForXp, menuCapacity } from "../progression.js";
import { pushToast } from "../toasts.js";

const findRecipe = (state, recipeId) => state.recipes.find((recipe) => recipe.id === recipeId);

export const menuActions = {
  changePrice(state, { recipeId, delta }) {
    const recipe = findRecipe(state, recipeId);
    recipe.price = adjustPrice(recipe.price, delta);
  },

  toggleOnMenu(state, { recipeId }) {
    const recipe = findRecipe(state, recipeId);
    if (!recipe.onMenu && menuIsFull(state)) {
      const level = levelForXp(state.xp);
      pushToast(state, "menuFull", { capacity: menuCapacity(level), level }, "warn");
      return;
    }
    recipe.onMenu = !recipe.onMenu;
  },

  addRecipe(state, { name, ingredients, price }) {
    const onMenu = !menuIsFull(state);
    state.recipes.push({
      id: "c-" + makeId(),
      name,
      ingredients: sortByLayer(ingredients),
      price,
      classic: false,
      custom: true,
      onMenu,
      newUntil: state.day + NEW_RECIPE_DAYS,
    });
    pushToast(state, "recipeAdded", { name, onMenu }, "gold");
  },

  deleteRecipe(state, { recipeId }) {
    state.recipes = state.recipes.filter((recipe) => recipe.id !== recipeId);
  },
};
