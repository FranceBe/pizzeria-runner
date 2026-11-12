// Dev only: a factory set up at any point of the game (an era, money, buildings, upgrades), to test the later eras
// without playing through. Used by the dev tab, which only exists in development builds.
import { cookCapacity, newFactory, UPGRADE_IDS, UPGRADES, type Era, type FactoryState, type UpgradeId } from "../engine";
import { BUILDING_IDS, BUILDINGS, noBuildings, planFor, type BuildingId } from "../plant";
import { RESEARCH_IDS, type ResearchId } from "../research";

export interface DevSetup {
  era: Era;
  money: number;
  totalSold: number;
  restaurants: number;
  cooks: number;
  marketing: number;
  kits: number;
  research: number;
  buildings: Record<BuildingId, number>;
  upgrades: UpgradeId[];
  researched: ResearchId[];
}

export const DEV_PRESET_IDS = ["era2Start", "era3Start", "era3Running", "era3Late"] as const;
export type DevPresetId = (typeof DEV_PRESET_IDS)[number];

/** Every upgrade of these eras that can be bought (not those still to come). */
const upgradesUpTo = (era: Era): UpgradeId[] => UPGRADE_IDS.filter((id) => UPGRADES[id].era <= era && !UPGRADES[id].comingSoon);
const eraOneUpgrades = (): UpgradeId[] => upgradesUpTo(1);

/** A balanced plant for this many pizza factories (with a laboratory for every four), from the planner. */
const plantFor = (factories: number, researched: ResearchId[] = []): Record<BuildingId, number> => {
  const empty = { buildings: noBuildings(), stocks: {} as never, factoryRates: noBuildings(), stockTrends: {} as never, researched };
  const plan = planFor(empty, factories * (BUILDINGS.pizzaFactory.makes.frozen ?? 0));
  const buildings = Object.fromEntries(BUILDING_IDS.map((id) => [id, Math.ceil(plan[id] - 1e-9)])) as Record<BuildingId, number>;
  return { ...buildings, researchLab: Math.max(1, Math.floor(factories / 4)) };
};

export const DEV_PRESETS: Record<DevPresetId, DevSetup> = {
  era2Start: {
    era: 2, money: 20_000, totalSold: 5_000, restaurants: 1, cooks: 10, marketing: 4, kits: 2_000, research: 0,
    buildings: noBuildings(), upgrades: eraOneUpgrades(), researched: [],
  },
  era3Start: {
    era: 3, money: 5_000_000, totalSold: 2_000_000, restaurants: 80, cooks: 1_500, marketing: 10, kits: 100_000, research: 0,
    buildings: noBuildings(), upgrades: [...upgradesUpTo(2)], researched: [],
  },
  era3Running: {
    era: 3, money: 50_000_000, totalSold: 10_000_000, restaurants: 100, cooks: 2_000, marketing: 12, kits: 100_000, research: 500,
    buildings: plantFor(2), upgrades: [...upgradesUpTo(2)], researched: [],
  },
  era3Late: {
    era: 3, money: 1_000_000_000, totalSold: 500_000_000, restaurants: 130, cooks: 2_600, marketing: 14, kits: 100_000, research: 5_000,
    buildings: plantFor(20, ["calculator", "conveyorBelts", "modules", "fertilizer", "efficientTurbines", "automatedDocks"]),
    upgrades: upgradesUpTo(3),
    researched: ["calculator", "conveyorBelts", "modules", "fertilizer", "efficientTurbines", "automatedDocks"],
  },
};

const count = (value: number, min = 0): number => (Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min);

/** A whole, consistent game from a setup: what an era needs to have been opened comes with it, the automations
 * owned are switched on, the cooks fit in the kitchens. */
export const buildDevFactory = (setup: DevSetup): FactoryState => {
  const upgrades = new Set(setup.upgrades.filter((id) => UPGRADES[id].era <= setup.era && !UPGRADES[id].comingSoon));
  // The upgrades that open an era go with it: owned from it on, not before.
  if (setup.era >= 2) upgrades.add("franchise");
  else upgrades.delete("franchise");
  if (setup.era >= 3) upgrades.add("factoryPlans");
  else upgrades.delete("factoryPlans");
  const base: FactoryState = {
    ...newFactory(),
    era: setup.era,
    money: Math.max(0, Number.isFinite(setup.money) ? setup.money : 0),
    totalSold: count(setup.totalSold),
    totalMade: count(setup.totalSold),
    totalEarned: count(setup.totalSold) * 5,
    restaurants: setup.era >= 2 ? count(setup.restaurants, 1) : 1,
    marketing: count(setup.marketing),
    kits: count(setup.kits),
    research: setup.era >= 3 ? count(setup.research) : 0,
    researched: setup.era >= 3 ? RESEARCH_IDS.filter((id) => setup.researched.includes(id)) : [],
    upgrades: [...upgrades],
    buildings: setup.era >= 3
      ? (Object.fromEntries(BUILDING_IDS.map((id) => [id, count(setup.buildings[id])])) as Record<BuildingId, number>)
      : noBuildings(),
  };
  const state = { ...base, cooks: Math.min(count(setup.cooks), cookCapacity(base)) };
  return {
    ...state,
    autoBuy: upgrades.has("supplier"),
    autoHire: upgrades.has("manager"),
    autoPrice: upgrades.has("pricingAnalyst"),
    autoBuild: setup.era >= 3 && setup.researched.includes("foreman"),
  };
};

/** The setup of a game as it is, to start the dev tab's form from. */
export const devSetupOf = (state: FactoryState): DevSetup => ({
  era: state.era,
  money: Math.floor(state.money),
  totalSold: Math.floor(state.totalSold),
  restaurants: state.restaurants,
  cooks: state.cooks,
  marketing: state.marketing,
  kits: Math.floor(state.kits),
  research: Math.floor(state.research),
  buildings: { ...state.buildings },
  upgrades: [...state.upgrades],
  researched: [...state.researched],
});
