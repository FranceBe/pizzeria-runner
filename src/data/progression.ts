// Reputation points needed to reach each level: index 0 is level 1, index 1 is level 2, etc.
// Quick at first, then each level takes noticeably longer from level 4 on.
export const REPUTATION_THRESHOLDS: readonly number[] = [
  0, 70, 200, 400, 750, 1200, 1800, 2550, 3450, 4500, 5700, 7100, 8700, 10500, 12500, 14800, 17300, 20000, 23000, 26500,
];

// Indexed by oven upgrade level.
export const OVEN_SLOTS: readonly number[] = [1, 2, 2, 3];
export const BAKE_SECONDS: readonly number[] = [6, 4.5, 3, 2.2];

export const BASE_DAILY_CHARGES = 6;

// The keys are stored in save files: never rename them. Names and descriptions live in src/i18n.
export const UPGRADE_KEYS = ["oven", "salle", "deco", "commis", "terrasse", "livraison", "bar", "oven2", "oven3", "annexe"] as const;
export type UpgradeKey = (typeof UPGRADE_KEYS)[number];

export interface Upgrade {
  /** costs[n] = price to go from level n to n + 1. */
  costs: readonly number[];
  /** requiredLevel[n] = reputation level needed to go from level n to n + 1. */
  requiredLevel: readonly number[];
  /** Extra evening charges per upgrade level. */
  dailyCharge: number;
}

export const UPGRADES: Record<UpgradeKey, Upgrade> = {
  oven: { costs: [70, 180, 400], requiredLevel: [2, 4, 6], dailyCharge: 2 },
  salle: { costs: [50, 130, 280, 550], requiredLevel: [1, 3, 5, 7], dailyCharge: 3 },
  deco: { costs: [40, 120, 300], requiredLevel: [2, 4, 6], dailyCharge: 2 },
  commis: { costs: [150, 400], requiredLevel: [3, 6], dailyCharge: 5 },
  terrasse: { costs: [120, 320], requiredLevel: [4, 7], dailyCharge: 3 },
  livraison: { costs: [220], requiredLevel: [5], dailyCharge: 4 },
  bar: { costs: [90, 240], requiredLevel: [3, 5], dailyCharge: 2 },
  // Extra ovens: building one gives a single slow slot, then it improves like the first oven.
  oven2: { costs: [450, 250, 500, 900], requiredLevel: [7, 7, 8, 9], dailyCharge: 3 },
  oven3: { costs: [1100, 600, 1100, 1800], requiredLevel: [10, 11, 13, 15], dailyCharge: 4 },
  // A second address: brings in money every evening, run by someone else.
  annexe: { costs: [1500, 3000, 6000], requiredLevel: [8, 11, 14], dailyCharge: 0 },
};

/** Extra ovens, in the order they are built. */
export const EXTRA_OVEN_KEYS = ["oven2", "oven3"] as const;

// Evening income of the second address, by its level.
export const ANNEXE_INCOME: readonly number[] = [0, 30, 70, 140];

// Nonna's secret isn't bought: it is made, one jar at a time, at the market.
export const SECRET_CRAFT_COST = 10;

// Terrace: extra customers per level every day, and more on sunny days.
export const TERRACE_CUSTOMERS = 1;
export const TERRACE_SUNNY_CUSTOMERS = 2;

// Delivery: extra orders on top of the customers at the counter.
export const DELIVERY_EXTRA_ORDERS = 2;
export const DELIVERY_CHANCE = 0.25;
export const DELIVERY_FEE = 1;
// Delivered within this many seconds, the order earns an express bonus instead of a tip.
export const DELIVERY_EXPRESS_SECONDS = 45;
export const DELIVERY_EXPRESS_BONUS = 1.5;

// Commis levels that unlock each helper behaviour.
export const COMMIS_SPREADS_DOUGH = 1;
export const COMMIS_ASSEMBLES_ORDER = 2;

export function tipChanceForDecor(decorLevel: number): number {
  return 0.3 + 0.12 * decorLevel;
}
