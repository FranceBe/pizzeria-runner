import type { IngredientId } from "../data/ingredients";
import { BAKE_SECONDS, BARMAN_LEVEL, EXTRA_OVEN_KEYS, OVEN_SLOTS } from "../data/progression";
import { BATCH_ID, batchItemFor } from "./batch";
import { marketPrice } from "./events";
import { haveSameIngredients } from "./pizza";
import type { Customer, GameState, Service } from "./types";

// Orders open at once; a bigger room and a terrace fit one more each.
export const maxQueueLength = (state: GameState): number =>
  4 + (state.upgrades.salle >= 2 ? 1 : 0) + (state.upgrades.terrasse >= 1 ? 1 : 0);

export interface Oven {
  index: number;
  slots: number;
  bakeSeconds: number;
}

// The first oven, then each extra oven built: a new oven starts like the first one did, and improves the same way.
export const ovensOf = (state: GameState): Oven[] => {
  const first = { index: 0, slots: OVEN_SLOTS[state.upgrades.oven], bakeSeconds: BAKE_SECONDS[state.upgrades.oven] };
  // Power cut: the first oven alone, one pizza at a time.
  if (state.event === "powerCut") return [{ ...first, slots: 1 }];
  const extras = EXTRA_OVEN_KEYS.map((key) => state.upgrades[key])
    .filter((level) => level > 0)
    .map((level, position) => ({ index: position + 1, slots: OVEN_SLOTS[level - 1], bakeSeconds: BAKE_SECONDS[level - 1] }));
  return [first, ...extras];
};

export const ovenSlots = (state: GameState): number => ovensOf(state).reduce((total, oven) => total + oven.slots, 0);

const pizzasIn = (service: Service, ovenIndex: number): number =>
  service.oven.filter((pizza) => (pizza.ovenIndex ?? 0) === ovenIndex).length;

// Nothing more can come out of the kitchen: no pizza in the oven or on the pass, and every waiting order
// misses something the fridge doesn't have and the till can't pay for. The service screen then offers a way out.
// With the barman hired, the customer whose drink he is pouring: the first one still waiting for a drink.
export const barmanTarget = (state: GameState, service: Service): Customer | undefined =>
  state.upgrades.bar >= BARMAN_LEVEL && !service.challenge
    ? service.customers.find((customer) => customer.drink && !customer.drinkServed)
    : undefined;

export const isStuck = (state: GameState, service: Service): boolean => {
  const waitingForPizza = service.customers.filter((customer) => !customer.pizzaServed);
  if (service.challenge || service.oven.length || service.ready.length || !waitingForPizza.length) return false;
  return waitingForPizza.every((customer) => {
    const missing = customer.ingredients.filter((id) => !service.board.includes(id) && (state.stock[id] || 0) < 1);
    return missing.length > 0 && missing.reduce((total, id) => total + marketPrice(state, id), 0) > state.money;
  });
};

// Where the next pizza goes: the fastest oven with room, or undefined when they are all full.
export const ovenWithRoom = (state: GameState, service: Service): Oven | undefined => {
  return ovensOf(state)
    .filter((oven) => pizzasIn(service, oven.index) < oven.slots)
    .sort((a, b) => a.bakeSeconds - b.bakeSeconds)[0];
};

export const selectedCustomer = (service: Service): Customer | undefined =>
  service.customers.find((customer) => customer.id === service.selectedCustomerId);

// Where a baked pizza goes: to the group order when its ticket is selected and needs it, otherwise to the
// customer it matches (the selected one first), otherwise to the group order if it needs it.
export type Destination = { customer: Customer } | { batch: true } | null;

export const destinationOf = (state: GameState, service: Service, ingredients: readonly IngredientId[]): Destination => {
  const forBatch = Boolean(batchItemFor(state, service, ingredients));
  if (forBatch && service.selectedCustomerId === BATCH_ID) return { batch: true };
  const customer = customerForPizza(service, ingredients);
  if (customer) return { customer };
  return forBatch ? { batch: true } : null;
};

// The customer a baked pizza goes to: the selected one if it matches, otherwise the first match.
// Someone who already had their pizza (and waits for a drink) takes no other.
export const customerForPizza = (service: Service, ingredients: readonly IngredientId[]): Customer | undefined => {
  const matches = (customer: Customer) => !customer.pizzaServed && haveSameIngredients(customer.ingredients, ingredients);
  return (
    service.customers.find((customer) => customer.id === service.selectedCustomerId && matches(customer)) ||
    service.customers.find(matches)
  );
};
