import { INGREDIENTS_BY_ID, type IngredientId } from "../data/ingredients";
import { UPGRADES, UPGRADE_KEYS, BASE_DAILY_CHARGES } from "../data/progression";
import { clamp } from "../utils/math";
import { appealOf, fairPrice, priceAttractiveness } from "./pizza";
import { activeMenu } from "./menu";
import { levelForXp } from "./progression";
import type { GameState } from "./types";

// Rent, oven, staff: paid every evening, grows with each upgrade.
export function dailyCharges(state: GameState): number {
  return UPGRADE_KEYS.reduce((total, key) => total + UPGRADES[key].dailyCharge * state.upgrades[key], BASE_DAILY_CHARGES);
}

// Number of customers expected tonight, from room size, reputation, menu quality and variety.
export function forecastCustomers(state: GameState): number {
  const menu = activeMenu(state);
  if (!menu.length) return 0;
  const level = levelForXp(state.xp);
  const baseCount = 5 + 2 * state.upgrades.salle + Math.floor((level - 1) / 2);
  const averageQuality =
    menu.reduce(
      (total, recipe) =>
        total + priceAttractiveness(recipe.price, fairPrice(recipe.ingredients)) * (appealOf(recipe.ingredients, recipe.classic) / 1.1),
      0,
    ) / menu.length;
  const qualityFactor = clamp(averageQuality, 0.6, 1.25);
  const varietyBonus = Math.min(3, Math.floor((menu.length - 1) / 2));
  return Math.max(3, Math.round(baseCount * qualityFactor) + varietyBonus);
}

export interface RestockPlan {
  items: { id: IngredientId; quantity: number }[];
  cost: number;
}

// What to buy so that every ingredient used by the menu reaches `targetQuantity` portions.
export function restockPlan(state: GameState, targetQuantity: number): RestockPlan {
  const usedIds = new Set(activeMenu(state).flatMap((recipe) => recipe.ingredients));
  const items = [...usedIds]
    .map((id) => ({ id, quantity: Math.max(0, targetQuantity - (state.stock[id] || 0)) }))
    .filter(({ quantity }) => quantity > 0);
  const cost = items.reduce((total, { id, quantity }) => total + INGREDIENTS_BY_ID[id].cost * quantity, 0);
  return { items, cost };
}

// Income goes to the till; while in debt, half of it pays the debt down first. Mutates state.
export function receivePayment(state: GameState, amount: number): void {
  if (state.debt > 0) {
    const repaid = Math.min(state.debt, amount / 2);
    state.debt -= repaid;
    amount -= repaid;
  }
  state.money += amount;
}

// Pays what the till can, the rest goes on the debt. Mutates state.
export function payCharges(state: GameState, amount: number): void {
  if (state.money >= amount) {
    state.money -= amount;
  } else {
    state.debt += amount - state.money;
    state.money = 0;
  }
}

// Market purchases, supplier fees and upgrades all count toward the day's spending. Mutates state.
export function spend(state: GameState, amount: number): void {
  state.money -= amount;
  state.purchasesToday += amount;
}
