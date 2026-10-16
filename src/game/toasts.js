import { makeId } from "../utils/random.js";

const MAX_VISIBLE_TOASTS = 4;

// Toasts store a translation key (under "toasts." in src/i18n) and its params, never text,
// so they are translated when shown and follow language changes.
// kind: "" (neutral) | "gold" (good news) | "warn". Mutates state.
export function pushToast(state, key, params = {}, kind = "") {
  state.toasts.push({ id: makeId(), key, params, kind });
  if (state.toasts.length > MAX_VISIBLE_TOASTS) state.toasts.shift();
}
