// The customer book remembers everyone who was served, by name: their look, how often they came
// and what they ordered. Customers who come back keep their look and often reorder their favourite.

// Visits needed to count as a regular (tagged on tickets, listed on the prep screen, tip a bit more).
export const REGULAR_VISITS = 3;
// Chance that a returning customer orders their favourite again, when it is on the menu.
export const FAVORITE_REORDER_CHANCE = 0.6;

export const bookEntry = (state, name) => state.customerBook[name];

export const isRegular = (entry) => Boolean(entry) && entry.visits >= REGULAR_VISITS;

// The recipe this customer ordered most, or null.
export function favoriteRecipeId(entry) {
  const [recipeId] = Object.entries(entry?.orders ?? {}).sort((a, b) => b[1] - a[1])[0] ?? [];
  return recipeId ?? null;
}

// Regulars, most loyal first.
export function regularsOf(state) {
  return Object.entries(state.customerBook)
    .filter(([, entry]) => isRegular(entry))
    .map(([name, entry]) => ({ name, ...entry, favoriteRecipeId: favoriteRecipeId(entry) }))
    .sort((a, b) => b.visits - a.visits);
}

// Adds a visit to the book. Returns true when this visit makes them a regular. Mutates state.
export function recordVisit(state, customer) {
  const entry = state.customerBook[customer.name] ?? {
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
