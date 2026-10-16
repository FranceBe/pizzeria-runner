import { OVEN_SLOTS } from "../data/progression.js";
import { haveSameIngredients } from "./pizza.js";

// Customers waiting at the counter at once; a bigger room fits one more.
export const maxQueueLength = (state) => 4 + (state.upgrades.salle >= 2 ? 1 : 0);

export const ovenSlots = (state) => OVEN_SLOTS[state.upgrades.oven];

// The customer a baked pizza goes to: the selected one if it matches, otherwise the first match.
export function customerForPizza(service, ingredients) {
  const matches = (customer) => haveSameIngredients(customer.ingredients, ingredients);
  return (
    service.customers.find((customer) => customer.id === service.selectedCustomerId && matches(customer)) ||
    service.customers.find(matches)
  );
}
