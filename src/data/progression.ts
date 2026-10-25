// Reputation points needed to reach each level: index 0 is level 1, index 1 is level 2, etc.
// Quick at first, then each level takes noticeably longer from level 4 on.
export const REPUTATION_THRESHOLDS: readonly number[] = [
  0, 70, 200, 400, 750, 1200, 1800, 2550, 3450, 4500, 5700, 7100, 8700, 10500, 12500, 14800, 17300, 20000, 23000, 26500,
];

// An oven's stages, as it is improved: one slot, then two, then faster, then wood-fired. The first oven starts at stage 0;
// the second starts there when built (its level minus one). Two pizzas per oven at most: more can't be kept up with.
export const OVEN_SLOTS: readonly number[] = [1, 2, 2, 2];
export const BAKE_SECONDS: readonly number[] = [6, 4.5, 3, 3];
export const WOOD_FIRED_STAGE = 3;
// A pizza from a wood-fired oven is better: a tip more likely, and a little more reputation.
export const WOOD_FIRED_TIP_BONUS = 0.1;
export const WOOD_FIRED_XP_BONUS = 2;

export const BASE_DAILY_CHARGES = 6;

// The keys are stored in save files: never rename them. Names and descriptions live in src/i18n.
export const UPGRADE_KEYS = [
  "oven", "salle", "deco", "commis", "drawer", "terrasse", "livraison", "bar", "waiter", "oven2", "annexe",
] as const;
export type UpgradeKey = (typeof UPGRADE_KEYS)[number];

export interface Upgrade {
  /** costs[n] = price to go from level n to n + 1. */
  costs: readonly number[];
  /** requiredLevel[n] = reputation level needed to go from level n to n + 1. */
  requiredLevel: readonly number[];
  /** Extra evening charges per upgrade level. */
  dailyCharge: number;
  /** A comfort, not an advantage: sold back for everything it cost. */
  isComfort?: boolean;
}

export const UPGRADES: Record<UpgradeKey, Upgrade> = {
  oven: { costs: [70, 180, 400], requiredLevel: [2, 4, 6], dailyCharge: 2 },
  salle: { costs: [50, 130, 280, 550], requiredLevel: [1, 3, 5, 7], dailyCharge: 3 },
  deco: { costs: [40, 120, 300], requiredLevel: [2, 4, 6], dailyCharge: 2 },
  // The post's own upkeep; whoever fills it is paid on top (data/staff.ts).
  commis: { costs: [150, 350, 600], requiredLevel: [3, 6, 8], dailyCharge: 2 },
  // Tidy prep line: the pans tonight's menu doesn't use go in a drawer. A comfort, so no evening charges.
  drawer: { costs: [150], requiredLevel: [4], dailyCharge: 0, isComfort: true },
  terrasse: { costs: [120, 320], requiredLevel: [4, 7], dailyCharge: 3 },
  livraison: { costs: [220], requiredLevel: [5], dailyCharge: 4 },
  bar: { costs: [90, 240, 350], requiredLevel: [3, 5, 7], dailyCharge: 2 },
  // A waiter takes ready pizzas to the tables on their own (see data/staff.ts), faster at the second level.
  waiter: { costs: [400, 800], requiredLevel: [7, 9], dailyCharge: 1 },
  // Extra ovens: building one gives a single slow slot, then it improves like the first oven.
  oven2: { costs: [450, 250, 500, 900], requiredLevel: [7, 7, 8, 9], dailyCharge: 3 },
  // A second address: brings in money every evening, run by someone else.
  annexe: { costs: [1500, 3000, 6000], requiredLevel: [8, 11, 14], dailyCharge: 0 },
};

/** Extra ovens, in the order they are built. */
export const EXTRA_OVEN_KEYS = ["oven2"] as const;

// Evening income of the second address, by its level.
export const ANNEXE_INCOME: readonly number[] = [0, 30, 70, 140];

// Nonna's secret isn't bought: it is made, one jar at a time, at the market.
export const SECRET_CRAFT_COST = 10;
export const SECRET_JAR_PORTIONS = 4;
// Mamma's secret: shared after this many profitable days in a row, from this level; made at the market too.
export const MAMMA_LEVEL = 6;
export const MAMMA_PROFIT_DAYS = 5;
export const MAMMA_CRAFT_COST = 8;
export const MAMMA_JAR_PORTIONS = 3;

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

// A happy customer sometimes comes back later the same evening for a dessert pizza (when the menu has one).
export const DESSERT_RETURN_CHANCE = 0.3;
export const DESSERT_RETURN_SECONDS: readonly [number, number] = [25, 45];
// Served happy, someone back for dessert adds this on top of the price.
export const DESSERT_QUICK_BONUS = 1.5;

// Commis levels that unlock each helper behaviour.
export const COMMIS_SPREADS_DOUGH = 1;
// Selling an upgrade back (one level at a time, outside service) returns this share of what that level cost;
// a comfort upgrade returns all of it.
export const UPGRADE_RESALE_SHARE = 0.75;

// From level 2, the pans the selected order doesn't need fade a little, then more at level 3.
export const COMMIS_FADES_PANS = 2;

// Bar level that opens the barman's post: drinks go out on their own, one at a time (each barman's pace: data/staff.ts).
export const BARMAN_LEVEL = 3;

export const tipChanceForDecor = (decorLevel: number): number => {
  return 0.3 + 0.12 * decorLevel;
};
