// The week's special: one pizza of the menu, chosen for the whole week. It is ordered more often, pays a little
// bonus when it goes out quickly, and brings reputation too when it is one of the player's own recipes.
import { SEASON_DAYS } from "../data/seasons";
import { pushPop, pushToast } from "./toasts";
import { receivePayment } from "./economy";
import { findRecipe } from "./menu";
import { weekOf } from "./weekly";
import type { Customer, GameState, Mood, RecipeId } from "./types";

export const SPECIAL_ORDER_BOOST = 2;
// Of the pizza's price, paid on top when the special is served before the customer gets impatient.
export const SPECIAL_BONUS_SHARE = 0.2;
// Reputation per special served, when it is a homemade recipe.
export const SPECIAL_HOMEMADE_XP = 3;

/** The day the week's special runs until (the last day of the week). */
export const specialUntil = (day: number): number => (weekOf(day) + 1) * SEASON_DAYS;

/** This week's special, if one was chosen this week. */
export const currentSpecial = (state: GameState): GameState["special"] =>
  state.special && state.special.week === weekOf(state.day) ? state.special : null;

export const isSpecial = (state: GameState, recipeId: RecipeId): boolean => currentSpecial(state)?.recipeId === recipeId;

// Chosen for the week: it can be changed only on the morning it was chosen (a change of mind before opening),
// or once it has left the menu.
export const canChooseSpecial = (state: GameState): boolean => {
  if (state.phase !== "prep") return false;
  const special = currentSpecial(state);
  return !special || special.chosenDay === state.day;
};

// Sets this week's special (null: none yet). Mutates state.
export const chooseSpecial = (state: GameState, recipeId: RecipeId | null): void => {
  if (!canChooseSpecial(state)) return;
  if (recipeId === null) {
    state.special = null;
    return;
  }
  if (!findRecipe(state, recipeId)?.onMenu) return;
  state.special = { recipeId, week: weekOf(state.day), chosenDay: state.day, served: 0 };
};

// A special that leaves the menu (or the recipe book) is no longer the special. Mutates state.
export const dropSpecialIfOffMenu = (state: GameState): void => {
  if (state.special && !findRecipe(state, state.special.recipeId)?.onMenu) state.special = null;
};

// When a new week starts, last week's special is told how it went, and a new one is to be chosen. Mutates state.
export const ensureSpecialWeek = (state: GameState): void => {
  const { special } = state;
  if (!special || special.week === weekOf(state.day)) return;
  const recipe = findRecipe(state, special.recipeId);
  if (recipe && special.served > 0) pushToast(state, { key: "specialWeek", params: { recipeId: recipe.id, recipeName: recipe.name, served: special.served } }, "gold");
  state.special = null;
};

// The special served: counted for the week, a bonus if it went out quickly. Returns the money given. Mutates state.
export const serveSpecial = (state: GameState, customer: Customer, mood: Mood): number => {
  if (!isSpecial(state, customer.recipeId) || !state.special) return 0;
  state.special.served += 1;
  if (mood > 1) return 0;
  const bonus = Math.round(customer.price * SPECIAL_BONUS_SHARE * 10) / 10;
  receivePayment(state, bonus);
  pushPop(state, bonus, "special");
  return bonus;
};

export const specialReputation = (state: GameState, customer: Customer): number =>
  isSpecial(state, customer.recipeId) && findRecipe(state, customer.recipeId)?.custom ? SPECIAL_HOMEMADE_XP : 0;
