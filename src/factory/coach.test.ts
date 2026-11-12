import { describe, it, expect } from "vitest";
import { acknowledge, bubbleFor, goalFor, newCoach, PLANT_STEP_IDS, readCoach, settle, STEP_IDS, STEPS, TIP_IDS, TIPS, type Coach } from "./coach";
import type { BuildingId } from "./plant";
import { buyCrate, hireCook, isForSale, makePizza, newFactory, type FactoryState } from "./engine";
import { TAB_OF } from "./Factory";
import { TEXTS } from "./texts";
import type { ResearchId } from "./research";

// The tour as a player goes through it: each bubble, then what they do about it.
const follow = (coach: Coach, state: FactoryState) => {
  const settled = settle(coach, state);
  return { coach: settled, bubble: bubbleFor(settled, state) };
};

describe("the guided tour", () => {
  it("walks through the first actions in order, moving on as each is done", () => {
    let state = newFactory();
    let { coach, bubble } = follow(newCoach(), state);
    expect(bubble).toMatchObject({ kind: "step", id: "makePizza", target: "counter", needsAck: false });
    for (let i = 0; i < 3; i++) state = makePizza(state);
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ id: "selling", target: "stats", needsAck: true });
    ({ coach, bubble } = follow(acknowledge(coach, bubble!), state));
    expect(bubble).toMatchObject({ id: "buyCrate", target: "supplies" });
    state = buyCrate({ ...state, money: 100 })!;
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ id: "hireCook", target: "kitchen" });
    state = hireCook(state)!;
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ id: "price", target: "sales", needsAck: true });
    ({ coach, bubble } = follow(acknowledge(coach, bubble!), state));
    // The first upgrade waits until one is for sale.
    expect(bubble).toBeNull();
    state = { ...state, totalMade: 20, money: 100 };
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ id: "firstUpgrade", target: "upgrades" });
    state = { ...state, upgrades: ["doubleHands"] };
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ id: "tourDone", target: null, needsAck: true });
    ({ coach, bubble } = follow(acknowledge(coach, bubble!), state));
    expect(coach.step).toBe(STEP_IDS.length);
  });

  it("waits to point at hiring until there is money for it", () => {
    const coach: Coach = { step: STEP_IDS.indexOf("hireCook"), plantStep: 0, seen: [], off: false };
    expect(bubbleFor(coach, { ...newFactory(), money: 5 })).toBeNull();
    expect(bubbleFor(coach, { ...newFactory(), money: 15 })).toMatchObject({ id: "hireCook" });
  });

  it("skips what the player already did on their own", () => {
    const state = { ...newFactory(), totalMade: 50, cratesBought: 2 };
    expect(settle(newCoach(), state).step).toBe(STEP_IDS.indexOf("selling"));
    const later = settle({ step: STEP_IDS.indexOf("buyCrate"), plantStep: 0, seen: [], off: false }, { ...state, cooks: 1 });
    expect(STEP_IDS[later.step]).toBe("price");
  });

  it("says nothing once turned off", () => {
    expect(bubbleFor({ ...newCoach(), off: true }, newFactory())).toBeNull();
  });
});

describe("tips", () => {
  const afterTour: Coach = { step: STEP_IDS.length, plantStep: 0, seen: [], off: false };

  it("come once each, when what they are about happens", () => {
    const state = { ...newFactory(), totalSold: 3000 };
    expect(isForSale(state, "franchise")).toBe(true);
    const bubble = bubbleFor(afterTour, state);
    expect(bubble).toEqual({ kind: "tip", id: "franchiseForSale", target: "upgrades" });
    expect(bubbleFor(acknowledge(afterTour, bubble!), state)).toBeNull();
    expect(bubbleFor(afterTour, { ...newFactory(), era: 2 })).toMatchObject({ id: "chainOpen", target: "chain" });
    const seenChain: Coach = { ...afterTour, seen: ["chainOpen", "chainGrowth"] };
    expect(bubbleFor(seenChain, { ...newFactory(), era: 3 })).toMatchObject({ kind: "plantStep", id: "power", nodes: ["windTurbine"] });
  });

  it("wait for the tour to end", () => {
    expect(bubbleFor(newCoach(), { ...newFactory(), totalSold: 3000 })).toMatchObject({ kind: "step" });
  });
});

