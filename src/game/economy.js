import { INGREDIENTS_BY_ID } from "../data/ingredients.js";
import { UPGRADES, BASE_DAILY_CHARGES } from "../data/progression.js";
import { clamp } from "../utils/math.js";
import { appealOf, fairPrice, priceAttractiveness } from "./pizza.js";
import { activeMenu } from "./menu.js";
import { levelForXp } from "./progression.js";

// Rent, oven, staff: paid every evening, grows with each upgrade.
export function dailyCharges(state) {
  return Object.entries(UPGRADES).reduce(
    (total, [key, upgrade]) => total + upgrade.dailyCharge * state.upgrades[key],
    BASE_DAILY_CHARGES,
  );
}

// Number of customers expected tonight, from room size, reputation, menu quality and variety.
export function forecastCustomers(state) {
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

// What to buy so that every ingredient used by the menu reaches `targetQuantity` portions.
export function restockPlan(state, targetQuantity) {
  const usedIds = new Set(activeMenu(state).flatMap((recipe) => recipe.ingredients));
  const items = [...usedIds]
    .map((id) => [id, Math.max(0, targetQuantity - (state.stock[id] || 0))])
    .filter(([, quantity]) => quantity > 0);
  const cost = items.reduce((total, [id, quantity]) => total + INGREDIENTS_BY_ID[id].cost * quantity, 0);
  return { items, cost };
}

// Income goes to the till; while in debt, half of it pays the debt down first. Mutates state.
export function receivePayment(state, amount) {
  if (state.debt > 0) {
    const repaid = Math.min(state.debt, amount / 2);
    state.debt -= repaid;
    amount -= repaid;
  }
  state.money += amount;
}

// Pays what the till can, the rest goes on the debt. Mutates state.
export function payCharges(state, amount) {
  if (state.money >= amount) {
    state.money -= amount;
  } else {
    state.debt += amount - state.money;
    state.money = 0;
  }
}

// Market purchases, supplier fees and upgrades all count toward the day's spending. Mutates state.
export function spend(state, amount) {
  state.money -= amount;
  state.purchasesToday += amount;
}
