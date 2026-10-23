import { serviceActions } from "./actions/serviceActions";
import { shopActions } from "./actions/shopActions";
import { menuActions } from "./actions/menuActions";
import { settingsActions } from "./actions/settingsActions";
import { unlockAchievements } from "./achievements";
import type { ActionHandlers, GameAction, GameState } from "./types";

// Every action handler receives a deep copy of the state that it can mutate freely (but for dayStart, see below).
// It returns nothing, or a whole new state to replace it (import, reset).
// Typed as ActionHandlers, so an action without a handler doesn't compile.
const actionHandlers: ActionHandlers = { ...serviceActions, ...shopActions, ...menuActions, ...settingsActions };

type AnyHandler = (state: GameState, action: GameAction) => GameState | void;

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  // Ticks fire four times a second all game long; skip the copy when no service is running.
  if (action.type === "tick" && (state.phase !== "service" || state.service?.paused)) return state;
  // actionHandlers[action.type] always matches action, but TypeScript can't correlate the two unions.
  const handler = actionHandlers[action.type] as AnyHandler;
  // Shared rather than copied, as nothing changes them in place: the copy of the morning kept to restart the day (only
  // ever replaced, read through a copy, or dropped), and, on a tick, the customer book (written when a pizza is served,
  // in the morning and at opening, never by a tick: see reducer.test.ts). Ticks come four times a second, and these
  // are the biggest parts of a long game.
  const { dayStart, customerBook, ...rest } = state;
  const draft: GameState = {
    ...structuredClone(rest),
    dayStart,
    customerBook: action.type === "tick" ? customerBook : structuredClone(customerBook),
  };
  const next = handler(draft, action) ?? draft;
  // Ticks only matter here when they end the day (the menu emptied mid-service).
  if (action.type !== "tick" || next.phase !== state.phase) unlockAchievements(next);
  return next;
};
