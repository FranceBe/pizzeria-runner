import { customerForPizza } from "./service.js";

// The guided first day: one hint at a time, worked out from the current state.
// Returns null when there is nothing to say, or { key, params, target }:
// key is under "tutorial." in src/i18n, target names the UI element to highlight.
export function tutorialStep(state) {
  if (state.settings.tutorialDone || state.day !== 1) return null;
  if (state.phase === "prep") return { key: "open", params: {}, target: "open" };
  if (state.phase !== "service") return null;

  const { service } = state;
  const servable = service.ready.map((pizza) => customerForPizza(service, pizza.ingredients)).find(Boolean);
  if (servable) return { key: "serve", params: { name: servable.name }, target: "serve" };

  const selected = service.customers.find((customer) => customer.id === service.selectedCustomerId);
  if (!selected) return { key: service.oven.length ? "baking" : "waiting", params: {}, target: null };

  if (!service.board.includes("pate")) {
    return { key: service.oven.length ? "nextPizza" : "dough", params: { name: selected.name }, target: "dough" };
  }
  const extra = service.board.filter((id) => !selected.ingredients.includes(id));
  if (extra.length) return { key: "extra", params: { ingredientIds: extra }, target: null };
  const missing = selected.ingredients.filter((id) => !service.board.includes(id));
  if (missing.length) return { key: "toppings", params: { name: selected.name, ingredientIds: missing }, target: "toppings" };
  return { key: "bake", params: {}, target: "bake" };
}
