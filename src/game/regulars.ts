// The customer book remembers everyone who was served, by name: their look, how often they came
// and what they ordered. Customers who come back keep their look and often reorder their favourite.
import type { IngredientId } from "../data/ingredients";
import { pickRandom, randomIndex } from "../utils/random";
import { fillingsOf } from "./pizza";
import type { Customer, CustomerBookEntry, GameState } from "./types";

// Times the same pizza must be ordered to count as a regular (tagged on tickets, listed on the prep screen, tip a bit
// more, may ask for "the usual"): a regular is someone with a usual to remember.
export const REGULAR_SAME_ORDERS = 3;
// A regular who stays away longer than this is lost from sight, until they come back.
export const LAPSE_DAYS = 10;
// Chance that a returning customer orders their favourite again, when it is on the menu.
export const FAVORITE_REORDER_CHANCE = 0.6;

export interface Regular extends CustomerBookEntry {
  name: string;
  favoriteRecipeId: string | null;
}

export const bookEntry = (state: GameState, name: string): CustomerBookEntry | undefined => state.customerBook[name];

// How many times they ordered their favourite.
const favoriteCount = (entry: CustomerBookEntry): number => Math.max(0, ...Object.values(entry.orders));

const hasAUsual = (entry: CustomerBookEntry): boolean => favoriteCount(entry) >= REGULAR_SAME_ORDERS;

export const isRegular = (entry: CustomerBookEntry | undefined): entry is CustomerBookEntry =>
  entry !== undefined && !entry.lapsed && hasAUsual(entry);

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

// Adds a visit to the book. Returns true when this visit makes them a regular, which gives them a dislike and a
// birthday. One lost from sight is simply a regular again when they come back. Mutates state.
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
  const { lapsed, ...rest } = entry;
  const updated: CustomerBookEntry = { ...rest, visits: entry.visits + 1, orders, lastVisit: state.day };
  const becomesRegular = isRegular(updated) && !isRegular(entry) && !lapsed;
  if (becomesRegular && updated.birthday === undefined) {
    updated.dislikes = pickDislike(state, updated);
    updated.birthday = randomIndex(MONTH_DAYS) + 1;
  }
  state.customerBook[customer.name] = updated;
  return becomesRegular;
}

// At the start of each day: regulars who stayed away too long are lost from sight. Mutates state.
export function lapseAbsentRegulars(state: GameState): void {
  Object.values(state.customerBook).forEach((entry) => {
    // Older saves didn't keep the date: the count starts now.
    if (entry.lastVisit === undefined) entry.lastVisit = state.day;
    else if (!entry.lapsed && hasAUsual(entry) && state.day - entry.lastVisit > LAPSE_DAYS) entry.lapsed = true;
  });
}

// The neighbourhood: a few people who live nearby and come often. Everyone else passes by now and then, so the
// regulars stay a small crowd the player can get to know.
export const LOCALS_COUNT = 20;
export const LOCAL_SHARE = 0.7;

// Fills the neighbourhood up to LOCALS_COUNT: first with the most loyal faces already met, then with new names.
// Mutates state.
export function ensureLocals(state: GameState, names: readonly string[]): void {
  if (state.locals.length >= LOCALS_COUNT) return;
  const known = Object.entries(state.customerBook)
    .filter(([name]) => names.includes(name) && !state.locals.includes(name))
    .sort((a, b) => b[1].visits - a[1].visits)
    .map(([name]) => name);
  const strangers = names.filter((name) => !state.locals.includes(name) && !known.includes(name));
  while (state.locals.length < LOCALS_COUNT && (known.length || strangers.length)) {
    const name = known.shift() ?? strangers.splice(randomIndex(strangers.length), 1)[0];
    state.locals.push(name);
  }
}

// Who comes in next, among the names not already at the counter: most often someone from the neighbourhood.
export function pickCustomerName(state: GameState, names: readonly string[], waiting: ReadonlySet<string>): string {
  const free = names.filter((name) => !waiting.has(name));
  const locals = free.filter((name) => state.locals.includes(name));
  const passersBy = free.filter((name) => !state.locals.includes(name));
  const fromLocals = locals.length > 0 && (passersBy.length === 0 || Math.random() < LOCAL_SHARE);
  return pickRandom(fromLocals ? locals : passersBy);
}
