import type { IngredientId } from "../data/ingredients";
import { gameReducer } from "../game/reducer";
import { createInitialState } from "../game/state";
import type { Customer, CustomerBookEntry, GameAction, GameState, Recipe, Service } from "../game/types";
import type { JsonObject } from "../utils/saveCode";

export const MARGHERITA_INGREDIENTS: readonly IngredientId[] = ["pate", "tomate", "mozza", "basilic"];

// Tests use French by default; pass `settings` in overrides to change it.
export const makeState = (overrides: Partial<GameState> = {}): GameState => {
  return { ...createInitialState("fr"), ...overrides };
};

// Applies actions in order, like a sequence of player clicks.
export const play = (state: GameState, ...actions: GameAction[]): GameState => {
  return actions.reduce(gameReducer, state);
};

export const toggle = (...ids: IngredientId[]): GameAction[] => ids.map((ingredientId) => ({ type: "toggleIngredient", ingredientId }));

// The running service of a state that must have one.
export const serviceOf = (state: GameState): Service => {
  if (!state.service) throw new Error("Expected a service in progress");
  return state.service;
};

// A state with the service open and the given customers already at the counter.
export const stateInService = (customers: Customer[], overrides: Partial<GameState> = {}): GameState => {
  const state = play(makeState(overrides), { type: "openRestaurant" });
  const service = serviceOf(state);
  service.customers = customers;
  service.customersToCome = 0;
  service.selectedCustomerId = customers[0]?.id ?? null;
  return state;
};

export const makeCustomer = (overrides: Partial<Customer> = {}): Customer => {
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
};

// Unless told otherwise, every visit was for a margherita, with a choice on the menu; three visits or more make a regular.
export const makeBookEntry = (overrides: Partial<CustomerBookEntry> = {}): CustomerBookEntry => {
  const visits = overrides.visits ?? 1;
  const orders = { margherita: visits };
  return { skin: "#e0ac83", hair: "#5b3a22", hairStyle: 1, visits, orders, choiceOrders: orders, regular: visits >= 3, ...overrides };
};

// A menu with a real choice (three pizzas) and these names in the neighbourhood: what it takes to become a regular.
export const withChoiceAndLocals = (state: GameState, ...locals: string[]): GameState => {
  const custom = (id: `c-${string}`, name: string, ingredients: IngredientId[]): Recipe =>
    ({ id, name, ingredients, price: 7, classic: false, custom: true, onMenu: true, newUntil: 0 });
  state.recipes.push(custom("c-rossa", "Rossa", ["pate", "tomate", "basilic"]), custom("c-bianca", "Bianca", ["pate", "mozza", "basilic"]));
  state.locals = [...state.locals, ...locals];
  return state;
};

// Round-trips a value through JSON, the way saves are stored.
export const toJson = (value: unknown): JsonObject => JSON.parse(JSON.stringify(value)) as JsonObject;
