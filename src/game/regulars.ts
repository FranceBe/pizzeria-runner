// The customer book remembers everyone who was served, by name: their look, how often they came
// and what they ordered. Customers who come back keep their look and often reorder their favourite.
import type { FestivalId } from "../data/festivals";
import type { IngredientId } from "../data/ingredients";
import { CLASSIC_RECIPES } from "../data/recipes";
import { pickRandom, randomIndex } from "../utils/random";
import { activeMenu, canCook } from "./menu";
import { fillingsOf } from "./pizza";
import type { Customer, CustomerBookEntry, GameState } from "./types";

// Who becomes a regular (tagged on tickets, listed on the prep screen, tips a bit more, may ask for "the usual"):
// someone from the neighbourhood who ordered the same pizza REGULAR_SAME_ORDERS times, each time with at least
// REGULAR_MIN_CHOICES pizzas on the menu (with one or two, everyone orders the same), while there are fewer than
// MAX_REGULARS. The point is a small crowd whose usual the player can remember.
export const REGULAR_SAME_ORDERS = 3;
export const REGULAR_MIN_CHOICES = 3;
export const MAX_REGULARS = 8;
// A regular who stays away longer than this is lost from sight; back again, they may become one again.
export const LAPSE_DAYS = 10;
// Chance that a returning customer orders their favourite again, when it is on the menu.
export const FAVORITE_REORDER_CHANCE = 0.6;

export interface Regular extends CustomerBookEntry {
  name: string;
  favoriteRecipeId: string | null;
  /** Their real favourite is a festival's recipe, back with its festival: until then, the next one is their favourite. */
  favoriteBackWith: FestivalId | null;
}

export const bookEntry = (state: GameState, name: string): CustomerBookEntry | undefined => state.customerBook[name];

// They ordered the same pizza enough times while they had a choice.
const hasAUsual = (entry: CustomerBookEntry): boolean => Math.max(0, ...Object.values(entry.choiceOrders ?? {})) >= REGULAR_SAME_ORDERS;

export const isRegular = (entry: CustomerBookEntry | undefined): entry is CustomerBookEntry => entry?.regular === true;

const regularCount = (state: GameState): number => Object.values(state.customerBook).filter((entry) => entry.regular).length;

// The recipe this customer ordered most, or null. Given the game, among those that can be made now: still in the book,
// every ingredient on sale. A festival's recipe sleeps between festivals (the Zucca after Halloween), and a deleted
// one is gone: the next one they ordered most is their favourite meanwhile. Their orders are all kept, so the
// festival's recipe is their favourite again when it comes back.
export const favoriteRecipeId = (entry: CustomerBookEntry | undefined, state?: GameState): string | null => {
  const ranked = Object.entries(entry?.orders ?? {}).sort((a, b) => b[1] - a[1]);
  const isMakeable = ([id]: [string, number]) => {
    const recipe = state?.recipes.find((candidate) => candidate.id === id);
    return recipe !== undefined && state !== undefined && canCook(state, recipe);
  };
  return (state ? ranked.find(isMakeable) : ranked[0])?.[0] ?? null;
};

// The festival their real favourite comes back with, while it sleeps (null otherwise).
const favoriteBackWith = (entry: CustomerBookEntry, state: GameState): FestivalId | null => {
  const allTime = favoriteRecipeId(entry);
  if (!allTime || allTime === favoriteRecipeId(entry, state)) return null;
  return (CLASSIC_RECIPES.find((classic) => classic.id === allTime)?.festival as FestivalId | undefined) ?? null;
};

// A pizza they ordered often enough to call it "the usual" (as many times as it takes to become a regular): a
// favourite standing in for a sleeping one, ordered only once or twice, is ordered by name.
export const isTheirUsual = (entry: CustomerBookEntry | undefined, recipeId: string): boolean =>
  (entry?.orders[recipeId] ?? 0) >= REGULAR_SAME_ORDERS;

// Regulars, most loyal first.
export const regularsOf = (state: GameState): Regular[] => {
  return Object.entries(state.customerBook)
    .filter(([, entry]) => isRegular(entry))
    .map(([name, entry]) => ({ name, ...entry, favoriteRecipeId: favoriteRecipeId(entry, state), favoriteBackWith: favoriteBackWith(entry, state) }))
    .sort((a, b) => b.visits - a.visits);
};

