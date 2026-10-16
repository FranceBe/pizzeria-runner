import { DAY_EVENTS, DAY_EVENT_IDS, EVENT_CHANCE, FIRST_EVENT_DAY, type DayEvent, type DayEventId } from "../data/events";
import { INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import type { GameState } from "./types";

// What an ordinary day looks like, so callers never have to check for "no event".
const NO_EVENT: DayEvent = { weight: 0, customerFactor: 1, marketPriceFactor: 1, tipChanceBonus: 0 };

export const todaysEvent = (state: GameState): DayEvent => (state.event ? DAY_EVENTS[state.event] : NO_EVENT);

// Picks the event of a new day, or null for an ordinary day. Never the same event two days in a row.
export function rollDayEvent(day: number, yesterday: DayEventId | null): DayEventId | null {
  if (day < FIRST_EVENT_DAY || Math.random() >= EVENT_CHANCE) return null;
  const candidates = DAY_EVENT_IDS.filter((id) => id !== yesterday);
  let remaining = Math.random() * candidates.reduce((total, id) => total + DAY_EVENTS[id].weight, 0);
  for (const id of candidates) {
    remaining -= DAY_EVENTS[id].weight;
    if (remaining <= 0) return id;
  }
  return candidates[0];
}

// What a portion costs at the market today, rounded to the cent.
export const marketPrice = (state: GameState, id: IngredientId): number =>
  Math.round(INGREDIENTS_BY_ID[id].cost * todaysEvent(state).marketPriceFactor * 100) / 100;
