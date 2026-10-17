// The customer book remembers everyone who was served, by name: their look, how often they came
// and what they ordered. Customers who come back keep their look and often reorder their favourite.
import type { IngredientId } from "../data/ingredients";
import { pickRandom, randomIndex } from "../utils/random";
import { fillingsOf } from "./pizza";
import type { Customer, CustomerBookEntry, GameState } from "./types";

// Visits needed to count as a regular (tagged on tickets, listed on the prep screen, tip a bit more).
export const REGULAR_VISITS = 3;
// Chance that a returning customer orders their favourite again, when it is on the menu.
export const FAVORITE_REORDER_CHANCE = 0.6;

export interface Regular extends CustomerBookEntry {
  name: string;
  favoriteRecipeId: string | null;
}

export const bookEntry = (state: GameState, name: string): CustomerBookEntry | undefined => state.customerBook[name];

export const isRegular = (entry: CustomerBookEntry | undefined): entry is CustomerBookEntry =>
  entry !== undefined && entry.visits >= REGULAR_VISITS;

// The recipe this customer ordered most, or null.
export function favoriteRecipeId(entry: CustomerBookEntry | undefined): string | null {
  const [mostOrdered] = Object.entries(entry?.orders ?? {}).sort((a, b) => b[1] - a[1]);
  return mostOrdered?.[0] ?? null;
}

// Regulars, most loyal first.
export function regularsOf(state: GameState): Regular[] {
  return Object.entries(state.customerBook)
    .filter(([, entry]) => isRegular(entry))
    .map(([name, entry]) => ({ name, ...entry, favoriteRecipeId: favoriteRecipeId(entry) }))
    .sort((a, b) => b.visits - a.visits);
}

// Birthdays come round every MONTH_DAYS days.
const MONTH_DAYS = 28;
const dayOfMonth = (day: number): number => ((day - 1) % MONTH_DAYS) + 1;
export const daysUntilBirthday = (state: GameState, birthday: number): number =>
  (birthday - dayOfMonth(state.day) + MONTH_DAYS) % MONTH_DAYS;

// Regulars whose birthday is today.
export const birthdaysToday = (state: GameState): string[] =>
  regularsOf(state).filter((regular) => regular.birthday === dayOfMonth(state.day)).map((regular) => regular.name);

// Something a new regular never wants on their pizza: a filling the player knows, never one of their favourite.
function pickDislike(state: GameState, entry: CustomerBookEntry): IngredientId | undefined {
  const favorite = state.recipes.find((recipe) => recipe.id === favoriteRecipeId(entry));
  const known = [...new Set(state.recipes.flatMap((recipe) => fillingsOf(recipe.ingredients)))];
  const candidates = known.filter((id) => !favorite?.ingredients.includes(id));
  return candidates.length ? pickRandom(candidates) : undefined;
}

// Adds a visit to the book. Returns true when this visit makes them a regular, which gives them a dislike
// and a birthday. Mutates state.
export function recordVisit(state: GameState, customer: Customer): boolean {
  const entry: CustomerBookEntry = state.customerBook[customer.name] ?? {
    skin: customer.skin,
    hair: customer.hair,
    hairStyle: customer.hairStyle,
    accessory: customer.accessory ?? null,
    visits: 0,
    orders: {},
  };
  const orders = { ...entry.orders, [customer.recipeId]: (entry.orders[customer.recipeId] ?? 0) + 1 };
  const updated: CustomerBookEntry = { ...entry, visits: entry.visits + 1, orders };
  const becomesRegular = updated.visits === REGULAR_VISITS;
  if (becomesRegular) {
    updated.dislikes = pickDislike(state, updated);
    updated.birthday = randomIndex(MONTH_DAYS) + 1;
  }
  state.customerBook[customer.name] = updated;
  return becomesRegular;
}
