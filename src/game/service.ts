import type { DayEventId } from "../data/events";
import type { IngredientId } from "../data/ingredients";
import { BAKE_SECONDS, EXTRA_OVEN_KEYS, OVEN_SLOTS, STOVE_BURNERS, STOVE_SECONDS, WOOD_FIRED_STAGE } from "../data/progression";
import { BATCH_ID, batchItemFor } from "./batch";
import { marketPrice } from "./events";
import { cooksInOven, haveSameIngredients } from "./pizza";
import { barmanProfile } from "./staff";
import type { Customer, GameState, Service } from "./types";

// Orders open at once; a bigger room and a terrace fit one more each.
export const maxQueueLength = (state: GameState): number =>
  4 + (state.upgrades.salle >= 2 ? 1 : 0) + (state.upgrades.terrasse >= 1 ? 1 : 0);

export interface Oven {
  index: number;
  slots: number;
  bakeSeconds: number;
  isWoodFired: boolean;
  /** The trattoria's stove (its burners) cooks pasta; ovens bake pizzas and lasagne. */
  isStove?: boolean;
}

const ovenAt = (index: number, stage: number): Oven => ({
  index,
  slots: OVEN_SLOTS[stage],
  bakeSeconds: BAKE_SECONDS[stage],
  isWoodFired: stage >= WOOD_FIRED_STAGE,
});

// Every oven built, before any incident: the first one, then the extra one, which starts like the first one did.
const builtOvens = (state: GameState): Oven[] => [
  ovenAt(0, state.upgrades.oven),
  ...EXTRA_OVEN_KEYS.map((key) => state.upgrades[key])
    .filter((level) => level > 0)
    .map((level, position) => ovenAt(position + 1, level - 1)),
];

// The trattoria's stove, once open: its burners come after the ovens.
const stoveOf = (state: GameState, index: number): Oven[] =>
  state.upgrades.trattoria > 0
    ? [{ index, slots: STOVE_BURNERS[state.upgrades.trattoria], bakeSeconds: STOVE_SECONDS[state.upgrades.trattoria], isWoodFired: false, isStove: true }]
    : [];

export const ovensOf = (state: GameState): Oven[] => {
  const ovens = builtOvens(state);
  const stove = stoveOf(state, ovens.length);
  if (state.event !== "powerCut") return [...ovens, ...stove];
  // Power cut (or no wood delivered): one oven, one pizza at a time. A wood-fired one keeps going without power, and
  // so does the stove (on gas).
  const working = ovens.find((oven) => oven.isWoodFired) ?? ovens[0];
  return [{ ...working, slots: 1 }, ...stove];
};

// The power cut incident, told as a missing wood delivery when every oven burns wood.
export const isWoodShortage = (state: GameState): boolean => builtOvens(state).every((oven) => oven.isWoodFired);

// How a day's incident is told to the player.
export const shownEvent = (state: GameState, event: DayEventId): DayEventId | "woodShortage" =>
  event === "powerCut" && isWoodShortage(state) ? "woodShortage" : event;

export const ovenSlots = (state: GameState): number => ovensOf(state).reduce((total, oven) => total + oven.slots, 0);

const pizzasIn = (service: Service, ovenIndex: number): number =>
  service.oven.filter((pizza) => (pizza.ovenIndex ?? 0) === ovenIndex).length;

// Nothing more can come out of the kitchen: no pizza in the oven or on the pass, and every waiting order
// misses something the fridge doesn't have and the till can't pay for. The service screen then offers a way out.
// With the barman hired, the customer whose drink he is pouring: the first one still waiting for a drink.
export const barmanTarget = (state: GameState, service: Service): Customer | undefined =>
  barmanProfile(state) && !service.challenge
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

// Where the next dish goes: the fastest oven (the stove, for pasta) with room, or undefined when they are all full.
export const ovenWithRoom = (state: GameState, service: Service, ingredients: readonly IngredientId[] = service.board): Oven | undefined => {
  const onStove = !cooksInOven(ingredients);
  return ovensOf(state)
    .filter((oven) => Boolean(oven.isStove) === onStove && pizzasIn(service, oven.index) < oven.slots)
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
