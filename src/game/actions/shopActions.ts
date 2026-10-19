import { INGREDIENTS_BY_ID, type IngredientId } from "../../data/ingredients";
import { MARGHERITA } from "../../data/recipes";
import { MAMMA_CRAFT_COST, MAMMA_JAR_PORTIONS, SECRET_CRAFT_COST, SECRET_JAR_PORTIONS, UPGRADES } from "../../data/progression";
import { canAfford } from "../../utils/math";
import { canBorrowFromNonna, NONNA_LOAN, restockPlan, spend } from "../economy";
import { marketPrice } from "../events";
import { discoverClassics } from "../menu";
import { levelForXp } from "../progression";
import { pushToast } from "../toasts";
import { COSMETIC_PRICES, STAR_LOOKS, isLookOf, type CosmeticId, type CosmeticSlot, type LookIds } from "../../data/cosmetics";
import type { ActionHandlers, GameState } from "../types";

const addToStock = (state: GameState, id: IngredientId, quantity: number): void => {
  state.stock[id] = (state.stock[id] || 0) + quantity;
};

function chooseLook<Slot extends CosmeticSlot>(state: GameState, slot: Slot, id: LookIds[Slot]): void {
  const price: number = COSMETIC_PRICES[slot][id];
  const cosmeticId: CosmeticId = `${slot}:${id}`;
  // Star looks: earned with the days' stars, never bought.
  if ((STAR_LOOKS[cosmeticId] ?? 0) > state.lifetime.stars) return;
  if (price > 0 && !state.cosmetics.owned.includes(cosmeticId)) {
    if (!canAfford(state.money, price)) {
      pushToast(state, { key: "notEnoughMoney" }, "warn");
      return;
    }
    spend(state, price);
    state.cosmetics.owned.push(cosmeticId);
  }
  const looks: LookIds = state.cosmetics;
  looks[slot] = id;
}

export const SUPPLIER_WELCOME_PORTIONS = 4;
const NONNA_PORTIONS = 4;

export const shopActions = {
  buyIngredient(state, { ingredientId, quantity }) {
    const cost = marketPrice(state, ingredientId) * quantity;
    if (!canAfford(state.money, cost)) {
      pushToast(state, { key: "notEnoughMoney" }, "warn");
      return;
    }
    spend(state, cost);
    addToStock(state, ingredientId, quantity);
  },

  restock(state, { targetQuantity }) {
    const plan = restockPlan(state, targetQuantity);
    if (!canAfford(state.money, plan.cost)) {
      pushToast(state, { key: "notEnoughMoneyToRestock" }, "warn");
      return;
    }
    plan.items.forEach(({ id, quantity }) => addToStock(state, id, quantity));
    spend(state, plan.cost);
    pushToast(state, { key: "restocked", params: { cost: plan.cost } });
  },

  signSupplier(state, { ingredientId }) {
    const ingredient = INGREDIENTS_BY_ID[ingredientId];
    const levelTooLow = levelForXp(state.xp) < ingredient.requiredLevel;
    if (levelTooLow || state.money < ingredient.supplierFee || state.unlocked[ingredientId]) return;
    spend(state, ingredient.supplierFee);
    state.unlocked[ingredientId] = true;
    addToStock(state, ingredientId, SUPPLIER_WELCOME_PORTIONS);
    pushToast(state, { key: "supplierSigned", params: { ingredientId, portions: SUPPLIER_WELCOME_PORTIONS } }, "gold");
    discoverClassics(state);
  },

  // A loan from Nonna, at most once a day: it goes on the tab, repaid with half of the next sales.
  borrowFromNonna(state) {
    if (!canBorrowFromNonna(state)) return;
    state.lastNonnaLoanDay = state.day;
    state.money += NONNA_LOAN;
    state.debt += NONNA_LOAN;
    pushToast(state, { key: "nonnaLoan", params: { amount: NONNA_LOAN } }, "gold");
  },

  // Safety net when the player is out of both stock and money; once a day.
  callNonna(state) {
    state.lastNonnaVisitDay = state.day;
    MARGHERITA.ingredients.forEach((id) => addToStock(state, id, NONNA_PORTIONS));
    pushToast(state, { key: "nonna" }, "gold");
  },

  buyUpgrade(state, { upgradeKey }) {
    const upgrade = UPGRADES[upgradeKey];
    const currentLevel = state.upgrades[upgradeKey];
    if (currentLevel >= upgrade.costs.length) return;
    const cost = upgrade.costs[currentLevel];
    if (levelForXp(state.xp) < upgrade.requiredLevel[currentLevel] || state.money < cost) return;
    spend(state, cost);
    state.upgrades[upgradeKey] = currentLevel + 1;
    pushToast(state, { key: "upgradeBought", params: { upgradeKey, level: currentLevel + 1 } }, "gold");
  },

  // One jar of Nonna's secret, made by hand: it never comes with the restock buttons.
  craftSecret(state) {
    if (!state.secretIngredient) return;
    if (!canAfford(state.money, SECRET_CRAFT_COST)) {
      pushToast(state, { key: "notEnoughMoney" }, "warn");
      return;
    }
    spend(state, SECRET_CRAFT_COST);
    state.secretStock += SECRET_JAR_PORTIONS;
  },

  craftMamma(state) {
    if (!state.mammaSecret) return;
    if (!canAfford(state.money, MAMMA_CRAFT_COST)) {
      pushToast(state, { key: "notEnoughMoney" }, "warn");
      return;
    }
    spend(state, MAMMA_CRAFT_COST);
    state.mammaStock += MAMMA_JAR_PORTIONS;
  },

  // Picks a look for the pizzeria, buying it first if needed. Free looks are always owned.
  chooseCosmetic(state, { slot, id }) {
    if (isLookOf(slot, id)) chooseLook(state, slot, id);
  },
} satisfies Partial<ActionHandlers>;
