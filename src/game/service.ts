import type { IngredientId } from "../data/ingredients";
import { OVEN_SLOTS } from "../data/progression";
import { haveSameIngredients } from "./pizza";
import type { Customer, GameState, Service } from "./types";

// Customers waiting at the counter at once; a bigger room fits one more.
export const maxQueueLength = (state: GameState): number => 4 + (state.upgrades.salle >= 2 ? 1 : 0);

export const ovenSlots = (state: GameState): number => OVEN_SLOTS[state.upgrades.oven];

export const selectedCustomer = (service: Service): Customer | undefined =>
  service.customers.find((customer) => customer.id === service.selectedCustomerId);

// The customer a baked pizza goes to: the selected one if it matches, otherwise the first match.
export function customerForPizza(service: Service, ingredients: readonly IngredientId[]): Customer | undefined {
  const matches = (customer: Customer) => haveSameIngredients(customer.ingredients, ingredients);
  return (
    service.customers.find((customer) => customer.id === service.selectedCustomerId && matches(customer)) ||
    service.customers.find(matches)
  );
}
