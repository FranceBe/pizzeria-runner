import { makeId } from "../utils/random";
import type { GameState, PopKind, ToastInput, ToastKind } from "./types";

const MAX_VISIBLE_TOASTS = 4;
// The evening's thread, to read messages again in full: the latest ones.
export const MESSAGE_LOG_SIZE = 30;
const MAX_VISIBLE_POPS = 6;

// Toasts store a translation key (under "toasts." in src/i18n) and its params, never text,
// so they are translated when shown and follow language changes. Mutates state.
// Each one also goes on the evening's thread (messageLog).
export const pushToast = (state: GameState, message: ToastInput, kind: ToastKind = ""): void => {
  const toast = { ...message, id: makeId(), kind };
  state.toasts.push(toast);
  if (state.toasts.length > MAX_VISIBLE_TOASTS) state.toasts.shift();
  state.messageLog = [...(state.messageLog ?? []), toast].slice(-MESSAGE_LOG_SIZE);
};

// Money pops are the small "+7,00 €" bubbles next to the till. Mutates state.
export const pushPop = (state: GameState, amount: number, kind: PopKind): void => {
  state.pops.push({ id: makeId(), amount, kind });
  if (state.pops.length > MAX_VISIBLE_POPS) state.pops.shift();
};
