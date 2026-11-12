// Guidance for Forno Infinito: a short tour of the first actions, tips that come once when something new happens, and
// the goal of the moment (with its progress), so the player always knows what to do next and why.
import { STAGES, type PlanetId } from "./cosmos";
import { cookCapacity, frozenRate, isForSale, SPACE_PLANS_SALES, UPGRADE_IDS, UPGRADES, type FactoryState } from "./engine";
import { incidentSpeeds } from "./incidents";
import { powerBalance, type BuildingId } from "./plant";

/** The parts of the page guidance can point at. */
export type Section =
  | "counter" | "stats" | "sales" | "supplies" | "kitchen" | "chain" | "factories" | "research" | "universe" | "stellar" | "automations" | "upgrades";

export const STEP_IDS = ["makePizza", "selling", "buyCrate", "hireCook", "price", "firstUpgrade", "tourDone"] as const;
export type StepId = (typeof STEP_IDS)[number];

export const TIP_IDS = ["outOfKits", "kitchenFull", "automation", "franchiseForSale", "chainOpen", "chainGrowth", "power", "research", "incident"] as const;
export type TipId = (typeof TIP_IDS)[number];

interface Guide {
  target: Section | null;
  /** Shown once this holds (otherwise the tour waits, quietly). */
  ready?: (state: FactoryState) => boolean;
  /** Done when this holds; a guide without it is done when the player says "Got it". */
  done?: (state: FactoryState) => boolean;
}

const hasUpgradeForSale = (state: FactoryState) => UPGRADE_IDS.some((id) => isForSale(state, id) && !UPGRADES[id].comingSoon);

export const STEPS: Record<StepId, Guide> = {
  makePizza: { target: "counter", done: (s) => s.totalMade >= 3 },
  selling: { target: "stats" },
  buyCrate: { target: "supplies", done: (s) => s.cratesBought >= 1 },
  hireCook: { target: "kitchen", ready: (s) => s.money >= 15, done: (s) => s.cooks >= 1 },
  price: { target: "sales" },
  firstUpgrade: { target: "upgrades", ready: hasUpgradeForSale, done: (s) => s.upgrades.length >= 1 },
  tourDone: { target: null },
};

export const TIPS: Record<TipId, Guide & { when: (state: FactoryState) => boolean }> = {
  outOfKits: { target: "supplies", when: (s) => s.kits < 1 && s.totalMade > 10 && !s.upgrades.includes("supplier") },
  kitchenFull: { target: "upgrades", when: (s) => s.cooks >= cookCapacity(s) && s.cooks > 0 },
  automation: { target: "automations", when: (s) => s.upgrades.includes("supplier") },
  franchiseForSale: { target: "upgrades", when: (s) => isForSale(s, "franchise") },
  chainOpen: { target: "chain", when: (s) => s.era >= 2 },
  chainGrowth: { target: "chain", when: (s) => s.era >= 2 && s.upgrades.includes("manager") },
  power: {
    target: "factories",
    when: (s) => {
      const { supply, demand } = powerBalance(s, incidentSpeeds(s.incident));
      return s.era >= 3 && demand > 0 && supply < demand;
    },
  },
  research: { target: "research", when: (s) => s.era >= 3 && s.buildings.researchLab > 0 },
  incident: { target: "factories", when: (s) => s.incident !== null },
};

// Era 3's own tour: the plant set up one building at a time, from the power to the trucks, each lighting up in the
// diagram, then how to read it to balance it.
export const PLANT_STEP_IDS = ["power", "wheat", "flour", "dough", "sauce", "cheese", "factory", "trucks", "biogas", "balance"] as const;
export type PlantStepId = (typeof PLANT_STEP_IDS)[number];

const builtAll = (state: FactoryState, ids: readonly BuildingId[]) => ids.every((id) => state.buildings[id] >= 1);

/** Each step's buildings (lit up in the diagram), and when it is done (none: when the player says "Got it"). */
export const PLANT_STEPS: Record<PlantStepId, { nodes: readonly BuildingId[]; done?: (state: FactoryState) => boolean }> = {
  power: { nodes: ["windTurbine"], done: (s) => builtAll(s, ["windTurbine"]) },
  wheat: { nodes: ["wheatFarm"], done: (s) => builtAll(s, ["wheatFarm"]) },
  flour: { nodes: ["mill"], done: (s) => builtAll(s, ["mill"]) },
  dough: { nodes: ["waterPump", "saltWorks", "kneader"], done: (s) => builtAll(s, ["waterPump", "saltWorks", "kneader"]) },
  sauce: { nodes: ["greenhouse", "oliveGrove", "oilPress", "cannery"], done: (s) => builtAll(s, ["greenhouse", "oliveGrove", "oilPress", "cannery"]) },
  cheese: { nodes: ["dairyFarm", "creamery"], done: (s) => builtAll(s, ["dairyFarm", "creamery"]) },
  factory: { nodes: ["pizzaFactory"], done: (s) => builtAll(s, ["pizzaFactory"]) },
  trucks: { nodes: ["shippingDock"], done: (s) => builtAll(s, ["shippingDock"]) },
  biogas: { nodes: ["biogasPlant"], done: (s) => builtAll(s, ["biogasPlant"]) },
  balance: { nodes: [] },
};

