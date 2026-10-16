// The customer book remembers everyone who was served, by name: their look, how often they came
// and what they ordered. Customers who come back keep their look and often reorder their favourite.
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

// Adds a visit to the book. Returns true when this visit makes them a regular. Mutates state.
export function recordVisit(state: GameState, customer: Customer): boolean {
  const entry: CustomerBookEntry = state.customerBook[customer.name] ?? {
    skin: customer.skin,
    hair: customer.hair,
    hairStyle: customer.hairStyle,
    visits: 0,
    orders: {},
  };
  const orders = { ...entry.orders, [customer.recipeId]: (entry.orders[customer.recipeId] ?? 0) + 1 };
  state.customerBook[customer.name] = { ...entry, visits: entry.visits + 1, orders };
  return entry.visits + 1 === REGULAR_VISITS;
}
