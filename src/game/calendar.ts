import { FESTIVALS, FESTIVAL_GIFT, FESTIVAL_IDS, type FestivalId } from "../data/festivals";
import { discoverClassics } from "./menu";
import { pushToast } from "./toasts";
import type { GameState } from "./types";

// "2026-10-31" → the festival going on that day, if any. Windows can cross the new year.
export const festivalOn = (date: string): FestivalId | null => {
  const [, month, day] = date.split("-").map(Number);
  const value = month * 100 + day;
  return (
    FESTIVAL_IDS.find((id) => {
      const { from, to } = FESTIVALS[id];
      const start = from[0] * 100 + from[1];
      const end = to[0] * 100 + to[1];
      return start <= end ? value >= start && value <= end : value >= start || value <= end;
    }) ?? null
  );
};

// Follows the real date: a festival starting puts its ingredient on sale (with a few free portions) and its
// recipe in the book; ending takes the ingredient off sale again. Mutates state.
export const syncFestival = (state: GameState, date: string): void => {
  const festival = festivalOn(date);
  if (festival === state.festival) return;
  if (state.festival) state.unlocked[FESTIVALS[state.festival].ingredient] = false;
  state.festival = festival;
  if (!festival) return;
  const { ingredient } = FESTIVALS[festival];
  state.unlocked[ingredient] = true;
  state.stock[ingredient] = (state.stock[ingredient] || 0) + FESTIVAL_GIFT;
  pushToast(state, { key: "festivalStarts", params: { festival } }, "gold");
  discoverClassics(state);
};
