import { CUSTOMER_NAMES, SKIN_TONES, HAIR_COLORS, HAIR_STYLE_COUNT, LINES_PER_MOOD } from "../data/customers.js";
import { pickRandom, randomIndex, makeId } from "../utils/random.js";
import { appealOf, fairPrice, priceAttractiveness, isFilling, fillingsOf, sortByLayer } from "./pizza.js";
import { activeMenu, isNewRecipe } from "./menu.js";
import { levelForXp } from "./progression.js";

// From this level, some customers ask for an extra topping or to leave one out.
export const SPECIAL_REQUESTS_LEVEL = 3;
const SPECIAL_REQUEST_CHANCE = 0.25;
const EXTRA_RATHER_THAN_REMOVE_CHANCE = 0.55;
export const EXTRA_TOPPING_SURCHARGE = 1.5;

// Popular, fairly priced and new recipes get ordered more often.
export function orderWeight(state, recipe) {
  const priceFactor = Math.pow(priceAttractiveness(recipe.price, fairPrice(recipe.ingredients)), 1.5);
  const newBoost = isNewRecipe(state, recipe) ? 1.4 : 1;
  return appealOf(recipe.ingredients, recipe.classic) * priceFactor * newBoost;
}

function pickWeighted(items, weights) {
  let remaining = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) return items[i];
  }
  return items[0];
}

// Returns null when nothing is on the menu (the player emptied it mid-service).
export function createCustomer(state) {
  const menu = activeMenu(state);
  if (!menu.length) return null;
  const recipe = pickWeighted(menu, menu.map((r) => orderWeight(state, r)));

  let ingredients = [...recipe.ingredients];
  let extraIngredient = null;
  let removedIngredient = null;
  let price = recipe.price;

  if (levelForXp(state.xp) >= SPECIAL_REQUESTS_LEVEL && Math.random() < SPECIAL_REQUEST_CHANCE) {
    const recipeFillings = fillingsOf(recipe.ingredients);
    if (Math.random() < EXTRA_RATHER_THAN_REMOVE_CHANCE) {
      const candidates = Object.keys(state.unlocked).filter((id) => isFilling(id) && !recipe.ingredients.includes(id));
      if (candidates.length) {
        extraIngredient = pickRandom(candidates);
        ingredients.push(extraIngredient);
        price += EXTRA_TOPPING_SURCHARGE;
      }
    } else if (recipeFillings.length >= 2) {
      removedIngredient = pickRandom(recipeFillings);
      ingredients = ingredients.filter((id) => id !== removedIngredient);
    }
  }

  return {
    id: makeId(),
    name: pickRandom(CUSTOMER_NAMES),
    skin: pickRandom(SKIN_TONES),
    hair: pickRandom(HAIR_COLORS),
    hairStyle: randomIndex(HAIR_STYLE_COUNT),
    recipeId: recipe.id,
    recipeName: recipe.name,
    ingredients: sortByLayer(ingredients),
    extraIngredient,
    removedIngredient,
    price,
    waitedSeconds: 0,
    lineIndex: randomIndex(LINES_PER_MOOD),
  };
}

export const hasSpecialRequest = (customer) => Boolean(customer.extraIngredient || customer.removedIngredient);

// 0 = happy, 1 = patient, 2 = getting hungry, 3 = starving. Customers never leave.
export function moodForWait(waitedSeconds) {
  if (waitedSeconds < 25) return 0;
  if (waitedSeconds < 50) return 1;
  if (waitedSeconds < 90) return 2;
  return 3;
}
