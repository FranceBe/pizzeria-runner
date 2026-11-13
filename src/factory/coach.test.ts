import { describe, it, expect } from "vitest";
import { acknowledge, bubbleFor, goalFor, newCoach, PLANT_STEP_IDS, readCoach, settle, SPACE_STEP_IDS, STEP_IDS, STEPS, TIP_IDS, TIPS, type Coach } from "./coach";
import type { BuildingId } from "./plant";
import { buildOven, openPlanet } from "./cosmos";
import { buyCrate, hireCook, isForSale, makePizza, newFactory, type FactoryState } from "./engine";
import { TAB_OF } from "./Factory";
import { TEXTS } from "./texts";
import { CHAPTER_IDS } from "./story";

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
    const coach: Coach = { step: STEP_IDS.indexOf("hireCook"), plantStep: 0, spaceStep: 0, seen: [], chapterSeen: 0, off: false };
    expect(bubbleFor(coach, { ...newFactory(), money: 5 })).toBeNull();
    expect(bubbleFor(coach, { ...newFactory(), money: 15 })).toMatchObject({ id: "hireCook" });
  });

  it("skips what the player already did on their own", () => {
    const state = { ...newFactory(), totalMade: 50, cratesBought: 2 };
    expect(settle(newCoach(), state).step).toBe(STEP_IDS.indexOf("selling"));
    const later = settle({ step: STEP_IDS.indexOf("buyCrate"), plantStep: 0, spaceStep: 0, seen: [], chapterSeen: 0, off: false }, { ...state, cooks: 1 });
    expect(STEP_IDS[later.step]).toBe("price");
  });

  it("says nothing once turned off", () => {
    expect(bubbleFor({ ...newCoach(), off: true }, newFactory())).toBeNull();
  });
});

describe("tips", () => {
  // The tour over, and the story's chapters told (their bubbles come before the tips).
  const afterTour: Coach = { step: STEP_IDS.length, plantStep: 0, spaceStep: 0, seen: [], chapterSeen: CHAPTER_IDS.length, off: false };

  it("come once each, when what they are about happens", () => {
    const state = { ...newFactory(), totalSold: 5000 };
    expect(isForSale(state, "franchise")).toBe(true);
    const bubble = bubbleFor(afterTour, state);
    expect(bubble).toEqual({ kind: "tip", id: "franchiseForSale", target: "upgrades" });
    expect(bubbleFor(acknowledge(afterTour, bubble!), state)).toBeNull();
    expect(bubbleFor(afterTour, { ...newFactory(), era: 2 })).toMatchObject({ id: "chainOpen", target: "chain" });
    const seenChain: Coach = { ...afterTour, seen: ["chainOpen", "chainGrowth"] };
    expect(bubbleFor(seenChain, { ...newFactory(), era: 3 })).toMatchObject({ kind: "plantStep", id: "power", nodes: ["windTurbine"] });
  });

  it("wait for the tour to end", () => {
    expect(bubbleFor(newCoach(), { ...newFactory(), totalSold: 5000 })).toMatchObject({ kind: "step" });
  });
});

describe("the plant's tour", () => {
  const afterTours: Coach = { step: STEP_IDS.length, plantStep: 0, spaceStep: 0, seen: [], chapterSeen: 0, off: false };
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

describe("the goal: the story, chapter by chapter", () => {
  it("shows the chapter going on with its progress, era after era, then free play", () => {
    expect(goalFor(newFactory())).toEqual({ id: "firstService", current: 0, target: 30 });
    expect(goalFor({ ...newFactory(), chapter: CHAPTER_IDS.indexOf("franchise"), money: 2000 })).toEqual({ id: "franchise", current: 0.1, target: 1 });
    const chain = { ...newFactory(), era: 2 as const, chapter: CHAPTER_IDS.indexOf("rome") };
    expect(goalFor(chain)).toEqual({ id: "rome", current: 1, target: 2 });
    expect(goalFor({ ...chain, chapter: CHAPTER_IDS.indexOf("worldTour"), cities: 5 })).toEqual({ id: "worldTour", current: 5, target: 7 });
    const universe = { ...newFactory(), era: 4 as const, chapter: CHAPTER_IDS.indexOf("firstCosmic") };
    expect(goalFor(universe)).toEqual({ id: "firstCosmic", current: 0, target: 100 });
    expect(goalFor({ ...universe, chapter: CHAPTER_IDS.length })).toEqual({ id: "free", current: 1, target: 1 });
  });

  it("opens each new chapter with a bubble, once the tours are over", () => {
    const toured: Coach = { ...newCoach(), step: STEP_IDS.length, seen: [...TIP_IDS] };
    const state = { ...newFactory(), chapter: 2 };
    const bubble = bubbleFor(toured, state);
    expect(bubble).toMatchObject({ kind: "chapter", id: CHAPTER_IDS[2], target: null });
    expect(bubbleFor(acknowledge(toured, bubble!), state)).toBeNull();
  });

  it("has every chapter's words in every language", () => {
    Object.values(TEXTS).forEach((texts) => {
      expect(Object.keys(texts.chapters).sort()).toEqual([...CHAPTER_IDS].sort());
      expect(Object.keys(texts.goals).sort()).toEqual([...CHAPTER_IDS, "free"].sort());
    });
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
    expect(readCoach({ step: 3, seen: ["automation", "nope"], off: false })).toEqual({ step: 3, plantStep: 0, spaceStep: 0, seen: ["automation"], chapterSeen: 0, off: false });
    expect(readCoach({ step: 3, spaceStep: 2 }).spaceStep).toBe(2);
    expect(readCoach({ step: 3, spaceStep: 99 }).spaceStep).toBe(SPACE_STEP_IDS.length);
    expect(readCoach({ step: 3, plantStep: 4, spaceStep: 0, seen: [] }).plantStep).toBe(4);
    expect(readCoach({ step: -2 })).toEqual(newCoach());
    expect(readCoach({ step: 999 }).step).toBe(STEP_IDS.length);
    expect(readCoach("garbage")).toEqual(newCoach());
  });
});

describe("the universe's tour", () => {
  const afterTours: Coach = { step: STEP_IDS.length, plantStep: PLANT_STEP_IDS.length, spaceStep: 0, seen: [...TIP_IDS], chapterSeen: 99, off: false };

  it("waits for era 4, then opens the first terroirs, the oven and the first civilisation, then explains the rest", () => {
    expect(bubbleFor(afterTours, { ...newFactory(), era: 3 })).toBeNull();
    let state: FactoryState = { ...newFactory(), era: 4, money: 1e12 };
    let { coach, bubble } = follow(afterTours, state);
    expect(bubble).toMatchObject({ kind: "spaceStep", id: "terroirs", target: "universe", nodes: ["helia", "rubra", "selena"] });
    for (const id of ["helia", "rubra", "selena"] as const) state = openPlanet(state, id)!;
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ kind: "spaceStep", id: "oven", nodes: ["earth"] });
    state = buildOven(openPlanet(state, "orbitans")!)!;
    ({ coach, bubble } = follow(coach, state));
    expect(bubble).toMatchObject({ kind: "spaceStep", id: "routes", needsAck: true });
    ({ coach, bubble } = follow(acknowledge(coach, bubble!), state));
    expect(bubble).toMatchObject({ kind: "spaceStep", id: "explore" });
    ({ coach, bubble } = follow(acknowledge(coach, bubble!), state));
    expect(coach.spaceStep).toBe(SPACE_STEP_IDS.length);
    expect(bubble).toBeNull();
    expect(TAB_OF.universe).toBe("universe");
  });
});