// Era 4's own tour: the first terroirs, the oven, the first civilisation, then how routes and ships work, then exploring
// and the stellar oven.
export const SPACE_STEP_IDS = ["terroirs", "oven", "civ", "routes", "explore"] as const;
export type SpaceStepId = (typeof SPACE_STEP_IDS)[number];
/** What the space tour lights up: planets, or Earth. */
export type SpaceNode = PlanetId | "earth";

const opened = (state: FactoryState, ids: readonly PlanetId[]) => ids.every((id) => state.cosmos.planets[id].open);

export const SPACE_STEPS: Record<SpaceStepId, { nodes: readonly SpaceNode[]; done?: (state: FactoryState) => boolean }> = {
  terroirs: { nodes: ["helia", "rubra", "selena"], done: (s) => opened(s, ["helia", "rubra", "selena"]) },
  oven: { nodes: ["earth"], done: (s) => s.cosmos.ovens >= 1 },
  civ: { nodes: ["orbitans"], done: (s) => opened(s, ["orbitans"]) },
  routes: { nodes: [] },
  explore: { nodes: ["earth"] },
};

export interface Coach {
  /** Steps of the tour already done. */
  step: number;
  /** Steps of the plant's tour already done (era 3), and of the universe's (era 4). */
  plantStep: number;
  spaceStep: number;
  /** Tips already shown. */
  seen: TipId[];
  /** The player turned guidance off. */
  off: boolean;
}

export const newCoach = (): Coach => ({ step: 0, plantStep: 0, spaceStep: 0, seen: [], off: false });

export type Bubble =
  | { kind: "step"; id: StepId; index: number; count: number; target: Section | null; needsAck: boolean }
  | { kind: "plantStep"; id: PlantStepId; index: number; count: number; target: Section; nodes: readonly BuildingId[]; needsAck: boolean }
  | { kind: "spaceStep"; id: SpaceStepId; index: number; count: number; target: Section; nodes: readonly SpaceNode[]; needsAck: boolean }
  | { kind: "tip"; id: TipId; target: Section | null };

// Steps the player has already done on their own are skipped: a tour never asks for what is already there.
export const settle = (coach: Coach, state: FactoryState): Coach => {
  let step = coach.step;
  while (step < STEP_IDS.length) {
    const guide = STEPS[STEP_IDS[step]];
    if (!guide.done || !guide.done(state)) break;
    step++;
  }
  let plantStep = coach.plantStep;
  while (state.era >= 3 && plantStep < PLANT_STEP_IDS.length) {
    const done = PLANT_STEPS[PLANT_STEP_IDS[plantStep]].done;
    if (!done || !done(state)) break;
    plantStep++;
  }
  let spaceStep = coach.spaceStep;
  while (state.era >= 4 && spaceStep < SPACE_STEP_IDS.length) {
    const done = SPACE_STEPS[SPACE_STEP_IDS[spaceStep]].done;
    if (!done || !done(state)) break;
    spaceStep++;
  }
  return step === coach.step && plantStep === coach.plantStep && spaceStep === coach.spaceStep ? coach : { ...coach, step, plantStep, spaceStep };
};

/** What guidance shows now, if anything: the tour first, then the tips, each once. */
export const bubbleFor = (coach: Coach, state: FactoryState): Bubble | null => {
  if (coach.off) return null;
  if (coach.step < STEP_IDS.length) {
    const id = STEP_IDS[coach.step];
    const guide = STEPS[id];
    if (guide.ready && !guide.ready(state)) return null;
    return { kind: "step", id, index: coach.step, count: STEP_IDS.length, target: guide.target, needsAck: !guide.done };
  }
  if (state.era >= 3 && coach.plantStep < PLANT_STEP_IDS.length) {
    const id = PLANT_STEP_IDS[coach.plantStep];
    const { nodes, done } = PLANT_STEPS[id];
    return { kind: "plantStep", id, index: coach.plantStep, count: PLANT_STEP_IDS.length, target: "factories", nodes, needsAck: !done };
  }
  if (state.era >= 4 && coach.spaceStep < SPACE_STEP_IDS.length) {
    const id = SPACE_STEP_IDS[coach.spaceStep];
    const { nodes, done } = SPACE_STEPS[id];
    return { kind: "spaceStep", id, index: coach.spaceStep, count: SPACE_STEP_IDS.length, target: "universe", nodes, needsAck: !done };
  }
  const tip = TIP_IDS.find((id) => !coach.seen.includes(id) && TIPS[id].when(state));
  return tip ? { kind: "tip", id: tip, target: TIPS[tip].target } : null;
};

