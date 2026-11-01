// Looks for the hint away from the page, so the cards never freeze while it searches (a few hundred milliseconds on a
// phone, at worst).
import { findHint } from "./hint";
import type { Game } from "./klondike";

// The worker's own scope (the project's types describe a page).
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ id: number; game: Game }>) => void) | null; postMessage: (message: unknown) => void };

scope.onmessage = (event) => {
  const { id, game } = event.data;
  scope.postMessage({ id, hint: findHint(game) });
};
