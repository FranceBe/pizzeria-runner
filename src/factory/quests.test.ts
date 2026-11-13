import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import { ACHIEVEMENT_BONUS, ACHIEVEMENT_IDS, salesBonus } from "./achievements";
import { appetite, demandOf, levelCost, openPlanet, PLANETS, raiseLevel, shipsNeeded } from "./cosmos";
import {
  advance, canRush, chapterReward, cityCapacity, CITIES, clickPizzas, declineOrder, demandRate, incidentFixCost, makePizza, newFactory, openCity, openRestaurant,
  productionRate, readFactory, RUSH, startRush, tick, type FactoryState,
} from "./engine";
import { makeOrder, ORDERS_FROM_SALES, readOrder, stepOrder, type Order } from "./orders";
import { CHAPTER_IDS, firstChapterOf } from "./story";

const rich = (overrides: Partial<FactoryState> = {}): FactoryState => ({ ...newFactory(), money: 1e12, ...overrides });
const play = (state: FactoryState, seconds: number, random = seededRandom(3)): FactoryState => {
  let next = state;
  for (let i = 0; i < seconds; i++) next = tick(next, 1, random);
  return next;
};

describe("the story", () => {
  it("moves on chapter by chapter, paying each one, and says so in the journal", () => {
    const state = { ...newFactory(), totalSold: 30 };
    const next = tick(state, 0.2, seededRandom(1));
    expect(next.chapter).toBe(1);
    expect(next.money).toBeGreaterThanOrEqual(state.money + 40);
    expect(next.log.some((entry) => entry.key === "chapter" && entry.chapter === "firstService")).toBe(true);
    // A minute of what the game brings in, at the least a floor for the era.
    expect(chapterReward(rich({ era: 3, cooks: 0 }))).toBe(2_000_000);
  });

  it("starts an old save at its era's first chapter, so nothing earlier is paid again", () => {
    const { chapter: _chapter, ...older } = rich({ era: 3, restaurants: 150 });
    expect(readFactory(JSON.parse(JSON.stringify(older)))?.chapter).toBe(firstChapterOf(3));
    expect(CHAPTER_IDS[firstChapterOf(3)]).toBe("firstFrozen");
  });
});

describe("achievements", () => {
  it("unlock once, for good, and make every sale dearer", () => {
    const state = tick({ ...newFactory(), totalMade: 1, handMade: 500 }, 0.2, seededRandom(1));
    expect(state.achievements).toEqual(expect.arrayContaining(["firstPizza", "handMade"]));
    expect(salesBonus(state)).toBeCloseTo(1 + ACHIEVEMENT_BONUS * state.achievements.length);
    expect(tick(state, 0.2, seededRandom(1)).log.filter((entry) => entry.key === "achievement")).toHaveLength(state.achievements.length);
    expect(readFactory(JSON.parse(JSON.stringify({ ...state, achievements: ["firstPizza", "nope"] })))?.achievements).toEqual(["firstPizza"]);
    expect(ACHIEVEMENT_IDS.length).toBeGreaterThanOrEqual(25);
  });
});

describe("special orders", () => {
  const pace = { restaurants: { rate: 10, price: 5 }, trucks: { rate: 0, price: 12 }, civs: [] };

  it("ask a little more than the pace of the moment, and pay well above the pizzas' price", () => {
    const order = makeOrder(1, pace, seededRandom(1))!;
    expect(["wedding", "festival", "footballTeam"]).toContain(order.kind);
    expect(order.target).toBeGreaterThan(10 * order.left);
    expect(order.reward).toBeGreaterThan(order.target * 5);
    // A contract needs trucks, a banquet a civilisation fed.
    expect(makeOrder(3, { ...pace, trucks: { rate: 100, price: 12 } }, () => 0.99)?.kind).toBe("contract");
    expect(makeOrder(4, { ...pace, civs: [{ id: "orbitans", rate: 3 }] }, () => 0.99)).toMatchObject({ kind: "banquet", civ: "orbitans" });
  });

  it("count their pizzas, pay when done, and are gone when too late", () => {
    const order: Order = { kind: "wedding", target: 100, progress: 90, left: 10, reward: 1000 };
    expect(stepOrder(order, 1, { restaurants: 5, trucks: 0, civs: {} })).toMatchObject({ done: false, order: { progress: 95, left: 9 } });
    expect(stepOrder(order, 1, { restaurants: 10, trucks: 50, civs: {} })).toEqual({ order: null, done: true });
    expect(stepOrder({ ...order, left: 1 }, 1, { restaurants: 0, trucks: 0, civs: {} })).toEqual({ order: null, done: false });
    const state = rich({ order: { ...order, progress: 99 }, pizzas: 50, cooks: 5, price: 5 });
    const done = tick(state, 1, seededRandom(1));
    expect(done).toMatchObject({ order: null, ordersDone: 1 });
    expect(done.log.some((entry) => entry.key === "orderDone" && entry.order === "wedding")).toBe(true);
    expect(declineOrder(state).order).toBeNull();
  });

  it("come only once the first sales are behind, and never while away", () => {
    expect(play(rich({ orderClock: 1, totalSold: ORDERS_FROM_SALES - 50 }), 5).order).toBeNull();
    expect(play(rich({ orderClock: 1, totalSold: ORDERS_FROM_SALES }), 5).order).not.toBeNull();
    expect(advance(rich({ orderClock: 1, totalSold: ORDERS_FROM_SALES }), 600, seededRandom(1)).order).toBeNull();
    expect(readOrder({ kind: "banquet", target: 10, progress: 0, left: 30, reward: 1 })).toBeNull();
    expect(readOrder({ kind: "wedding", target: 10, progress: 3, left: 30, reward: 1 })).toMatchObject({ progress: 3 });
  });
});

