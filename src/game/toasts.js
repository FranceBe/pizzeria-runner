import { makeId } from "../utils/random.js";

const MAX_VISIBLE_TOASTS = 4;
const MAX_VISIBLE_POPS = 6;

// Toasts store a translation key (under "toasts." in src/i18n) and its params, never text,
// so they are translated when shown and follow language changes.
// kind: "" (neutral) | "gold" (good news) | "warn". Mutates state.
export function pushToast(state, key, params = {}, kind = "") {
  state.toasts.push({ id: makeId(), key, params, kind });
  if (state.toasts.length > MAX_VISIBLE_TOASTS) state.toasts.shift();
}

// Money pops are the small "+7,00 €" bubbles next to the till. kind: "money" | "tip". Mutates state.
export function pushPop(state, amount, kind) {
  state.pops.push({ id: makeId(), amount, kind });
  if (state.pops.length > MAX_VISIBLE_POPS) state.pops.shift();
}