/** "Got it": the step or tip showing is done. */
export const acknowledge = (coach: Coach, bubble: Bubble): Coach => {
  if (bubble.kind === "step") return { ...coach, step: Math.max(coach.step, bubble.index + 1) };
  if (bubble.kind === "plantStep") return { ...coach, plantStep: Math.max(coach.plantStep, bubble.index + 1) };
  if (bubble.kind === "spaceStep") return { ...coach, spaceStep: Math.max(coach.spaceStep, bubble.index + 1) };
  return { ...coach, seen: [...coach.seen, bubble.id] };
};

export const readCoach = (value: unknown): Coach => {
  if (typeof value !== "object" || value === null) return newCoach();
  const saved = value as Partial<Coach>;
  return {
    step: typeof saved.step === "number" && Number.isInteger(saved.step) && saved.step >= 0 ? Math.min(saved.step, STEP_IDS.length) : 0,
    plantStep:
      typeof saved.plantStep === "number" && Number.isInteger(saved.plantStep) && saved.plantStep >= 0 ? Math.min(saved.plantStep, PLANT_STEP_IDS.length) : 0,
    spaceStep:
      typeof saved.spaceStep === "number" && Number.isInteger(saved.spaceStep) && saved.spaceStep >= 0 ? Math.min(saved.spaceStep, SPACE_STEP_IDS.length) : 0,
    seen: Array.isArray(saved.seen) ? saved.seen.filter((id): id is TipId => (TIP_IDS as readonly string[]).includes(id)) : [],
    off: saved.off === true,
  };
};

// --- The goal of the moment ------------------------------------------------------------------------------------------

export type GoalId =
  | "sellForFranchise" | "buyFranchise" | "city" | "country" | "million" | "buyPlans" | "factoryOutput" | "research" | "spaceSales" | "buyRocket"
  | "firstCosmic" | "stellar" | "free";

export interface Goal {
  id: GoalId;
  current: number;
  target: number;
}

const FRANCHISE_SALES = 3000;
/** Era 3's goals: frozen pizzas a second out of the factories, then researches done. */
const FACTORY_OUTPUT = 10_000;
const RESEARCH_GOAL = 5;
/** Era 4's first goal: cosmic pizzas delivered. */
const FIRST_COSMIC = 100;

/** What to aim for next, and how far along it is. */
export const goalFor = (state: FactoryState): Goal => {
  if (state.era === 1) {
    if (state.totalSold < FRANCHISE_SALES) return { id: "sellForFranchise", current: state.totalSold, target: FRANCHISE_SALES };
    return { id: "buyFranchise", current: state.money, target: UPGRADES.franchise.cost };
  }
  if (state.era === 2) {
    if (state.restaurants < 10) return { id: "city", current: state.restaurants, target: 10 };
    if (state.restaurants < 40) return { id: "country", current: state.restaurants, target: 40 };
    if (state.totalSold < 1e6) return { id: "million", current: state.totalSold, target: 1e6 };
    return { id: "buyPlans", current: state.money, target: UPGRADES.factoryPlans.cost };
  }
  if (state.era === 3) {
    const output = frozenRate(state);
    if (output < FACTORY_OUTPUT) return { id: "factoryOutput", current: output, target: FACTORY_OUTPUT };
    if (state.researched.length < RESEARCH_GOAL) return { id: "research", current: state.researched.length, target: RESEARCH_GOAL };
    if (state.totalSold < SPACE_PLANS_SALES) return { id: "spaceSales", current: state.totalSold, target: SPACE_PLANS_SALES };
    return { id: "buyRocket", current: state.money, target: UPGRADES.spacePlans.cost };
  }
  const { cosmos } = state;
  if (cosmos.sold < FIRST_COSMIC) return { id: "firstCosmic", current: cosmos.sold, target: FIRST_COSMIC };
  if (cosmos.endedAt === null) return { id: "stellar", current: cosmos.stage, target: STAGES.length };
  return { id: "free", current: 1, target: 1 };
};
