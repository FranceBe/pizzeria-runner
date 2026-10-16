import type { IngredientId } from "../data/ingredients";
import { gameReducer } from "../game/reducer";
import { createInitialState } from "../game/state";
import type { Customer, CustomerBookEntry, GameAction, GameState, Service } from "../game/types";
import type { JsonObject } from "../utils/saveCode";

export const MARGHERITA_INGREDIENTS: readonly IngredientId[] = ["pate", "tomate", "mozza", "basilic"];

// Tests use French by default; pass `settings` in overrides to change it.
export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState("fr"), ...overrides };
}

// Applies actions in order, like a sequence of player clicks.
export function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

export const toggle = (...ids: IngredientId[]): GameAction[] => ids.map((ingredientId) => ({ type: "toggleIngredient", ingredientId }));

// The running service of a state that must have one.
export function serviceOf(state: GameState): Service {
  if (!state.service) throw new Error("Expected a service in progress");
  return state.service;
}

// A state with the service open and the given customers already at the counter.
export function stateInService(customers: Customer[], overrides: Partial<GameState> = {}): GameState {
  const state = play(makeState(overrides), { type: "openRestaurant" });
  const service = serviceOf(state);
  service.customers = customers;
  service.customersToCome = 0;
  service.selectedCustomerId = customers[0]?.id ?? null;
  return state;
}

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    name: "Luca",
    skin: "#f1c9a5",
    hair: "#2b1d14",
    hairStyle: 0,
    recipeId: "margherita",
    recipeName: null,
    ingredients: MARGHERITA_INGREDIENTS,
    extraIngredient: null,
    removedIngredient: null,
    price: 7,
    waitedSeconds: 0,
    lineIndex: 0,
    ...overrides,
  };
}

export function makeBookEntry(overrides: Partial<CustomerBookEntry> = {}): CustomerBookEntry {
  return { skin: "#e0ac83", hair: "#5b3a22", hairStyle: 1, visits: 1, orders: {}, ...overrides };
}

// Round-trips a value through JSON, the way saves are stored.
export const toJson = (value: unknown): JsonObject => JSON.parse(JSON.stringify(value)) as JsonObject;
