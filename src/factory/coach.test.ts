import { describe, it, expect } from "vitest";
import { acknowledge, bubbleFor, goalFor, newCoach, readCoach, settle, STEP_IDS, STEPS, TIP_IDS, TIPS, type Coach } from "./coach";
import { buyCrate, hireCook, isForSale, makePizza, newFactory, type FactoryState } from "./engine";
import { TAB_OF } from "./Factory";
import { TEXTS } from "./texts";

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
    const coach: Coach = { step: STEP_IDS.indexOf("hireCook"), seen: [], off: false };
    expect(bubbleFor(coach, { ...newFactory(), money: 5 })).toBeNull();
    expect(bubbleFor(coach, { ...newFactory(), money: 15 })).toMatchObject({ id: "hireCook" });
  });

  it("skips what the player already did on their own", () => {
    const state = { ...newFactory(), totalMade: 50, cratesBought: 2 };
    expect(settle(newCoach(), state).step).toBe(STEP_IDS.indexOf("selling"));
    const later = settle({ step: STEP_IDS.indexOf("buyCrate"), seen: [], off: false }, { ...state, cooks: 1 });
    expect(STEP_IDS[later.step]).toBe("price");
  });

  it("says nothing once turned off", () => {
    expect(bubbleFor({ ...newCoach(), off: true }, newFactory())).toBeNull();
  });
});

describe("tips", () => {
  const afterTour: Coach = { step: STEP_IDS.length, seen: [], off: false };

  it("come once each, when what they are about happens", () => {
    const state = { ...newFactory(), totalSold: 3000 };
    expect(isForSale(state, "franchise")).toBe(true);
    const bubble = bubbleFor(afterTour, state);
    expect(bubble).toEqual({ kind: "tip", id: "franchiseForSale", target: "upgrades" });
    expect(bubbleFor(acknowledge(afterTour, bubble!), state)).toBeNull();
    expect(bubbleFor(afterTour, { ...newFactory(), era: 2 })).toMatchObject({ id: "chainOpen", target: "chain" });
  });

  it("wait for the tour to end", () => {
    expect(bubbleFor(newCoach(), { ...newFactory(), totalSold: 3000 })).toMatchObject({ kind: "step" });
  });
});

describe("the goal", () => {
  it("goes from the franchise to the city, the country, a million pizzas and the continent", () => {
    expect(goalFor(newFactory())).toEqual({ id: "sellForFranchise", current: 0, target: 3000 });
    expect(goalFor({ ...newFactory(), totalSold: 3500, money: 2000 })).toEqual({ id: "buyFranchise", current: 2000, target: 8000 });
    const chain = { ...newFactory(), era: 2 as const };
    expect(goalFor({ ...chain, restaurants: 4 }).id).toBe("city");
    expect(goalFor({ ...chain, restaurants: 12 }).id).toBe("country");
    expect(goalFor({ ...chain, restaurants: 45, totalSold: 500 }).id).toBe("million");
    expect(goalFor({ ...chain, restaurants: 45, totalSold: 2e6 }).id).toBe("continent");
    expect(goalFor({ ...chain, restaurants: 150, totalSold: 2e6 }).id).toBe("factories");
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
    expect(readCoach({ step: 3, seen: ["automation", "nope"], off: false })).toEqual({ step: 3, seen: ["automation"], off: false });
    expect(readCoach({ step: -2 })).toEqual(newCoach());
    expect(readCoach({ step: 999 }).step).toBe(STEP_IDS.length);
    expect(readCoach("garbage")).toEqual(newCoach());
  });
});
