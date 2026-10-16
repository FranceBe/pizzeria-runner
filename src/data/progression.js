// Reputation points needed to reach each level: index 0 is level 1, index 1 is level 2, etc.
export const REPUTATION_THRESHOLDS = [0, 70, 200, 400, 680, 1050, 1520, 2100, 2800, 3700, 4800];

// Indexed by oven upgrade level.
export const OVEN_SLOTS = [1, 2, 2, 3];
export const BAKE_SECONDS = [6, 4.5, 3, 2.2];

export const BASE_DAILY_CHARGES = 6;

// The keys are stored in save files: never rename them. Names and descriptions live in src/i18n.
// costs[n] / requiredLevel[n] = price and reputation level to go from level n to n + 1.
// dailyCharge = extra evening charges per upgrade level.
export const UPGRADES = {
  oven: { costs: [70, 180, 400], requiredLevel: [2, 4, 6], dailyCharge: 2 },
  salle: { costs: [50, 130, 280, 550], requiredLevel: [1, 3, 5, 7], dailyCharge: 3 },
  deco: { costs: [40, 120, 300], requiredLevel: [2, 4, 6], dailyCharge: 2 },
  commis: { costs: [150, 400], requiredLevel: [3, 6], dailyCharge: 5 },
};

// Commis levels that unlock each helper behaviour.
export const COMMIS_SPREADS_DOUGH = 1;
export const COMMIS_ASSEMBLES_ORDER = 2;

export function tipChanceForDecor(decorLevel) {
  return 0.3 + 0.12 * decorLevel;
}
