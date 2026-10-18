import { COMMIS_ASSEMBLES_ORDER } from "../data/progression";
import { isRegularCustomer } from "./customers";
import { hasBase, isBase } from "./pizza";
import { destinationOf, selectedCustomer, type Destination } from "./service";
import type { GameAction, GameState, Service } from "./types";

const ARROW_STEPS: Partial<Record<string, -1 | 1>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

// Keyboard shortcuts during service. Returns the action a key press should dispatch, or null.
//   0          dough (the selected order's: gluten-free when they asked for it)
//   1–9        the selected order's ingredients, in ticket order (only with help on, since it reveals the recipe)
//   Space      bake
//   Enter      serve (the selected customer's pizza first)
//   ← → ↑ ↓    previous / next order
//   Backspace  bin the pizza on the board
//   A          kitchen assistant builds the selected order
//   D          the selected customer's drink
//   O          offer it, for a regular
//   P, Escape  pause (the only key that works while paused)
export function shortcutAction(state: GameState, key: string): GameAction | null {
  const { service } = state;
  if (state.phase !== "service" || !service) return null;
  if (key === "p" || key === "P" || key === "Escape") return { type: "togglePause" };
  if (service.paused) return null;
  const selected = selectedCustomer(service);
  const selectedIndex = selected ? service.customers.indexOf(selected) : -1;

  if (key === "0") return { type: "toggleIngredient", ingredientId: selected?.ingredients.find(isBase) ?? "pate" };
  if (/^[1-9]$/.test(key)) {
    // The usual order is for the player to remember.
    if (!state.settings.showHelp || !selected || selected.asUsual) return null;
    const ingredientId = selected.ingredients.filter((id) => id !== "pate")[Number(key) - 1];
    return ingredientId ? { type: "toggleIngredient", ingredientId } : null;
  }
  if (key === " ") return hasBase(service.board) ? { type: "bake" } : null;
  if (key === "Enter") return serveAction(state, service);
  if (key === "Backspace" || key === "Delete") return service.board.length ? { type: "trashBoard" } : null;
  if (key === "a" || key === "A") {
    return state.upgrades.commis >= COMMIS_ASSEMBLES_ORDER && selected ? { type: "assembleOrder" } : null;
  }
  if (key === "d" || key === "D") {
    return selected?.drink && !selected.drinkServed ? { type: "serveDrink", drinkId: selected.drink } : null;
  }
  if (key === "o" || key === "O") {
    return selected?.drink && !selected.drinkServed && isRegularCustomer(state, selected) ? { type: "offerDrink" } : null;
  }
  const step = ARROW_STEPS[key];
  if (step && service.customers.length) {
    const count = service.customers.length;
    const next = service.customers[(Math.max(selectedIndex, 0) + step + count) % count];
    return { type: "selectCustomer", customerId: next.id };
  }
  return null;
}

// Serves the selected customer's pizza first, then any pizza someone (or the group order) is waiting for.
function serveAction(state: GameState, service: Service): GameAction | null {
  const matches = service.ready.map((pizza) => ({ pizza, destination: destinationOf(state, service, pizza.ingredients) }));
  const isSelected = (destination: Destination) =>
    destination !== null && ("customer" in destination ? destination.customer.id === service.selectedCustomerId : service.selectedCustomerId === "batch");
  const best = matches.find(({ destination }) => isSelected(destination)) ?? matches.find(({ destination }) => destination);
  return best ? { type: "servePizza", pizzaId: best.pizza.id } : null;
}
