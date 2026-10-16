import { CUSTOMER_NAMES, SKIN_TONES, HAIR_COLORS, HAIR_STYLE_COUNT, LINES_PER_MOOD } from "../data/customers.js";
import { tipChanceForDecor } from "../data/progression.js";
import { pickRandom, randomIndex, randomBetween, makeId } from "../utils/random.js";
import { appealOf, fairPrice, priceAttractiveness, isFilling, fillingsOf, sortByLayer } from "./pizza.js";
import { activeMenu, isNewRecipe } from "./menu.js";
import { levelForXp } from "./progression.js";
import { bookEntry, favoriteRecipeId, FAVORITE_REORDER_CHANCE, isRegular } from "./regulars.js";

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

// Returning customers often reorder their favourite; everyone else picks from the menu by weight.
function chooseRecipe(state, menu, entry) {
  const favorite = menu.find((recipe) => recipe.id === favoriteRecipeId(entry));
  if (favorite && Math.random() < FAVORITE_REORDER_CHANCE) return favorite;
  return pickWeighted(menu, menu.map((recipe) => orderWeight(state, recipe)));
}

// Returns null when nothing is on the menu (the player emptied it mid-service).
export function createCustomer(state) {
  const menu = activeMenu(state);
  if (!menu.length) return null;
  // A name is a person (see regulars.js), so the same name never waits at the counter twice.
  const waitingNames = new Set(state.service?.customers.map((customer) => customer.name) ?? []);
  const name = pickRandom(CUSTOMER_NAMES.filter((candidate) => !waitingNames.has(candidate)));
  const entry = bookEntry(state, name);
  const recipe = chooseRecipe(state, menu, entry);

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
    name,
    // Someone already in the book keeps the look they had on their first visit.
    skin: entry?.skin ?? pickRandom(SKIN_TONES),
    hair: entry?.hair ?? pickRandom(HAIR_COLORS),
    hairStyle: entry?.hairStyle ?? randomIndex(HAIR_STYLE_COUNT),
    visitNumber: (entry?.visits ?? 0) + 1,
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

export const isRegularCustomer = (state, customer) => isRegular(bookEntry(state, customer.name));

// Tips reward quick service and loyalty; nobody is ever penalised for waiting.
// Indexed by mood: a happy customer is more likely to tip, and tips more.
const MOOD_TIP_CHANCE_BONUS = [0.2, 0.1, 0, 0];
const MOOD_TIP_MULTIPLIER = [1.3, 1.1, 1, 1];
const EXTRA_TOPPING_TIP_BONUS = 0.15;
const REGULAR_TIP_BONUS = 0.1;
const MAX_TIP_CHANCE = 0.95;

export function tipChance(state, customer) {
  const mood = moodForWait(customer.waitedSeconds);
  const chance =
    tipChanceForDecor(state.upgrades.deco) +
    MOOD_TIP_CHANCE_BONUS[mood] +
    (customer.extraIngredient ? EXTRA_TOPPING_TIP_BONUS : 0) +
    (isRegularCustomer(state, customer) ? REGULAR_TIP_BONUS : 0);
  return Math.min(MAX_TIP_CHANCE, chance);
}

// Rolls the tip for a customer being served: 0, or an amount rounded to 10 cents.
export function rollTip(state, customer) {
  if (Math.random() >= tipChance(state, customer)) return 0;
  const base = randomBetween(0.5, 1 + 0.8 * state.upgrades.deco);
  return Math.round(base * MOOD_TIP_MULTIPLIER[moodForWait(customer.waitedSeconds)] * 10) / 10;
}

export const hasSpecialRequest = (customer) => Boolean(customer.extraIngredient || customer.removedIngredient);

// 0 = happy, 1 = patient, 2 = getting hungry, 3 = starving. Customers never leave.
export function moodForWait(waitedSeconds) {
  if (waitedSeconds < 25) return 0;
  if (waitedSeconds < 50) return 1;
  if (waitedSeconds < 90) return 2;
  return 3;
}
