import { serviceActions } from "./actions/serviceActions.js";
import { shopActions } from "./actions/shopActions.js";
import { menuActions } from "./actions/menuActions.js";
import { settingsActions } from "./actions/settingsActions.js";

// Every action handler receives a deep copy of the state that it can mutate freely.
// It returns nothing, or a whole new state to replace it (import, reset).
const actionHandlers = { ...serviceActions, ...shopActions, ...menuActions, ...settingsActions };

export function gameReducer(state, action) {
  // Ticks fire four times a second all game long; skip the copy when no service is running.
  if (action.type === "tick" && state.phase !== "service") return state;
  const handler = actionHandlers[action.type];
  if (!handler) return state;
  const draft = structuredClone(state);
  return handler(draft, action) ?? draft;
}