// Birthdays come round every MONTH_DAYS days.
const MONTH_DAYS = 28;
const dayOfMonth = (day: number): number => ((day - 1) % MONTH_DAYS) + 1;
export const daysUntilBirthday = (state: GameState, birthday: number): number =>
  (birthday - dayOfMonth(state.day) + MONTH_DAYS) % MONTH_DAYS;

// Regulars whose birthday is today.
export const birthdaysToday = (state: GameState): string[] =>
  regularsOf(state).filter((regular) => regular.birthday === dayOfMonth(state.day)).map((regular) => regular.name);

// Something a new regular never wants on their pizza: a filling the player knows, never one of their favourite.
const pickDislike = (state: GameState, entry: CustomerBookEntry): IngredientId | undefined => {
  const favorite = state.recipes.find((recipe) => recipe.id === favoriteRecipeId(entry, state));
  const known = [...new Set(state.recipes.flatMap((recipe) => fillingsOf(recipe.ingredients)))];
  const candidates = known.filter((id) => !favorite?.ingredients.includes(id));
  return candidates.length ? pickRandom(candidates) : undefined;
};

// Adds a visit to the book. Returns true when this visit makes them a regular; the first time, that gives them a
// dislike and a birthday. Mutates state.
export const recordVisit = (state: GameState, customer: Customer): boolean => {
  const entry: CustomerBookEntry = state.customerBook[customer.name] ?? {
    skin: customer.skin,
    hair: customer.hair,
    hairStyle: customer.hairStyle,
    accessory: customer.accessory ?? null,
    visits: 0,
    orders: {},
  };
  const add = (counts: Record<string, number> | undefined) => ({ ...counts, [customer.recipeId]: (counts?.[customer.recipeId] ?? 0) + 1 });
  const hadChoice = activeMenu(state).length >= REGULAR_MIN_CHOICES;
  const updated: CustomerBookEntry = {
    ...entry,
    visits: entry.visits + 1,
    orders: add(entry.orders),
    choiceOrders: hadChoice ? add(entry.choiceOrders) : entry.choiceOrders,
    lastVisit: state.day,
  };
  const becomesRegular =
    !entry.regular && state.locals.includes(customer.name) && hasAUsual(updated) && regularCount(state) < MAX_REGULARS;
  if (becomesRegular) updated.regular = true;
  if (becomesRegular && updated.birthday === undefined) {
    updated.dislikes = pickDislike(state, updated);
    updated.birthday = randomIndex(MONTH_DAYS) + 1;
  }
  state.customerBook[customer.name] = updated;
  return becomesRegular;
};

// At the start of each day: regulars who stayed away too long are lost from sight, which makes room for others.
// Mutates state.
export const lapseAbsentRegulars = (state: GameState): void => {
  Object.values(state.customerBook).forEach((entry) => {
    // Older saves didn't keep the date: the count starts now.
    if (entry.lastVisit === undefined) entry.lastVisit = state.day;
    else if (entry.regular && state.day - entry.lastVisit > LAPSE_DAYS) entry.regular = false;
  });
};

// The neighbourhood: a few people who live nearby and come often. Everyone else passes by now and then, so the
// regulars stay a small crowd the player can get to know.
export const LOCALS_COUNT = 20;
export const LOCAL_SHARE = 0.7;

// Fills the neighbourhood up to LOCALS_COUNT: first with the most loyal faces already met, then with new names.
// Mutates state.
export const ensureLocals = (state: GameState, names: readonly string[]): void => {
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
};

// Who comes in next, among the names not already at the counter: most often someone from the neighbourhood.
export const pickCustomerName = (state: GameState, names: readonly string[], waiting: ReadonlySet<string>): string => {
  const free = names.filter((name) => !waiting.has(name));
  const locals = free.filter((name) => state.locals.includes(name));
  const passersBy = free.filter((name) => !state.locals.includes(name));
  const fromLocals = locals.length > 0 && (passersBy.length === 0 || Math.random() < LOCAL_SHARE);
  return pickRandom(fromLocals ? locals : passersBy);
};
