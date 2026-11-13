// Achievements: lasting challenges across the whole game, each unlocked once, for good. Each one makes every sale a
// little dearer (the name of the house carries further), so chasing them pays.
import { PLANET_IDS, PLANETS, STAGES } from "./cosmos";
import { CITIES, type FactoryState } from "./engine";
import { isResearched, RESEARCH, RESEARCH_IDS } from "./research";

export const ACHIEVEMENT_IDS = [
  "firstPizza", "handMade", "bigBrigade", "tenThousandSold", "orderOne",
  "restaurants25", "restaurants100", "restaurants200", "allCities", "famous", "ordersTen", "millionSold",
  "factories10", "factories50", "windFarm", "fixer", "allResearch", "billionSold",
  "firstCosmic", "allPlanets", "embassy10", "cosmicMillion", "ordersThirty", "trillionSold", "starOven",
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** Every sale pays this much more for each achievement unlocked. */
export const ACHIEVEMENT_BONUS = 0.02;

const civLevels = (state: FactoryState) => PLANET_IDS.filter((id) => PLANETS[id].kind === "civ").map((id) => state.cosmos.planets[id].level);

export const ACHIEVEMENTS: Record<AchievementId, (state: FactoryState) => boolean> = {
  firstPizza: (s) => s.totalMade >= 1,
  handMade: (s) => s.handMade >= 500,
  bigBrigade: (s) => s.cooks >= 25,
  tenThousandSold: (s) => s.totalSold >= 1e4,
  orderOne: (s) => s.ordersDone >= 1,
  restaurants25: (s) => s.restaurants >= 25,
  restaurants100: (s) => s.restaurants >= 100,
  restaurants200: (s) => s.restaurants >= 200,
  allCities: (s) => s.cities >= CITIES.length,
  famous: (s) => s.marketing >= 15,
  ordersTen: (s) => s.ordersDone >= 10,
  millionSold: (s) => s.totalSold >= 1e6,
  factories10: (s) => s.buildings.pizzaFactory >= 10,
  factories50: (s) => s.buildings.pizzaFactory >= 50,
  windFarm: (s) => s.buildings.windTurbine >= 25,
  fixer: (s) => s.incidentsFixed >= 10,
  allResearch: (s) => RESEARCH_IDS.filter((id) => !RESEARCH[id].era).every((id) => isResearched(s.researched, id)),
  billionSold: (s) => s.totalSold >= 1e9,
  firstCosmic: (s) => s.cosmos.sold >= 1,
  allPlanets: (s) => PLANET_IDS.every((id) => s.cosmos.planets[id].open),
  embassy10: (s) => civLevels(s).some((level) => level >= 10),
  cosmicMillion: (s) => s.cosmos.sold >= 1e6,
  ordersThirty: (s) => s.ordersDone >= 30,
  trillionSold: (s) => s.totalSold >= 1e12,
  starOven: (s) => s.cosmos.stage >= STAGES.length,
};

/** What every sale is worth, against its price, with the achievements unlocked. */
export const salesBonus = (state: Pick<FactoryState, "achievements">): number => 1 + ACHIEVEMENT_BONUS * state.achievements.length;

/** The achievements newly reached. */
export const newAchievements = (state: FactoryState): AchievementId[] =>
  ACHIEVEMENT_IDS.filter((id) => !state.achievements.includes(id) && ACHIEVEMENTS[id](state));
