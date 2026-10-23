// The mystery guest (a day event): an inspector from the guide, incognito among tonight's customers. Nothing gives
// them away during service; their stars, and what they bring, are revealed on the receipt.
import { MYSTERY_LATEST_SHARE, MYSTERY_PRESS_STARS, MYSTERY_REWARDS } from "../data/events";
import { payBonus } from "./economy";
import { writePressReview } from "./reviews";
import { warmthOf } from "./streak";
import type { Customer, GameState, Mood, MysteryVisit, ReadyPizza, Service } from "./types";
import { randomIndex } from "../utils/random";

const WARMTH_PENALTY = { hot: 0, warm: 1, cold: 2 } as const;

export const mysteryStars = (mood: Mood, waitingSeconds?: number): number =>
  Math.max(1, 5 - mood - WARMTH_PENALTY[warmthOf(waitingSeconds)]);

// When the restaurant opens on a mystery guest's day: which arrival they come with. Mutates the service.
export const planMysteryGuest = (state: GameState, service: Service, customerCount: number): void => {
  service.arrivals = 0;
  service.mysteryVisit = null;
  if (state.event !== "mysteryGuest") {
    service.mysteryArrival = null;
    return;
  }
  const latest = Math.max(1, Math.floor(customerCount * MYSTERY_LATEST_SHARE));
  service.mysteryArrival = 1 + randomIndex(latest);
};

// Someone on their own, passing by: the guest could be them.
const couldBeTheGuest = (state: GameState, customer: Customer): boolean =>
  !customer.tableId && !customer.critic && !customer.delivery && !customer.celebrity && !customer.forDessert && !customer.birthday &&
  !state.customerBook[customer.name]?.regular;

// New customers come in: once their turn has come, the first one who could be the guest is. Mutates the service.
export const welcomeMaybeMystery = (state: GameState, service: Service, party: Customer[]): void => {
  const before = service.arrivals ?? 0;
  service.arrivals = before + party.length;
  if (service.mysteryArrival == null || service.customers.some((customer) => customer.mystery) || service.mysteryVisit) return;
  if (service.arrivals < service.mysteryArrival) return;
  const guest = party.find((customer) => couldBeTheGuest(state, customer));
  if (guest) guest.mystery = true;
};

// The guest was served: their stars, kept for the receipt. Mutates the service.
export const noteMysteryServed = (service: Service, customer: Customer, mood: Mood, pizza: ReadyPizza): void => {
  if (!customer.mystery) return;
  const stars = mysteryStars(mood, pizza.waitingSeconds);
  service.mysteryVisit = { name: customer.name, recipeId: customer.recipeId, recipeName: customer.recipeName, stars, ...MYSTERY_REWARDS[stars] };
};

// The guest sent home unserved (the kitchen closing early): one star, kept for the receipt. Mutates the service.
export const noteMysteryLeaving = (service: Service): void => {
  const guest = service.customers.find((customer) => customer.mystery);
  if (!guest || service.mysteryVisit) return;
  service.mysteryVisit = { name: guest.name, recipeId: guest.recipeId, recipeName: guest.recipeName, stars: 1, ...MYSTERY_REWARDS[1] };
};

// At closing: the guest's verdict (one star if they were still waiting), its reward, and their article for a good one.
// Null when they never came in. Mutates state.
export const settleMysteryGuest = (state: GameState, service: Service): MysteryVisit | null => {
  if (state.event !== "mysteryGuest" || service.challenge) return null;
  const waiting = service.customers.find((customer) => customer.mystery);
  const visit: MysteryVisit | null =
    service.mysteryVisit ??
    (waiting ? { name: waiting.name, recipeId: waiting.recipeId, recipeName: waiting.recipeName, stars: 1, ...MYSTERY_REWARDS[1] } : null);
  if (!visit) return null;
  state.xp += visit.xp;
  service.stats.xp += visit.xp;
  if (visit.money) payBonus(state, visit.money);
  if (visit.stars >= MYSTERY_PRESS_STARS) {
    writePressReview(state, { name: visit.name, recipeId: visit.recipeId, recipeName: visit.recipeName }, visit.stars, { mystery: true });
  }
  return visit;
};
