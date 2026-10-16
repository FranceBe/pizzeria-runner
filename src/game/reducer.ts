import { serviceActions } from "./actions/serviceActions";
import { shopActions } from "./actions/shopActions";
import { menuActions } from "./actions/menuActions";
import { settingsActions } from "./actions/settingsActions";
import type { ActionHandlers, GameAction, GameState } from "./types";

// Every action handler receives a deep copy of the state that it can mutate freely.
// It returns nothing, or a whole new state to replace it (import, reset).
// Typed as ActionHandlers, so an action without a handler doesn't compile.
const actionHandlers: ActionHandlers = { ...serviceActions, ...shopActions, ...menuActions, ...settingsActions };

type AnyHandler = (state: GameState, action: GameAction) => GameState | void;

export function gameReducer(state: GameState, action: GameAction): GameState {
  // Ticks fire four times a second all game long; skip the copy when no service is running.
  if (action.type === "tick" && state.phase !== "service") return state;
  // actionHandlers[action.type] always matches action, but TypeScript can't correlate the two unions.
  const handler = actionHandlers[action.type] as AnyHandler;
  const draft = structuredClone(state);
  return handler(draft, action) ?? draft;
}
