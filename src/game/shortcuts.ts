import { COMMIS_ASSEMBLES_ORDER } from "../data/progression";
import { customerForPizza, selectedCustomer } from "./service";
import type { GameAction, GameState, Service } from "./types";

const ARROW_STEPS: Partial<Record<string, -1 | 1>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

// Keyboard shortcuts during service. Returns the action a key press should dispatch, or null.
//   0          dough
//   1–9        the selected order's ingredients, in ticket order (only with help on, since it reveals the recipe)
//   Space      bake
//   Enter      serve (the selected customer's pizza first)
//   ← → ↑ ↓    previous / next order
//   Backspace  bin the pizza on the board
//   A          kitchen assistant builds the selected order
export function shortcutAction(state: GameState, key: string): GameAction | null {
  const { service } = state;
  if (state.phase !== "service" || !service) return null;
  const selected = selectedCustomer(service);
  const selectedIndex = selected ? service.customers.indexOf(selected) : -1;

  if (key === "0") return { type: "toggleIngredient", ingredientId: "pate" };
  if (/^[1-9]$/.test(key)) {
    // The usual order is for the player to remember.
    if (!state.settings.showHelp || !selected || selected.asUsual) return null;
    const ingredientId = selected.ingredients.filter((id) => id !== "pate")[Number(key) - 1];
    return ingredientId ? { type: "toggleIngredient", ingredientId } : null;
  }
  if (key === " ") return service.board.includes("pate") ? { type: "bake" } : null;
  if (key === "Enter") return serveAction(service);
  if (key === "Backspace" || key === "Delete") return service.board.length ? { type: "trashBoard" } : null;
  if (key === "a" || key === "A") {
    return state.upgrades.commis >= COMMIS_ASSEMBLES_ORDER && selected ? { type: "assembleOrder" } : null;
  }
  const step = ARROW_STEPS[key];
  if (step && service.customers.length) {
    const count = service.customers.length;
    const next = service.customers[(Math.max(selectedIndex, 0) + step + count) % count];
    return { type: "selectCustomer", customerId: next.id };
  }
  return null;
}

function serveAction(service: Service): GameAction | null {
  const matches = service.ready.map((pizza) => ({ pizza, customer: customerForPizza(service, pizza.ingredients) }));
  const best =
    matches.find(({ customer }) => customer?.id === service.selectedCustomerId) ?? matches.find(({ customer }) => customer);
  return best ? { type: "servePizza", pizzaId: best.pizza.id } : null;
}
