import type { IngredientId } from "../data/ingredients";
import {
  UPGRADES, UPGRADE_KEYS, BASE_DAILY_CHARGES, DELIVERY_EXTRA_ORDERS, TERRACE_CUSTOMERS, TERRACE_SUNNY_CUSTOMERS,
} from "../data/progression";
import { clamp } from "../utils/math";
import { fairPrice, priceAttractiveness } from "./pizza";
import { marketPrice, todaysEvent } from "./events";
import { activeMenu, recipeAppeal } from "./menu";
import { levelForXp } from "./progression";
import type { GameState } from "./types";

// Rent, oven, staff: paid every evening, grows with each upgrade.
export const dailyCharges = (state: GameState): number => {
  return UPGRADE_KEYS.reduce((total, key) => total + UPGRADES[key].dailyCharge * state.upgrades[key], BASE_DAILY_CHARGES);
};

// Number of orders expected tonight, from room size, reputation, menu quality and variety,
// then today's event, the terrace and deliveries.
export const forecastCustomers = (state: GameState): number => {
  const menu = activeMenu(state);
  if (!menu.length) return 0;
  const level = levelForXp(state.xp);
  const baseCount = 5 + 2 * state.upgrades.salle + Math.floor((level - 1) / 2);
  const averageQuality =
    menu.reduce(
      (total, recipe) =>
        total + priceAttractiveness(recipe.price, fairPrice(recipe.ingredients)) * (recipeAppeal(recipe) / 1.1),
      0,
    ) / menu.length;
  const qualityFactor = clamp(averageQuality, 0.6, 1.25);
  const varietyBonus = Math.min(3, Math.floor((menu.length - 1) / 2));
  const atTheCounter = Math.max(3, Math.round(baseCount * qualityFactor) + varietyBonus);
  const { terrasse, livraison } = state.upgrades;
  const terrace = terrasse * (TERRACE_CUSTOMERS + (state.event === "sunny" ? TERRACE_SUNNY_CUSTOMERS : 0));
  const deliveries = livraison ? DELIVERY_EXTRA_ORDERS : 0;
  return Math.max(3, Math.round(atTheCounter * todaysEvent(state).customerFactor)) + terrace + deliveries;
};

export interface RestockPlan {
  items: { id: IngredientId; quantity: number }[];
  cost: number;
}

// What to buy so that every ingredient used by the menu reaches `targetQuantity` portions. Gluten-free
// customers swap the dough, so once the gluten-free dough is signed it is topped up too.
export const restockPlan = (state: GameState, targetQuantity: number): RestockPlan => {
  const usedIds = new Set(activeMenu(state).flatMap((recipe) => recipe.ingredients));
  if (state.unlocked.pateSG && usedIds.has("pate")) usedIds.add("pateSG");
  const items = [...usedIds]
    .map((id) => ({ id, quantity: Math.max(0, targetQuantity - (state.stock[id] || 0)) }))
    .filter(({ quantity }) => quantity > 0);
  const cost = items.reduce((total, { id, quantity }) => total + marketPrice(state, id) * quantity, 0);
  return { items, cost };
};

// When the till runs dry, Nonna lends a little: it goes on the tab, repaid with half of the next sales.
export const NONNA_LOAN = 30;
// She won't lend past this much debt.
const MAX_DEBT_FOR_LOAN = 90;

export const canBorrowFromNonna = (state: GameState): boolean =>
  state.lastNonnaLoanDay !== state.day && state.debt + NONNA_LOAN <= MAX_DEBT_FOR_LOAN;

// Income goes to the till; while in debt, half of it pays the debt down first. Mutates state.
export const receivePayment = (state: GameState, amount: number): void => {
  if (state.debt > 0) {
    const repaid = Math.min(state.debt, amount / 2);
    state.debt -= repaid;
    amount -= repaid;
  }
  state.money += amount;
};

// Pays what the till can, the rest goes on the debt. Mutates state.
export const payCharges = (state: GameState, amount: number): void => {
  if (state.money >= amount) {
    state.money -= amount;
  } else {
    state.debt += amount - state.money;
    state.money = 0;
  }
};

// Market purchases, supplier fees and upgrades all count toward the day's spending. Mutates state.
export const spend = (state: GameState, amount: number): void => {
  state.money -= amount;
  state.purchasesToday += amount;
};
