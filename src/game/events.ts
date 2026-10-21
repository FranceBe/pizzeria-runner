import { DAY_EVENTS, DAY_EVENT_IDS, EVENT_CHANCE, FIRST_EVENT_DAY, type DayEvent, type DayEventId } from "../data/events";
import { pickRandom } from "../utils/random";
import { activeMenu } from "./menu";
import { INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import { seasonalPriceFactor } from "./seasons";
import type { GameState } from "./types";

// What an ordinary day looks like, so callers never have to check for "no event".
const NO_EVENT: DayEvent = { weight: 0, customerFactor: 1, marketPriceFactor: 1, tipChanceBonus: 0 };

export const todaysEvent = (state: GameState): DayEvent => (state.event ? DAY_EVENTS[state.event] : NO_EVENT);

// Some events only make sense for some pizzerias.
const canHappen = (state: GameState, id: DayEventId): boolean => {
  if (state.day < (DAY_EVENTS[id].firstDay ?? FIRST_EVENT_DAY)) return false;
  if (id === "scooterStrike") return state.upgrades.livraison > 0;
  if (id === "lateDelivery") return lateCandidates(state).length > 0;
  return true;
};

// What can arrive late: an ingredient of tonight's menu, never the dough.
const lateCandidates = (state: GameState): IngredientId[] =>
  [...new Set(activeMenu(state).flatMap((recipe) => recipe.ingredients))].filter((id) => INGREDIENTS_BY_ID[id].kind !== "base");

export const pickLateIngredient = (state: GameState): IngredientId | null => {
  const candidates = lateCandidates(state);
  return candidates.length ? pickRandom(candidates) : null;
};

// Picks the event of a new day (state.day is already the new day), or null for an ordinary day.
// Never the same event two days in a row.
export const rollDayEvent = (state: GameState, yesterday: DayEventId | null): DayEventId | null => {
  if (state.day < FIRST_EVENT_DAY || Math.random() >= EVENT_CHANCE) return null;
  const candidates = DAY_EVENT_IDS.filter((id) => id !== yesterday && canHappen(state, id));
  if (!candidates.length) return null;
  let remaining = Math.random() * candidates.reduce((total, id) => total + DAY_EVENTS[id].weight, 0);
  for (const id of candidates) {
    remaining -= DAY_EVENTS[id].weight;
    if (remaining <= 0) return id;
  }
  return candidates[0];
};

// What a portion costs at the market today (market day, in-season discount), rounded to the cent.
export const marketPrice = (state: GameState, id: IngredientId): number =>
  Math.round(INGREDIENTS_BY_ID[id].cost * todaysEvent(state).marketPriceFactor * seasonalPriceFactor(state, id) * 100) / 100;
