// Era 3's research tree: laboratories turn frozen pizzas into research points, spent here. It brings the factory's
// automation step by step (a ratio calculator, then modules built in one go, then a foreman who builds on their own) and
// makes the buildings better (belts, fertiliser, robot arms, turbines, docks, then modernised workshops, then workshops
// of the future). Maintenance makes breakdowns rarer and shorter (see incidents.ts). Era 4 brings its own (see cosmos.ts):
// bigger cargo holds, orbital chefs, terraforming, and the hyperdrive that reaches the farthest planets.

export const RESEARCH_IDS = [
  "calculator", "conveyorBelts", "modules", "fertilizer", "efficientTurbines", "automatedDocks", "maintenance", "robotArms", "foreman", "modernised", "futuristic",
  "cargoHolds", "orbitalChefs", "terraforming", "hyperdrive",
] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];

interface ResearchSpec {
  /** Research points it takes. */
  cost: number;
  /** What has to be researched first. */
  requires: readonly ResearchId[];
  /** The era it shows from (era 3 when not said). */
  era?: 4;
}

export const RESEARCH: Record<ResearchId, ResearchSpec> = {
  calculator: { cost: 300, requires: [] },
  conveyorBelts: { cost: 600, requires: [] },
  modules: { cost: 900, requires: ["calculator"] },
  fertilizer: { cost: 1_200, requires: ["conveyorBelts"] },
  efficientTurbines: { cost: 1_200, requires: ["conveyorBelts"] },
  automatedDocks: { cost: 1_500, requires: ["conveyorBelts"] },
  maintenance: { cost: 1_500, requires: ["conveyorBelts"] },
  robotArms: { cost: 1_800, requires: ["fertilizer"] },
  foreman: { cost: 3_000, requires: ["modules"] },
  modernised: { cost: 5_000, requires: ["robotArms", "efficientTurbines"] },
  futuristic: { cost: 15_000, requires: ["modernised", "foreman"] },
  cargoHolds: { cost: 5_000, requires: [], era: 4 },
  orbitalChefs: { cost: 8_000, requires: [], era: 4 },
  terraforming: { cost: 12_000, requires: ["cargoHolds"], era: 4 },
  hyperdrive: { cost: 15_000, requires: ["cargoHolds"], era: 4 },
};

export const isResearched = (researched: readonly ResearchId[], id: ResearchId): boolean => researched.includes(id);

/** Whether a research can be started now: not done yet, and everything it needs is. */
export const isResearchOpen = (researched: readonly ResearchId[], id: ResearchId): boolean =>
  !isResearched(researched, id) && RESEARCH[id].requires.every((needed) => isResearched(researched, needed));

/** Whether a research shows in this era (era 4's wait for the universe). */
export const isResearchShown = (era: number, id: ResearchId): boolean => era >= (RESEARCH[id].era ?? 3);
