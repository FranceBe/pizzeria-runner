import { CUSTOMER_NAMES, LINES_PER_MOOD, RARE_LINE_CHANCE, RARE_LINES } from "../data/customers";
import { CELEBRITY_NAMES, CRITIC_NAMES } from "../data/events";
import type { StoryId } from "../data/stories";
import { INGREDIENTS, type IngredientId } from "../data/ingredients";
import { DRINKS, DRINK_IDS, type DrinkId } from "../data/drinks";
import { DELIVERY_FEE, tipChanceForDecor } from "../data/progression";
import { SEASONAL_RECIPE_BOOST } from "../data/seasons";
import { pickRandom, randomIndex, randomBetween, makeId } from "../utils/random";
import { todaysEvent } from "./events";
import { dietAllows, forDiet } from "./diets";
import { fairPrice, priceAttractiveness, isDessert, isFilling, fillingsOf, sortByLayer } from "./pizza";
import { activeMenu, isNewRecipe, recipeAppeal } from "./menu";
import { fitAccessory, rollLooks } from "./looks";
import { seasonalRecipe } from "./seasons";
import { isSpecial, SPECIAL_ORDER_BOOST } from "./special";
import { fitsTonight, THEME_ORDER_BOOST } from "./themes";
import { drinkChance, spoilingBoost } from "./incidents";
import { familyMenu } from "./family";
import { isFeatureOn } from "./playOptions";
import { levelForXp } from "./progression";
import { bookEntry, favoriteRecipeId, FAVORITE_REORDER_CHANCE, isRegular, isTheirUsual, pickCustomerName } from "./regulars";
import type { Customer, CustomerBookEntry, Diet, GameState, Mood, Recipe } from "./types";

// From this level, some customers ask for an extra topping or to leave one out.
export const SPECIAL_REQUESTS_LEVEL = 3;
const SPECIAL_REQUEST_CHANCE = 0.25;
const EXTRA_RATHER_THAN_REMOVE_CHANCE = 0.55;
export const EXTRA_TOPPING_SURCHARGE = 1.5;

// From this level, some customers have a diet.
const DIETS_LEVEL = 4;
const DIET_CHANCE = 0.15;

// A regular ordering their favourite says "the usual" this often, hiding the recipe on the ticket.
const AS_USUAL_CHANCE = 0.5;

// Popular, fairly priced, new, seasonal recipes, the week's special and tonight's theme get ordered more often.
export const orderWeight = (state: GameState, recipe: Recipe): number => {
  const priceFactor = Math.pow(priceAttractiveness(recipe.price, fairPrice(recipe.ingredients)), 1.5);
  const newBoost = isNewRecipe(state, recipe) ? 1.4 : 1;
  const specialBoost = isSpecial(state, recipe.id) ? SPECIAL_ORDER_BOOST : 1;
  const seasonBoost = recipe.id === seasonalRecipe(state)?.id ? SEASONAL_RECIPE_BOOST : 1;
  const themeBoost = fitsTonight(state, recipe.ingredients) ? THEME_ORDER_BOOST : 1;
  return recipeAppeal(recipe) * priceFactor * newBoost * specialBoost * seasonBoost * themeBoost * spoilingBoost(state, recipe);
};

const pickWeighted = <T>(items: readonly T[], weights: readonly number[]): T => {
  let remaining = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) return items[i];
  }
  return items[0];
};

// Returning customers often reorder their favourite (always on their birthday); everyone else picks by weight.
const chooseRecipe = (
  state: GameState,
  menu: readonly Recipe[],
  entry: CustomerBookEntry | undefined,
  isBirthday: boolean,): { recipe: Recipe; isFavorite: boolean } => {
  const favorite = menu.find((recipe) => recipe.id === favoriteRecipeId(entry, state));
  if (favorite && (isBirthday || Math.random() < FAVORITE_REORDER_CHANCE)) return { recipe: favorite, isFavorite: true };
  return { recipe: pickWeighted(menu, menu.map((recipe) => orderWeight(state, recipe))), isFavorite: false };
};

const unlockedIngredients = (state: GameState): IngredientId[] =>
  INGREDIENTS.filter((ingredient) => state.unlocked[ingredient.id]).map((ingredient) => ingredient.id);

// Maybe a diet, if the menu has something for it.
const rollDiet = (state: GameState, menu: readonly Recipe[]): Diet | null => {
  if (levelForXp(state.xp) < DIETS_LEVEL || Math.random() >= DIET_CHANCE) return null;
  const diets: Diet[] = ["veggie", "noPork", ...(state.unlocked.pateSG ? (["glutenFree"] as const) : [])];
  const diet = pickRandom(diets);
  return menu.some((recipe) => dietAllows(diet, recipe.ingredients)) ? diet : null;
};

