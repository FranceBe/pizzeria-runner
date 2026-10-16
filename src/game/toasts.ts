import { makeId } from "../utils/random";
import type { GameState, PopKind, ToastInput, ToastKind } from "./types";

const MAX_VISIBLE_TOASTS = 4;
const MAX_VISIBLE_POPS = 6;

// Toasts store a translation key (under "toasts." in src/i18n) and its params, never text,
// so they are translated when shown and follow language changes. Mutates state.
export function pushToast(state: GameState, message: ToastInput, kind: ToastKind = ""): void {
  state.toasts.push({ ...message, id: makeId(), kind });
  if (state.toasts.length > MAX_VISIBLE_TOASTS) state.toasts.shift();
}

// Money pops are the small "+7,00 €" bubbles next to the till. Mutates state.
export function pushPop(state: GameState, amount: number, kind: PopKind): void {
  state.pops.push({ id: makeId(), amount, kind });
  if (state.pops.length > MAX_VISIBLE_POPS) state.pops.shift();
}
