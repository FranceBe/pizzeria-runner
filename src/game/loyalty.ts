// Loyal suppliers: the more of an ingredient the pizzeria buys, the cheaper it gets (a discount per tier); at the top
// tier, the supplier also sends a few portions each week, as a thank-you.
import type { IngredientId } from "../data/ingredients";
import { pushToast } from "./toasts";
import type { GameState } from "./types";

// Portions bought (lifetime) to reach each tier, and its discount.
export const LOYALTY_TIERS = [
  { portions: 40, discount: 0.05 },
  { portions: 120, discount: 0.1 },
  { portions: 300, discount: 0.15 },
] as const;
// Sent at the start of each week by every supplier at the top tier.
export const LOYALTY_GIFT_PORTIONS = 5;

/** Portions of it bought so far. */
const boughtOf = (state: GameState, id: IngredientId): number => state.bought?.[id] ?? 0;

/** The tier reached with this supplier: 0 (none) to LOYALTY_TIERS.length. */
export const loyaltyTier = (state: GameState, id: IngredientId): number =>
  LOYALTY_TIERS.filter((tier) => boughtOf(state, id) >= tier.portions).length;

export const loyaltyDiscount = (state: GameState, id: IngredientId): number => {
  const tier = loyaltyTier(state, id);
  return tier ? LOYALTY_TIERS[tier - 1].discount : 0;
};

/** Where things stand with this supplier, for the market: portions bought, and those for the next tier (null at the top). */
export const loyaltyProgress = (state: GameState, id: IngredientId): { bought: number; next: number | null } => {
  const tier = loyaltyTier(state, id);
  return { bought: boughtOf(state, id), next: tier < LOYALTY_TIERS.length ? LOYALTY_TIERS[tier].portions : null };
};

// Portions bought at the market count towards loyalty; a new tier is announced. Mutates state.
export const recordPurchase = (state: GameState, id: IngredientId, portions: number): void => {
  if (portions <= 0) return;
  const before = loyaltyTier(state, id);
  state.bought = { ...state.bought, [id]: boughtOf(state, id) + portions };
  const after = loyaltyTier(state, id);
  if (after > before) pushToast(state, { key: "loyaltyTier", params: { ingredientId: id, discount: Math.round(LOYALTY_TIERS[after - 1].discount * 100) } }, "gold");
};

// On the first morning of a week: the top-tier suppliers' thank-you. Mutates state.
export const deliverLoyaltyGifts = (state: GameState): void => {
  const loyal = (Object.keys(state.bought ?? {}) as IngredientId[]).filter((id) => state.unlocked[id] && loyaltyTier(state, id) === LOYALTY_TIERS.length);
  if (!loyal.length) return;
  loyal.forEach((id) => (state.stock[id] = (state.stock[id] ?? 0) + LOYALTY_GIFT_PORTIONS));
  pushToast(state, { key: "loyaltyGifts", params: { ingredientIds: loyal, portions: LOYALTY_GIFT_PORTIONS } }, "gold");
};
