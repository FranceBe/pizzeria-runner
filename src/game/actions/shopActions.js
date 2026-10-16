import { INGREDIENTS_BY_ID } from "../../data/ingredients.js";
import { MARGHERITA } from "../../data/recipes.js";
import { UPGRADES } from "../../data/progression.js";
import { canAfford } from "../../utils/math.js";
import { restockPlan, spend } from "../economy.js";
import { discoverClassics } from "../menu.js";
import { levelForXp } from "../progression.js";
import { pushToast } from "../toasts.js";

export const SUPPLIER_WELCOME_PORTIONS = 4;
const NONNA_PORTIONS = 4;

export const shopActions = {
  buyIngredient(state, { ingredientId, quantity }) {
    const cost = INGREDIENTS_BY_ID[ingredientId].cost * quantity;
    if (!canAfford(state.money, cost)) {
      pushToast(state, "notEnoughMoney", {}, "warn");
      return;
    }
    spend(state, cost);
    state.stock[ingredientId] = (state.stock[ingredientId] || 0) + quantity;
  },

  restock(state, { targetQuantity }) {
    const plan = restockPlan(state, targetQuantity);
    if (!canAfford(state.money, plan.cost)) {
      pushToast(state, "notEnoughMoneyToRestock", {}, "warn");
      return;
    }
    plan.items.forEach(([id, quantity]) => (state.stock[id] = (state.stock[id] || 0) + quantity));
    spend(state, plan.cost);
    pushToast(state, "restocked", { cost: plan.cost });
  },

  signSupplier(state, { ingredientId }) {
    const ingredient = INGREDIENTS_BY_ID[ingredientId];
    const levelTooLow = levelForXp(state.xp) < ingredient.requiredLevel;
    if (levelTooLow || state.money < ingredient.supplierFee || state.unlocked[ingredientId]) return;
    spend(state, ingredient.supplierFee);
    state.unlocked[ingredientId] = true;
    state.stock[ingredientId] = (state.stock[ingredientId] || 0) + SUPPLIER_WELCOME_PORTIONS;
    pushToast(state, "supplierSigned", { ingredientId, portions: SUPPLIER_WELCOME_PORTIONS }, "gold");
    discoverClassics(state);
  },

  // Safety net when the player is out of both stock and money; once a day.
  callNonna(state) {
    state.lastNonnaVisitDay = state.day;
    MARGHERITA.ingredients.forEach((id) => (state.stock[id] = (state.stock[id] || 0) + NONNA_PORTIONS));
    pushToast(state, "nonna", {}, "gold");
  },

  buyUpgrade(state, { upgradeKey }) {
    const upgrade = UPGRADES[upgradeKey];
    const currentLevel = state.upgrades[upgradeKey];
    if (currentLevel >= upgrade.costs.length) return;
    const cost = upgrade.costs[currentLevel];
    if (levelForXp(state.xp) < upgrade.requiredLevel[currentLevel] || state.money < cost) return;
    spend(state, cost);
    state.upgrades[upgradeKey] = currentLevel + 1;
    pushToast(state, "upgradeBought", { upgradeKey, level: currentLevel + 1 }, "gold");
  },
};
