// Incidents of the day that change the evening's basics: the fridge breaking down, a heatwave, the water cut off.
import { DRINK_CHANCE } from "../data/drinks";
import {
  FRIDGE_LOSS_SHARE, FRIDGE_MIN_STOCK, FRIDGE_ORDER_BOOST, HEATWAVE_DRINK_FACTOR, HEATWAVE_DRINK_MAX_CHANCE, HEATWAVE_WAITING,
} from "../data/events";
import { INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import { activeMenu } from "./menu";
import { seasonOf } from "./seasons";
import type { GameState, Recipe } from "./types";

// What can spoil: an ingredient of tonight's menu (never the dough) with enough of it in the fridge to matter.
const spoilCandidates = (state: GameState): IngredientId[] =>
  [...new Set(activeMenu(state).flatMap((recipe) => recipe.ingredients))].filter(
    (id) => INGREDIENTS_BY_ID[id].kind !== "base" && (state.stock[id] ?? 0) >= FRIDGE_MIN_STOCK,
  );

export const canSpoil = (state: GameState): boolean => spoilCandidates(state).length > 0;

/** The one the breakdown threatens: the best stocked (what there is most to lose). */
export const pickSpoilingIngredient = (state: GameState): IngredientId | null =>
  spoilCandidates(state).sort((a, b) => (state.stock[b] ?? 0) - (state.stock[a] ?? 0))[0] ?? null;

/** Recipes using what spoils are ordered more tonight (1 on any other night). */
export const spoilingBoost = (state: GameState, recipe: Recipe): number =>
  state.event === "fridgeFailure" && state.spoilingIngredient && recipe.ingredients.includes(state.spoilingIngredient) ? FRIDGE_ORDER_BOOST : 1;

// At closing, part of what is left of it is lost. Returns what, if anything. Mutates state.
export const spoilAtClosing = (state: GameState): { id: IngredientId; portions: number } | null => {
  const id = state.event === "fridgeFailure" ? state.spoilingIngredient : null;
  if (!id) return null;
  const portions = Math.floor((state.stock[id] ?? 0) * FRIDGE_LOSS_SHARE);
  if (!portions) return null;
  state.stock[id] = (state.stock[id] ?? 0) - portions;
  return { id, portions };
};

// A heatwave only comes with the summer market.
export const canHaveHeatwave = (state: GameState): boolean => seasonOf(state.day) === "summer";

/** A sunny day for the terrace. */
export const isSunnyEvening = (state: GameState): boolean => state.event === "sunny" || state.event === "heatwave";

/** The chance a customer orders a drink tonight: none without water, more in a heatwave. */
export const drinkChance = (state: GameState): number => {
  if (state.event === "waterCut") return 0;
  if (state.event === "heatwave") return Math.min(HEATWAVE_DRINK_MAX_CHANCE, DRINK_CHANCE * HEATWAVE_DRINK_FACTOR);
  return DRINK_CHANCE;
};

/** How much harder waiting is to bear tonight. */
export const weatherWaiting = (state: GameState): number => (state.event === "heatwave" ? HEATWAVE_WAITING : 1);