const rollDrink = (state: GameState): DrinkId | null => {
  const available = DRINK_IDS.filter((id) => DRINKS[id].barLevel <= state.upgrades.bar);
  return available.length && Math.random() < drinkChance(state) ? pickRandom(available) : null;
};

export type CustomerKind = "regular" | "critic" | "delivery" | "celebrity";

export interface CustomerOptions {
  /** Someone in particular: a regular coming for their birthday, or a table member. */
  name?: string;
  isBirthday?: boolean;
  /** A regular here for this chapter of their story. */
  story?: { id: StoryId; chapter: number };
  tableId?: string;
  /** Back later the same evening, for a dessert pizza. */
  forDessert?: boolean;
  /** One of Nonna's family: Nonna's recipes, no diet. */
  family?: boolean;
}

// Returns null when nothing is on the menu (the player emptied it mid-service).
// "regular" means anyone at the counter: they go in the customer book and may come back.
export const createCustomer = (state: GameState, kind: CustomerKind = "regular", options: CustomerOptions = {}): Customer | null => {
  const fullMenu = activeMenu(state);
  if (!fullMenu.length) return null;
  // A name is a person (see regulars.ts), so the same name never waits at the counter twice.
  const waitingNames = new Set(state.service?.customers.map((customer) => customer.name) ?? []);
  const names = kind === "critic" ? CRITIC_NAMES : kind === "celebrity" ? CELEBRITY_NAMES : CUSTOMER_NAMES;
  const name =
    options.name ??
    (kind === "regular" ? pickCustomerName(state, names, waitingNames) : pickRandom(names.filter((candidate) => !waitingNames.has(candidate))));
  const entry = kind === "regular" && !options.family ? bookEntry(state, name) : undefined;
  const isBirthday = Boolean(options.isBirthday && isRegular(entry));

  const isGuest = kind === "critic" || kind === "celebrity" || Boolean(options.family);
  const { forDessert = false } = options;
  const story = options.story && isRegular(entry) ? options.story : undefined;
  const diet = isGuest || isBirthday || story || forDessert ? null : rollDiet(state, fullMenu);
  // Diets and dislikes narrow the menu, unless nothing would be left.
  const narrowed = fullMenu.filter(
    (recipe) => dietAllows(diet, recipe.ingredients) && !(entry?.dislikes && recipe.ingredients.includes(entry.dislikes)),
  );
  const menu = options.family
    ? familyMenu(fullMenu)
    : forDessert
      ? fullMenu.filter((recipe) => isDessert(recipe.ingredients))
      : narrowed.length
        ? narrowed
        : fullMenu;
  if (!menu.length) return null;
  // A celebrity asks for the finest pizza on the menu, with an extra topping.
  const { recipe, isFavorite } =
    kind === "celebrity" ? { recipe: [...menu].sort((a, b) => b.price - a.price)[0], isFavorite: false } : chooseRecipe(state, menu, entry, isBirthday);
  // "The usual" only for a pizza they really have a habit of (tonight's menu has it, as everything ordered).
  const asUsual =
    isFavorite && isRegular(entry) && isTheirUsual(entry, recipe.id) && !diet && !forDessert && isFeatureOn(state, "asUsual") && Math.random() < AS_USUAL_CHANCE;

  let ingredients: IngredientId[] = forDiet(diet, recipe.ingredients);
  let extraIngredient: IngredientId | null = null;
  let removedIngredient: IngredientId | null = null;
  let price = recipe.price;

  const canAskForChanges = kind !== "critic" && !asUsual && !diet && !isBirthday && !forDessert && isFeatureOn(state, "specialRequests");
  const asksForChanges = kind === "celebrity" || (levelForXp(state.xp) >= SPECIAL_REQUESTS_LEVEL && Math.random() < SPECIAL_REQUEST_CHANCE);
  if (canAskForChanges && asksForChanges) {
    const recipeFillings = fillingsOf(recipe.ingredients);
    if (kind === "celebrity" || Math.random() < EXTRA_RATHER_THAN_REMOVE_CHANCE) {
      const candidates = unlockedIngredients(state).filter(
        (id) => isFilling(id) && !recipe.ingredients.includes(id) && id !== entry?.dislikes && isDessert([id]) === isDessert(recipe.ingredients),
      );
      if (candidates.length) {
        const extra = pickRandom(candidates);
        extraIngredient = extra;
        ingredients.push(extra);
        price += EXTRA_TOPPING_SURCHARGE;
      }
    } else if (recipeFillings.length >= 2) {
      const removed = pickRandom(recipeFillings);
      removedIngredient = removed;
      ingredients = ingredients.filter((id) => id !== removed);
    }
  }

  return {
    id: makeId(),
    name,
    // Someone already in the book keeps the look they had on their first visit.
    ...(entry ? { skin: entry.skin, hair: entry.hair, hairStyle: entry.hairStyle, accessory: fitAccessory(name, entry.accessory) } : rollLooks(name)),
    // Only people at the counter are counted; the ticket badge appears from the second visit.
    visitNumber: kind === "regular" && !forDessert ? (entry?.visits ?? 0) + 1 : undefined,
    recipeId: recipe.id,
    recipeName: recipe.name,
    ingredients: sortByLayer(ingredients),
    extraIngredient,
    removedIngredient,
    price: kind === "delivery" ? price + DELIVERY_FEE : price,
    waitedSeconds: 0,
    lineIndex: randomIndex(LINES_PER_MOOD),
    ...(Math.random() < RARE_LINE_CHANCE ? { rareLine: randomIndex(RARE_LINES) } : {}),
    asUsual,
    critic: kind === "critic",
    celebrity: kind === "celebrity",
    delivery: kind === "delivery",
    diet,
    tableId: options.tableId ?? null,
    drink: kind === "regular" && !forDessert ? rollDrink(state) : null,
    drinkServed: false,
    birthday: isBirthday,
    ...(story ? { story } : {}),
    ...(options.family ? { family: true } : {}),
    forDessert,
  };
};