describe("for those who stay", () => {
  it("a rush makes everything twice as fast for a while, then comes back after its cooldown", () => {
    const state = rich({ cooks: 5, restaurants: 1 });
    expect(canRush({ ...state, cooks: 0 })).toBe(false);
    const rushing = startRush(state)!;
    expect(productionRate(rushing)).toBeCloseTo(productionRate(state) * RUSH.boost);
    expect(demandRate(rushing)).toBeCloseTo(demandRate(state) * RUSH.boost);
    expect(startRush(rushing)).toBeNull();
    const after = play(rushing, RUSH.seconds + 1);
    expect(productionRate(after)).toBeCloseTo(productionRate(state));
    expect(canRush(after)).toBe(false);
    expect(canRush(play(after, RUSH.cooldown))).toBe(true);
  });

  it("a click lends the kitchen a hand: more pizzas a click with a bigger crew", () => {
    const crew = rich({ cooks: 10, kits: 1000 });
    expect(clickPizzas(crew)).toBeGreaterThan(clickPizzas(rich()) + 0.5);
    expect(makePizza(crew).handMade).toBeCloseTo(clickPizzas(crew));
  });
});

describe("the cities", () => {
  it("hold so many restaurants each; a new one brings room and customers", () => {
    const chain = rich({ era: 2, restaurants: 6 });
    expect(cityCapacity(chain)).toBe(CITIES[0].capacity);
    expect(openRestaurant(chain)).toBeNull();
    const rome = openCity(chain)!;
    expect(rome.money).toBe(chain.money - CITIES[1].cost);
    expect(openRestaurant(rome)?.restaurants).toBe(7);
    expect(demandRate(rome)).toBeGreaterThan(demandRate(chain));
    expect(openCity({ ...rome, cities: CITIES.length })).toBeNull();
    // A save from before the cities gets as many as its restaurants need.
    const { cities: _cities, ...older } = rich({ era: 2, restaurants: 40 });
    expect(readFactory(JSON.parse(JSON.stringify(older)))?.cities).toBe(4);
  });

  it("grow on their own with the expansion office, and the ad agency runs the campaigns", () => {
    const chain = rich({ era: 2, money: 1e9, restaurants: 6, upgrades: ["franchise", "expansionDirector", "adAgency"], autoExpand: true, autoAds: true });
    const grown = tick(chain, 1, seededRandom(1));
    expect(grown.cities).toBeGreaterThan(1);
    expect(grown.restaurants).toBeGreaterThan(6);
    expect(grown.marketing).toBeGreaterThan(0);
  });
});

describe("more automations", () => {
  it("the maintenance crew settles strikes and breakdowns on its own", () => {
    const state = rich({ era: 3, researched: ["conveyorBelts", "maintenance", "maintenanceCrew"], autoRepair: true,
      incident: { kind: "strike", building: "mill", left: 100 } });
    expect(incidentFixCost(state)).not.toBeNull();
    expect(tick(state, 1, seededRandom(1))).toMatchObject({ incident: null, incidentsFixed: 1 });
  });

  it("the logistician, the stewards and the agronomist keep the universe up with the appetite", () => {
    let state = rich({ era: 4, money: 1e13, researched: ["cargoHolds", "logistics", "orbitalChefs", "orbitalStewards", "terraforming", "agronomy"],
      autoShips: true, autoOvens: true, autoFarms: true });
    for (const id of ["helia", "rubra", "selena", "orbitans", "tellures"] as const) state = openPlanet(state, id)!;
    const later = play(state, 60);
    expect(shipsNeeded(later, "orbitans")).toBe(0);
    expect(later.cosmos.ovens).toBeGreaterThan(0);
    expect(later.cosmos.planets.helia.level).toBeGreaterThan(1);
    expect(later.cosmos.sold).toBeGreaterThan(0);
  });
});

describe("embassies", () => {
  it("make a civilisation hungrier, each level dearer", () => {
    const met = openPlanet(rich({ era: 4 }), "orbitans")!;
    expect(demandOf(met, "orbitans")).toBe(PLANETS.orbitans.kind === "civ" ? PLANETS.orbitans.demand : 0);
    const raised = raiseLevel(met, "orbitans")!;
    expect(demandOf(raised, "orbitans")).toBeCloseTo(demandOf(met, "orbitans") * 2);
    expect(appetite(raised)).toBeCloseTo(demandOf(raised, "orbitans"));
    expect(levelCost(raised, "orbitans")).toBeGreaterThan(levelCost(met, "orbitans"));
  });
});