describe("the plant's tour", () => {
  const afterTours: Coach = { step: STEP_IDS.length, plantStep: 0, seen: [], off: false };
  const era3 = (buildings: Partial<FactoryState["buildings"]> = {}): FactoryState => ({ ...newFactory(), era: 3, buildings: { ...newFactory().buildings, ...buildings } });

  it("sets the plant up one building at a time, lighting each one up, from the power to the trucks", () => {
    let state = era3();
    let { coach, bubble } = follow(afterTours, state);
    const seen: string[] = [];
    const build = (ids: readonly BuildingId[]) => (state = era3({ ...state.buildings, ...Object.fromEntries(ids.map((id) => [id, 1])) }));
    while (bubble?.kind === "plantStep" && bubble.id !== "balance") {
      seen.push(bubble.id);
      expect(bubble.target).toBe("factories");
      expect(bubble.nodes.length).toBeGreaterThan(0);
      build(bubble.nodes);
      ({ coach, bubble } = follow(coach, state));
    }
    expect(seen).toEqual(["power", "wheat", "flour", "dough", "sauce", "cheese", "factory", "trucks", "biogas"]);
    expect(bubble).toMatchObject({ kind: "plantStep", id: "balance", needsAck: true });
    ({ coach, bubble } = follow(acknowledge(coach, bubble!), state));
    expect(coach.plantStep).toBe(PLANT_STEP_IDS.length);
  });

  it("skips what the plant already has, and waits for era 3", () => {
    expect(bubbleFor(afterTours, newFactory())?.kind).not.toBe("plantStep");
    const built = era3({ windTurbine: 2, wheatFarm: 1, mill: 1 });
    expect(follow(afterTours, built).bubble).toMatchObject({ id: "dough" });
  });

  it("has its words in every language", () => {
    Object.values(TEXTS).forEach((texts) => expect(Object.keys(texts.plantSteps).sort()).toEqual([...PLANT_STEP_IDS].sort()));
  });
});

describe("the goal", () => {
  it("goes from the franchise to the city, the country, a million pizzas, the factory plans, then the factories' goals", () => {
    expect(goalFor(newFactory())).toEqual({ id: "sellForFranchise", current: 0, target: 3000 });
    expect(goalFor({ ...newFactory(), totalSold: 3500, money: 2000 })).toEqual({ id: "buyFranchise", current: 2000, target: 8000 });
    const chain = { ...newFactory(), era: 2 as const };
    expect(goalFor({ ...chain, restaurants: 4 }).id).toBe("city");
    expect(goalFor({ ...chain, restaurants: 12 }).id).toBe("country");
    expect(goalFor({ ...chain, restaurants: 45, totalSold: 500 }).id).toBe("million");
    expect(goalFor({ ...chain, restaurants: 45, totalSold: 2e6, money: 4e6 })).toEqual({ id: "buyPlans", current: 4e6, target: 1e7 });
    const factories = { ...chain, era: 3 as const, totalSold: 2e6 };
    expect(goalFor(factories)).toEqual({ id: "factoryOutput", current: 0, target: 10_000 });
    const running = { ...factories, factoryRates: { ...factories.factoryRates, pizzaFactory: 4 } };
    expect(goalFor(running)).toEqual({ id: "research", current: 0, target: 5 });
    const researched = { ...running, researched: ["calculator", "conveyorBelts", "modules", "fertilizer", "efficientTurbines"] as ResearchId[] };
    expect(goalFor(researched).id).toBe("sold1b");
    expect(goalFor({ ...researched, totalSold: 2e9 }).id).toBe("space");
  });
});

describe("guidance, everywhere", () => {
  it("points only at parts the page has, each in a phone tab", () => {
    [...STEP_IDS.map((id) => STEPS[id].target), ...TIP_IDS.map((id) => TIPS[id].target)].forEach((target) => {
      if (target) expect(TAB_OF[target]).toBeDefined();
    });
  });

  it("has its words in every language", () => {
    Object.values(TEXTS).forEach((texts) => {
      expect(Object.keys(texts.steps).sort()).toEqual([...STEP_IDS].sort());
      expect(Object.keys(texts.tips).sort()).toEqual([...TIP_IDS].sort());
    });
  });

  it("reads a saved tour with care", () => {
    expect(readCoach({ step: 3, seen: ["automation", "nope"], off: false })).toEqual({ step: 3, plantStep: 0, seen: ["automation"], off: false });
    expect(readCoach({ step: 3, plantStep: 4, seen: [] }).plantStep).toBe(4);
    expect(readCoach({ step: -2 })).toEqual(newCoach());
    expect(readCoach({ step: 999 }).step).toBe(STEP_IDS.length);
    expect(readCoach("garbage")).toEqual(newCoach());
  });
});
