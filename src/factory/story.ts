// The story: the goal of the moment, told as chapters, a handful in each era. Each chapter has an aim the page shows
// with its progress (sell this much, open that city, light the oven…); reaching it pays a reward and opens the next
// chapter, whose words the page tells (see texts.ts). Chapters follow the eras: the aims of an era can all be reached in
// it.
import { PLANET_IDS, PLANETS, STAGES } from "./cosmos";
import { frozenRate, SPACE_PLANS_SALES, UPGRADES, type Era, type FactoryState, type UpgradeId } from "./engine";
import { isResearched, RESEARCH_IDS, RESEARCH } from "./research";

export const CHAPTER_IDS = [
  // Era 1: the counter
  "firstService", "brigade", "neighbourhood", "woodFire", "fridayRush", "franchise",
  // Era 2: the chain
  "rome", "cityWide", "critic", "northbound", "countryWide", "million", "rival", "worldTour", "factoryPlans",
  // Era 3: the factories
  "firstFrozen", "tenThousand", "labWork", "strike", "fiftyThousand", "maintenanceCrew", "spaceSales", "rocket",
  // Era 4: the universe
  "firstCosmic", "secondRing", "newFriends", "ovenBase", "hyperdrive", "farthest", "embassies", "ovenWalls", "lighting",
] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface Progress {
  current: number;
  target: number;
}

interface ChapterSpec {
  era: Era;
  /** How far along its aim is: done once current reaches target. */
  progress: (state: FactoryState) => Progress;
}

const count = (current: number, target: number): Progress => ({ current: Math.min(current, target), target });
const owns = (state: FactoryState, id: (typeof state.upgrades)[number]): Progress =>
  state.upgrades.includes(id) ? { current: 1, target: 1 } : { current: Math.min(state.money / UPGRADES[id].cost, 0.99), target: 1 };
const researched = (state: FactoryState, id: (typeof RESEARCH_IDS)[number]): Progress => count(isResearched(state.researched, id) ? 1 : 0, 1);
const civsOpen = (state: FactoryState) => PLANET_IDS.filter((id) => PLANETS[id].kind === "civ" && state.cosmos.planets[id].open).length;

export const CHAPTERS: Record<ChapterId, ChapterSpec> = {
  firstService: { era: 1, progress: (s) => count(s.totalSold, 30) },
  brigade: { era: 1, progress: (s) => count(s.cooks, 3) },
  neighbourhood: { era: 1, progress: (s) => count(s.totalSold, 400) },
  woodFire: { era: 1, progress: (s) => owns(s, "woodOven") },
  fridayRush: { era: 1, progress: (s) => count(s.totalSold, 4000) },
  franchise: { era: 1, progress: (s) => owns(s, "franchise") },
  rome: { era: 2, progress: (s) => count(s.cities, 2) },
  cityWide: { era: 2, progress: (s) => count(s.restaurants, 10) },
  critic: { era: 2, progress: (s) => count(s.ordersDone, 1) },
  northbound: { era: 2, progress: (s) => count(s.cities, 4) },
  countryWide: { era: 2, progress: (s) => count(s.restaurants, 40) },
  million: { era: 2, progress: (s) => count(s.totalSold, 1e6) },
  rival: { era: 2, progress: (s) => count(s.marketing, 12) },
  worldTour: { era: 2, progress: (s) => count(s.cities, 7) },
  factoryPlans: { era: 2, progress: (s) => owns(s, "factoryPlans") },
  firstFrozen: { era: 3, progress: (s) => count(s.milestones.includes("firstFactoryPizza") ? 1 : 0, 1) },
  tenThousand: { era: 3, progress: (s) => count(frozenRate(s), 10_000) },
  labWork: { era: 3, progress: (s) => count(s.researched.filter((id) => !RESEARCH[id].era).length, 5) },
  strike: { era: 3, progress: (s) => count(s.incidentsFixed, 1) },
  fiftyThousand: { era: 3, progress: (s) => count(frozenRate(s), 50_000) },
  maintenanceCrew: { era: 3, progress: (s) => researched(s, "maintenanceCrew") },
  spaceSales: { era: 3, progress: (s) => count(s.totalSold, SPACE_PLANS_SALES) },
  rocket: { era: 3, progress: (s) => owns(s, "spacePlans") },
  firstCosmic: { era: 4, progress: (s) => count(s.cosmos.sold, 100) },
  secondRing: { era: 4, progress: (s) => count(s.cosmos.known.length, PLANET_IDS.filter((id) => PLANETS[id].ring < 3).length) },
  newFriends: { era: 4, progress: (s) => count(civsOpen(s), 4) },
  ovenBase: { era: 4, progress: (s) => count(s.cosmos.stage, 2) },
  hyperdrive: { era: 4, progress: (s) => researched(s, "hyperdrive") },
  farthest: { era: 4, progress: (s) => count(PLANET_IDS.filter((id) => s.cosmos.planets[id].open).length, PLANET_IDS.length) },
  embassies: { era: 4, progress: (s) => count(Math.max(...PLANET_IDS.filter((id) => PLANETS[id].kind === "civ").map((id) => s.cosmos.planets[id].level)), 5) },
  ovenWalls: { era: 4, progress: (s) => count(s.cosmos.stage, 5) },
  lighting: { era: 4, progress: (s) => count(s.cosmos.stage, STAGES.length) },
};

/** The chapters whose aim is to buy an upgrade: the page shows its price and a button, and the automations keep its
 * price aside. */
export const CHAPTER_UPGRADES: Partial<Record<ChapterId, UpgradeId>> = {
  woodFire: "woodOven",
  franchise: "franchise",
  factoryPlans: "factoryPlans",
  rocket: "spacePlans",
};

/** The chapter going on (none once the story is told: the game goes on, free). */
export const chapterOf = (state: Pick<FactoryState, "chapter">): ChapterId | null => CHAPTER_IDS[state.chapter] ?? null;

export const isChapterDone = (state: FactoryState, id: ChapterId): boolean => {
  const { current, target } = CHAPTERS[id].progress(state);
  return current >= target;
};

/** Where an old save starts the story: the first chapter of its era (the earlier ones are not paid again). */
export const firstChapterOf = (era: Era): number => CHAPTER_IDS.findIndex((id) => CHAPTERS[id].era === era);

