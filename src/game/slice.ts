// A pizza nobody ordered, cut into slices for the queue instead of the bin: nothing is thrown away, and everyone
// waiting gets some patience back (once each per evening). Not in challenges, where ingredients are free.
import { dishOf } from "./pizza";
import { destinationOf } from "./service";
import { pushToast } from "./toasts";
import type { Customer, GameState, Service } from "./types";

// Taken off everyone's wait.
export const SLICE_PATIENCE_SECONDS = 20;

const enjoysASlice = (customer: Customer): boolean => !customer.delivery && !customer.pizzaServed && customer.sliceSeconds === undefined;

/** Whether a slice of this pizza (nobody's order) would cheer someone up right now. */
export const canOfferSlice = (state: GameState, service: Service, pizzaId: string): boolean => {
  if (service.challenge) return false;
  const pizza = service.ready.find((candidate) => candidate.id === pizzaId);
  // Only a pizza is shared in slices, not a plate of pasta.
  if (!pizza || dishOf(pizza.ingredients) === "pasta" || destinationOf(state, service, pizza.ingredients)) return false;
  return service.customers.some(enjoysASlice);
};

// Mutates state.
export const offerSlice = (state: GameState, service: Service, pizzaId: string): void => {
  if (!canOfferSlice(state, service, pizzaId)) return;
  const cheered = service.customers.filter(enjoysASlice);
  cheered.forEach((customer) => {
    // Remembered, so goals about the time since they came in still count it (see game/tonight.ts).
    customer.sliceSeconds = Math.min(customer.waitedSeconds, SLICE_PATIENCE_SECONDS);
    customer.waitedSeconds -= customer.sliceSeconds;
  });
  service.ready = service.ready.filter((pizza) => pizza.id !== pizzaId);
  service.stats.slices = (service.stats.slices ?? 0) + 1;
  pushToast(state, { key: "sliceOffered", params: { count: cheered.length } }, "gold");
};
