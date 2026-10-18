// Achievements, in the order they are listed in the journal. The ids are stored in save files: never rename them.
// Names and descriptions live in src/i18n; the conditions live in game/achievements.ts.
export const ACHIEVEMENT_IDS = [
  "firstPizza",
  "served50",
  "served250",
  "served1000",
  "tips100",
  "firstRecipe",
  "threeRecipes",
  "firstRegular",
  "fiveRegulars",
  "asUsual10",
  "pairings5",
  "allPairings",
  "critic",
  "wasteFree",
  "profit100",
  "level5",
  "maxLevel",
  "allSuppliers",
  "fullyUpgraded",
  "deliveries20",
  "challenge300",
  "dailyChallenge",
  "sweetTooth",
  "drinks50",
  "happyTable",
  "birthday",
  "quests5",
  "secondOven",
  "secondAddress",
  "streak10",
  "threeStars",
  "batchGold",
  "celebrity",
  "secretCode",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

// Shown as "???" in the journal until unlocked.
export const HIDDEN_ACHIEVEMENTS: ReadonlySet<AchievementId> = new Set(["secretCode"]);
