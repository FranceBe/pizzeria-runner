// Guidance for Forno Infinito: a short tour of the first actions, tips that come once when something new happens, and
// the goal of the moment (with its progress), so the player always knows what to do next and why.
import { cookCapacity, isForSale, UPGRADE_IDS, UPGRADES, type FactoryState } from "./engine";

/** The parts of the page guidance can point at. */
export type Section = "counter" | "stats" | "sales" | "supplies" | "kitchen" | "chain" | "automations" | "upgrades";

export const STEP_IDS = ["makePizza", "selling", "buyCrate", "hireCook", "price", "firstUpgrade", "tourDone"] as const;
export type StepId = (typeof STEP_IDS)[number];

export const TIP_IDS = ["outOfKits", "kitchenFull", "automation", "franchiseForSale", "chainOpen", "chainGrowth"] as const;
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
};

export interface Coach {
  /** Steps of the tour already done. */
  step: number;
  /** Tips already shown. */
  seen: TipId[];
  /** The player turned guidance off. */
  off: boolean;
}

export const newCoach = (): Coach => ({ step: 0, seen: [], off: false });

export type Bubble = { kind: "step"; id: StepId; index: number; count: number; target: Section | null; needsAck: boolean } | { kind: "tip"; id: TipId; target: Section | null };

// Steps the player has already done on their own are skipped: a tour never asks for what is already there.
export const settle = (coach: Coach, state: FactoryState): Coach => {
  let step = coach.step;
  while (step < STEP_IDS.length) {
    const guide = STEPS[STEP_IDS[step]];
    if (!guide.done || !guide.done(state)) break;
    step++;
  }
  return step === coach.step ? coach : { ...coach, step };
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
  const tip = TIP_IDS.find((id) => !coach.seen.includes(id) && TIPS[id].when(state));
  return tip ? { kind: "tip", id: tip, target: TIPS[tip].target } : null;
};

/** "Got it": the step or tip showing is done. */
export const acknowledge = (coach: Coach, bubble: Bubble): Coach =>
  bubble.kind === "step" ? { ...coach, step: Math.max(coach.step, bubble.index + 1) } : { ...coach, seen: [...coach.seen, bubble.id] };

export const readCoach = (value: unknown): Coach => {
  if (typeof value !== "object" || value === null) return newCoach();
  const saved = value as Partial<Coach>;
  return {
    step: typeof saved.step === "number" && Number.isInteger(saved.step) && saved.step >= 0 ? Math.min(saved.step, STEP_IDS.length) : 0,
    seen: Array.isArray(saved.seen) ? saved.seen.filter((id): id is TipId => (TIP_IDS as readonly string[]).includes(id)) : [],
    off: saved.off === true,
  };
};

// --- The goal of the moment ------------------------------------------------------------------------------------------

export type GoalId = "sellForFranchise" | "buyFranchise" | "city" | "country" | "continent" | "million" | "factories";

export interface Goal {
  id: GoalId;
  current: number;
  target: number;
}

const FRANCHISE_SALES = 3000;

/** What to aim for next, and how far along it is. */
export const goalFor = (state: FactoryState): Goal => {
  if (state.era === 1) {
    if (state.totalSold < FRANCHISE_SALES) return { id: "sellForFranchise", current: state.totalSold, target: FRANCHISE_SALES };
    return { id: "buyFranchise", current: state.money, target: UPGRADES.franchise.cost };
  }
  if (state.restaurants < 10) return { id: "city", current: state.restaurants, target: 10 };
  if (state.restaurants < 40) return { id: "country", current: state.restaurants, target: 40 };
  if (state.totalSold < 1e6) return { id: "million", current: state.totalSold, target: 1e6 };
  if (state.restaurants < 150) return { id: "continent", current: state.restaurants, target: 150 };
  return { id: "factories", current: 1, target: 1 };
};