export const isRegularCustomer = (state: GameState, customer: Customer): boolean => isRegular(bookEntry(state, customer.name));

// Tips reward quick service and loyalty; nobody is ever penalised for waiting.
// Indexed by mood: a happy customer is more likely to tip, and tips more.
const MOOD_TIP_CHANCE_BONUS: Record<Mood, number> = [0.2, 0.1, 0, 0];
const MOOD_TIP_MULTIPLIER: Record<Mood, number> = [1.3, 1.1, 1, 1];
const EXTRA_TOPPING_TIP_BONUS = 0.15;
const REGULAR_TIP_BONUS = 0.1;
const AS_USUAL_TIP_BONUS = 0.15;
const DIET_TIP_BONUS = 0.1;
// An offered drink: much more likely to tip, and more generously.
const OFFERED_DRINK_TIP_BONUS = 0.25;
const OFFERED_DRINK_TIP_MULTIPLIER = 1.5;
const MAX_TIP_CHANCE = 0.95;

export const tipChance = (state: GameState, customer: Customer): number => {
  const mood = moodForWait(customer.waitedSeconds);
  const chance =
    tipChanceForDecor(state.upgrades.deco) +
    MOOD_TIP_CHANCE_BONUS[mood] +
    (customer.extraIngredient ? EXTRA_TOPPING_TIP_BONUS : 0) +
    (isRegularCustomer(state, customer) ? REGULAR_TIP_BONUS : 0) +
    (customer.asUsual ? AS_USUAL_TIP_BONUS : 0) +
    (customer.diet ? DIET_TIP_BONUS : 0) +
    (customer.drinkOffered ? OFFERED_DRINK_TIP_BONUS : 0) +
    todaysEvent(state).tipChanceBonus;
  return Math.min(MAX_TIP_CHANCE, chance);
};

// Rolls the tip for a customer being served: 0, or an amount rounded to 10 cents.
// extraChance: from the pizza itself (a wood-fired oven), on top of what the customer brings.
export const rollTip = (state: GameState, customer: Customer, extraChance = 0): number => {
  // Charmed by Mamma's secret (through the customer before): the tip is certain, its size as usual.
  if (!customer.charmed && Math.random() >= Math.min(MAX_TIP_CHANCE, tipChance(state, customer) + extraChance)) return 0;
  const base = randomBetween(0.5, 1 + 0.8 * state.upgrades.deco);
  const multiplier = MOOD_TIP_MULTIPLIER[moodForWait(customer.waitedSeconds)] * (customer.drinkOffered ? OFFERED_DRINK_TIP_MULTIPLIER : 1);
  return Math.round(base * multiplier * 10) / 10;
};

export const hasSpecialRequest = (customer: Customer): boolean =>
  Boolean(customer.extraIngredient || customer.removedIngredient || customer.diet);

// Customers never leave; they just get hungrier.
export const moodForWait = (waitedSeconds: number): Mood => {
  if (waitedSeconds < 25) return 0;
  if (waitedSeconds < 50) return 1;
  if (waitedSeconds < 90) return 2;
  return 3;
};
