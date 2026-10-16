import { customerForPizza, selectedCustomer } from "./service";
import type { GameState, TutorialStep } from "./types";

// The guided first day: one hint at a time, worked out from the current state.
// Returns null when there is nothing to say. The step's key is under "tutorial." in src/i18n,
// its target names the UI element to highlight.
export function tutorialStep(state: GameState): TutorialStep | null {
  if (state.settings.tutorialDone || state.day !== 1 || state.service?.challenge) return null;
  if (state.phase === "prep") return { key: "open", target: "open" };
  const { service } = state;
  if (state.phase !== "service" || !service) return null;

  const servable = service.ready.map((pizza) => customerForPizza(service, pizza.ingredients)).find(Boolean);
  if (servable) return { key: "serve", params: { name: servable.name }, target: "serve" };

  const selected = selectedCustomer(service);
  if (!selected) return { key: service.oven.length ? "baking" : "waiting", target: null };

  if (!service.board.includes("pate")) {
    return service.oven.length
      ? { key: "nextPizza", params: { name: selected.name }, target: "dough" }
      : { key: "dough", params: { name: selected.name }, target: "dough" };
  }
  const extra = service.board.filter((id) => !selected.ingredients.includes(id));
  if (extra.length) return { key: "extra", params: { ingredientIds: extra }, target: null };
  const missing = selected.ingredients.filter((id) => !service.board.includes(id));
  if (missing.length) return { key: "toppings", params: { name: selected.name, ingredientIds: missing }, target: "toppings" };
  return { key: "bake", target: "bake" };
}
