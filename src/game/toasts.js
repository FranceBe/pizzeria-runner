import { makeId } from "../utils/random.js";

const MAX_VISIBLE_TOASTS = 4;

// kind: "" (neutral) | "gold" (good news) | "warn". Mutates state.
export function pushToast(state, text, kind = "") {
  state.toasts.push({ id: makeId(), text, kind });
  if (state.toasts.length > MAX_VISIBLE_TOASTS) state.toasts.shift();
}
