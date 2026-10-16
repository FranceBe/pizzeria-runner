import { createInitialState } from "../game/state.js";
import { gameReducer } from "../game/reducer.js";

// Tests use French by default; pass `settings` in overrides to change it.
export function makeState(overrides = {}) {
  return { ...createInitialState("fr"), ...overrides };
}

// Applies actions in order, like a sequence of player clicks.
export function play(state, ...actions) {
  return actions.reduce(gameReducer, state);
}

// A state with the service open and the given customers already at the counter.
export function stateInService(customers, overrides = {}) {
  const state = play(makeState(overrides), { type: "openRestaurant" });
  state.service.customers = customers;
  state.service.customersToCome = 0;
  state.service.selectedCustomerId = customers[0]?.id ?? null;
  return state;
}

export function makeCustomer(overrides = {}) {
  return {
    id: "cust-1",
    name: "Luca",
    skin: "#f1c9a5",
    hair: "#2b1d14",
    hairStyle: 0,
    recipeId: "margherita",
    recipeName: "Margherita",
    ingredients: ["pate", "tomate", "mozza", "basilic"],
    extraIngredient: null,
    removedIngredient: null,
    price: 7,
    waitedSeconds: 0,
    lineIndex: 0,
    ...overrides,
  };
}
