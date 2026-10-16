// Reputation points needed to reach each level: index 0 is level 1, index 1 is level 2, etc.
export const REPUTATION_THRESHOLDS: readonly number[] = [0, 70, 200, 400, 680, 1050, 1520, 2100, 2800, 3700, 4800];

// Indexed by oven upgrade level.
export const OVEN_SLOTS: readonly number[] = [1, 2, 2, 3];
export const BAKE_SECONDS: readonly number[] = [6, 4.5, 3, 2.2];

export const BASE_DAILY_CHARGES = 6;

// The keys are stored in save files: never rename them. Names and descriptions live in src/i18n.
export const UPGRADE_KEYS = ["oven", "salle", "deco", "commis", "terrasse", "livraison"] as const;
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
};

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
