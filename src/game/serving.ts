// What happens when an order is served: payment, tips and bonuses, reputation, and what the game remembers.
import { DELIVERY_EXPRESS_BONUS, DELIVERY_EXPRESS_SECONDS } from "../data/progression";
import type { Pairing } from "../data/recipes";
import { hasSpecialRequest, moodForWait, rollTip } from "./customers";
import { receivePayment } from "./economy";
import { fillingsOf, isDessert } from "./pizza";
import { pushPop, pushToast } from "./toasts";
import type { Customer, GameState, Mood, Service } from "./types";

const SPECIAL_REQUEST_XP_BONUS = 3;
const AS_USUAL_XP_BONUS = 4;
const NEW_PAIRING_XP = 5;
// Reputation from the critic, by mood when served.
const CRITIC_XP: Record<Mood, number> = [40, 25, 12, 12];
// Stars in the critic's review, by mood when served.
const CRITIC_STARS: Record<Mood, number> = [5, 4, 3, 3];
// Paid per person when the whole table was served while still happy or patient.
const TABLE_BONUS_PER_PERSON = 1.5;
const BIRTHDAY_GIFT = 5;
const BIRTHDAY_XP = 10;
const OFFERED_DRINK_XP = 5;
// Nonna's secret: this often, the customer tips as much as the pizza costs.
const SECRET_TIP_CHANCE = 0.3;
// Serving each of these once earns Nonna's trust: she shares her secret ingredient.
const NONNA_TRUST_RECIPES = ["nonna", "nonnarosa", "segreto"];
// Points per pizza in the daily challenge: a base, per filling, and by mood when served.
const CHALLENGE_BASE_POINTS = 10;
const CHALLENGE_FILLING_POINTS = 3;
const CHALLENGE_MOOD_POINTS: Record<Mood, number> = [10, 6, 3, 0];

export function serveForChallenge(service: Service, customer: Customer): void {
  if (!service.challenge) return;
  const mood = moodForWait(customer.waitedSeconds);
  service.challenge.score +=
    CHALLENGE_BASE_POINTS + CHALLENGE_FILLING_POINTS * fillingsOf(customer.ingredients).length + CHALLENGE_MOOD_POINTS[mood];
  if (mood === 0) service.challenge.happy += 1;
  service.stats.served += 1;
}

// Money, tips, the express bonus and the birthday gift for a served order. Returns the extra given on top of the price.
export function collectPayment(state: GameState, customer: Customer): number {
  let extra = 0;
  if (customer.delivery) {
    if (customer.waitedSeconds < DELIVERY_EXPRESS_SECONDS) extra = DELIVERY_EXPRESS_BONUS;
  } else if (!customer.critic) {
    extra = rollTip(state, customer);
  }
  const gift = customer.birthday ? BIRTHDAY_GIFT : 0;
  receivePayment(state, customer.price + extra + gift);
  pushPop(state, customer.price, "money");
  if (extra) pushPop(state, extra, customer.delivery ? "express" : "tip");
  if (gift) {
    pushPop(state, gift, "gift");
    pushToast(state, { key: "birthday", params: { name: customer.name } }, "gold");
    state.lifetime.birthdays += 1;
  }
  return extra + gift;
}

// The table bonus, once the last member of a table is served. Returns it.
export function settleTable(state: GameState, service: Service, customer: Customer): number {
  const table = customer.tableId ? service.tables?.[customer.tableId] : undefined;
  if (!table || !customer.tableId) return 0;
  table.served += 1;
  table.allHappy = table.allHappy && moodForWait(customer.waitedSeconds) <= 1;
  if (table.served < table.size) return 0;
  delete service.tables?.[customer.tableId];
  if (!table.allHappy) return 0;
  const bonus = TABLE_BONUS_PER_PERSON * table.size;
  receivePayment(state, bonus);
  pushPop(state, bonus, "table");
  pushToast(state, { key: "happyTable", params: { size: table.size } }, "gold");
  state.lifetime.happyTables += 1;
  return bonus;
}

// Nonna's secret, now and then: a tip as big as the pizza. Customers can't tell why. Returns it.
export function secretBonus(state: GameState, customer: Customer, hasSecret: boolean | undefined): number {
  if (!hasSecret || Math.random() >= SECRET_TIP_CHANCE) return 0;
  receivePayment(state, customer.price);
  pushPop(state, customer.price, "secret");
  pushToast(state, { key: "secretTip", params: { name: customer.name } }, "gold");
  return customer.price;
}

export function maybeShareNonnasSecret(state: GameState): void {
  if (state.secretIngredient) return;
  if (!NONNA_TRUST_RECIPES.every((id) => (state.lifetime.byRecipe[id]?.count ?? 0) > 0)) return;
  state.secretIngredient = true;
  pushToast(state, { key: "secretFromNonna" }, "gold");
}

// Reputation for a served order, including the critic's review.
export function reputationFor(state: GameState, customer: Customer, newPairings: readonly Pairing[]): number {
  const mood = moodForWait(customer.waitedSeconds);
  let xp = 6 + 2 * fillingsOf(customer.ingredients).length;
  if (hasSpecialRequest(customer)) xp += SPECIAL_REQUEST_XP_BONUS;
  if (customer.asUsual) xp += AS_USUAL_XP_BONUS;
  if (customer.birthday) xp += BIRTHDAY_XP;
  if (customer.drinkOffered) xp += OFFERED_DRINK_XP;
  xp += NEW_PAIRING_XP * newPairings.length;
  if (customer.critic) {
    xp += CRITIC_XP[mood];
    pushToast(state, { key: "critic", params: { name: customer.name, stars: CRITIC_STARS[mood] } }, "gold");
  }
  return xp;
}

export function recordLifetime(state: GameState, customer: Customer, tip: number): void {
  const { lifetime } = state;
  const mood = moodForWait(customer.waitedSeconds);
  lifetime.served += 1;
  lifetime.revenue += customer.price;
  lifetime.tips += tip;
  if (mood === 0) lifetime.happyServed += 1;
  if (customer.asUsual) lifetime.asUsualServed += 1;
  if (customer.delivery) lifetime.deliveries += 1;
  if (customer.critic && mood <= 1) lifetime.criticsPleased += 1;
  if (isDessert(customer.ingredients)) lifetime.sweetServed += 1;
  const sales = lifetime.byRecipe[customer.recipeId] ?? { name: customer.recipeName, count: 0 };
  lifetime.byRecipe[customer.recipeId] = { ...sales, count: sales.count + 1 };
}
