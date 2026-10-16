import { ACHIEVEMENT_IDS, type AchievementId } from "../data/achievements";
import { INGREDIENTS } from "../data/ingredients";
import { UPGRADES, UPGRADE_KEYS } from "../data/progression";
import { ALL_PAIRINGS_COUNT } from "./pairings";
import { levelForXp, MAX_LEVEL } from "./progression";
import { regularsOf } from "./regulars";
import { pushToast } from "./toasts";
import type { GameState } from "./types";

export interface Progress {
  current: number;
  target: number;
}

const customRecipeCount = (state: GameState): number => state.recipes.filter((recipe) => recipe.custom).length;
const upgradeLevels = (state: GameState): number => UPGRADE_KEYS.reduce((total, key) => total + state.upgrades[key], 0);
const MAX_UPGRADE_LEVELS = UPGRADE_KEYS.reduce((total, key) => total + UPGRADES[key].costs.length, 0);

// How far the player is toward each achievement. It unlocks once current reaches target.
const PROGRESS: Record<AchievementId, (state: GameState) => Progress> = {
  firstPizza: (state) => ({ current: state.lifetime.served, target: 1 }),
  served50: (state) => ({ current: state.lifetime.served, target: 50 }),
  served250: (state) => ({ current: state.lifetime.served, target: 250 }),
  served1000: (state) => ({ current: state.lifetime.served, target: 1000 }),
  tips100: (state) => ({ current: Math.floor(state.lifetime.tips), target: 100 }),
  firstRecipe: (state) => ({ current: customRecipeCount(state), target: 1 }),
  threeRecipes: (state) => ({ current: customRecipeCount(state), target: 3 }),
  firstRegular: (state) => ({ current: regularsOf(state).length, target: 1 }),
  fiveRegulars: (state) => ({ current: regularsOf(state).length, target: 5 }),
  asUsual10: (state) => ({ current: state.lifetime.asUsualServed, target: 10 }),
  pairings5: (state) => ({ current: state.discoveredPairings.length, target: 5 }),
  allPairings: (state) => ({ current: state.discoveredPairings.length, target: ALL_PAIRINGS_COUNT }),
  critic: (state) => ({ current: state.lifetime.criticsPleased, target: 1 }),
  wasteFree: (state) => ({ current: state.lifetime.wasteFreeDays, target: 1 }),
  profit100: (state) => ({ current: Math.max(0, Math.floor(state.lifetime.bestDay?.net ?? 0)), target: 100 }),
  level5: (state) => ({ current: levelForXp(state.xp), target: 5 }),
  maxLevel: (state) => ({ current: levelForXp(state.xp), target: MAX_LEVEL }),
  allSuppliers: (state) => ({ current: INGREDIENTS.filter((ingredient) => state.unlocked[ingredient.id]).length, target: INGREDIENTS.length }),
  fullyUpgraded: (state) => ({ current: upgradeLevels(state), target: MAX_UPGRADE_LEVELS }),
  deliveries20: (state) => ({ current: state.lifetime.deliveries, target: 20 }),
  challenge300: (state) => ({ current: state.bestChallengeScore, target: 300 }),
};

export function achievementProgress(state: GameState, id: AchievementId): Progress {
  const { current, target } = PROGRESS[id](state);
  return { current: Math.min(current, target), target };
}

export const isUnlocked = (state: GameState, id: AchievementId): boolean => state.achievements[id] !== undefined;

// Records every achievement newly reached, with a toast each unless silent
// (used when loading a save from before achievements existed). Returns them. Mutates state.
export function unlockAchievements(state: GameState, { silent = false } = {}): AchievementId[] {
  const reached = ACHIEVEMENT_IDS.filter((id) => {
    if (isUnlocked(state, id)) return false;
    const { current, target } = PROGRESS[id](state);
    return current >= target;
  });
  reached.forEach((id) => {
    state.achievements[id] = state.day;
    if (!silent) pushToast(state, { key: "achievement", params: { achievementId: id } }, "gold");
  });
  return reached;
}
