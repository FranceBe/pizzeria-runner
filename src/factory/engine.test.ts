import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import {
  advance, buyCrate, buyUpgrade, changePrice, cookCapacity, cookCost, crateSize, demandRate, fairPrice, hireCook, hireCooks, hiringPlan, makePizza,
  newFactory, openCity, openRestaurant, productionRate, readFactory, RULES, SPACE_PLANS_SALES, tick, toggleAutomation, UPGRADES, type FactoryState, type UpgradeId,
} from "./engine";
import { botSecond } from "./bot";
import { build, buildModule, doResearch, frozenRate, hasAutomation, isForSale, sell } from "./engine";
import { ACHIEVEMENT_IDS, salesBonus } from "./achievements";
import { newCosmos } from "./cosmos";
import { CHAPTER_IDS } from "./story";
import { FIRST_INCIDENT } from "./incidents";
import { BUILDING_IDS, BUILDINGS, buildingCost, nextModule, noBuildings, planFor, WHOLESALE_PRICE, type BuildingId } from "./plant";

const rich = (overrides: Partial<FactoryState> = {}): FactoryState => ({ ...newFactory(), money: 1e9, ...overrides });
const withUpgrades = (state: FactoryState, ...ids: UpgradeId[]): FactoryState => ({ ...state, upgrades: [...state.upgrades, ...ids] });

describe("the counter", () => {
  it("starts with a little money, a few kits and a welcome", () => {
    const state = newFactory();
    expect(state).toMatchObject({ era: 1, money: RULES.startMoney, kits: RULES.startKits, cooks: 0, restaurants: 1, price: RULES.startPrice });
    expect(state.log.map((entry) => entry.key)).toEqual(["welcome"]);
  });

  it("makes a pizza a click from a kit, two with the second pair of hands, none without kits", () => {
    let state = makePizza(newFactory());
    expect(state).toMatchObject({ pizzas: 1, kits: RULES.startKits - 1, totalMade: 1 });
    state = makePizza(withUpgrades(state, "doubleHands"));
    expect(state.pizzas).toBe(3);
    const empty = makePizza({ ...newFactory(), kits: 0 });
    expect(empty.pizzas).toBe(0);
    expect(empty.log.at(-1)?.key).toBe("outOfKits");
  });

  it("sells to customers as fast as the price lets them, and no more than is made", () => {
    const state = { ...newFactory(), pizzas: 100 };
    const sold = tick(state, 1, seededRandom(1));
    expect(sold.totalSold).toBeCloseTo(demandRate(state));
    expect(sold.money).toBeCloseTo(state.money + demandRate(state) * state.price);
    expect(demandRate({ ...state, price: 10 })).toBeCloseTo(demandRate(state) / 4);
    // At the starting price, customers come about as fast as a first few cooks can make pizzas.
    expect(demandRate(state)).toBeCloseTo(RULES.demandPerRestaurant);
    const few = tick({ ...newFactory(), pizzas: 0.2 }, 1, seededRandom(1));
    expect(few.totalSold).toBeCloseTo(0.2);
    expect(few.log.map((entry) => entry.key)).not.toContain("firstSale");
    expect(sold.log.map((entry) => entry.key)).toContain("firstSale");
  });

  it("moves the price in steps that suit it, between its bounds", () => {
    expect(changePrice({ ...newFactory(), price: 5 }, 1).price).toBe(5.5);
    expect(changePrice({ ...newFactory(), price: 1.5 }, -1).price).toBe(1.4);
    expect(changePrice({ ...newFactory(), price: 2 }, -1).price).toBe(1.9);
    expect(changePrice({ ...newFactory(), price: 40 }, 1).price).toBe(45);
    expect(changePrice({ ...newFactory(), price: RULES.minPrice }, -1).price).toBe(RULES.minPrice);
  });

  it("sells crates of kits at a price that wanders between its bounds", () => {
    const state = buyCrate(newFactory())!;
    expect(state.kits).toBe(RULES.startKits + RULES.crateSize);
    expect(buyCrate({ ...newFactory(), money: 1 })).toBeNull();
    let wandering = newFactory();
    const random = seededRandom(3);
    const prices = new Set<number>();
    for (let i = 0; i < 600; i++) {
      wandering = tick(wandering, 1, random);
      prices.add(wandering.cratePrice);
      expect(wandering.cratePrice).toBeGreaterThanOrEqual(RULES.crateMinPrice);
      expect(wandering.cratePrice).toBeLessThanOrEqual(RULES.crateMaxPrice);
    }
    expect(prices.size).toBeGreaterThan(20);
  });
});

describe("cooks", () => {
  it("cook on their own from the kits there are, faster with each oven", () => {
    const state = rich({ cooks: 4, kits: 1000 });
    expect(productionRate(state)).toBeCloseTo(4 * RULES.cookRate);
    expect(productionRate(withUpgrades(state, "woodOven", "bigMixer"))).toBeCloseTo(4 * RULES.cookRate * 3);
    const starved = tick(rich({ cooks: 4, kits: 0.5, price: 1000 }), 1, seededRandom(1));
    expect(starved.pizzas).toBeCloseTo(0.5);
    expect(starved.log.map((entry) => entry.key)).toContain("outOfKits");
  });

  it("are hired one, ten, or as many as there is room and money for, at the price shown", () => {
    const state = rich({ money: 100 });
    const plan = hiringPlan(state, 10);
    expect(plan.count).toBe(5);
    const hired = hireCooks(state, 10);
    expect(hired.cooks).toBe(plan.count);
    expect(hired.money).toBeCloseTo(100 - plan.cost);
    expect(hiringPlan({ ...state, money: 10 }, 1)).toEqual({ count: 0, cost: 0 });
  });

  it("cost more as a kitchen fills up, need room, and come cheaper again with a new restaurant", () => {
    let state = rich();
    const first = cookCost(state);
    state = hireCooks(state, 3);
    expect(state.cooks).toBe(3);
    expect(cookCost(state)).toBeGreaterThan(first);
    state = hireCooks(state, 50);
    expect(state.cooks).toBe(cookCapacity(state));
    expect(hireCook(state)).toBeNull();
    expect(state.log.map((entry) => entry.key)).toContain("kitchenFull");
    const chain = { ...state, era: 2 as const };
    const opened = openRestaurant(chain)!;
    expect(cookCost(opened)).toBeLessThan(cookCost(chain) * 1.5);
    expect(cookCapacity(opened)).toBe(cookCapacity(chain) * 2);
  });
});

describe("automation", () => {
  it("the supplier keeps kits in stock, the manager hires, the analyst sets the price; each can be stopped", () => {
    const random = seededRandom(2);
    let state = buyUpgrade(rich({ totalMade: 100, cratesBought: 5, cooks: 3, kits: 0 }), "supplier")!;
    expect(state.autoBuy).toBe(true);
    state = tick(state, 1, random);
    expect(state.kits).toBeGreaterThan(productionRate(state) * 10);
    const paused = tick({ ...toggleAutomation(state, "autoBuy"), kits: 0 }, 1, random);
    expect(paused.kits).toBe(0);

    let chain = rich({ era: 2, kits: 1e6 });
    chain = buyUpgrade(chain, "manager")!;
    chain = tick(chain, 1, random);
    expect(chain.cooks).toBe(cookCapacity(chain));

    let priced = rich({ era: 2, restaurants: 4, cooks: 20, kits: 1e6, price: 50 });
    priced = tick(buyUpgrade(priced, "pricingAnalyst")!, 1, random);
    expect(priced.price).toBeCloseTo(fairPrice(priced, productionRate(priced) + priced.pizzas / 30), 0);
    // An automation never runs without its upgrade.
    expect(toggleAutomation(newFactory(), "autoHire").autoHire).toBe(false);
  });
});

describe("the chain", () => {
  it("opens with the franchise: restaurants for sale, the neighbourhood, the city, the country", () => {
    const counter = rich({ totalSold: 5000 });
    expect(openRestaurant(counter)).toBeNull();
    let chain = buyUpgrade(counter, "franchise")!;
    expect(chain.era).toBe(2);
    expect(chain.log.map((entry) => entry.key)).toContain("franchiseOpen");
    // Naples holds six restaurants; then the chain settles in the next city.
    for (let i = 0; i < 5; i++) chain = openRestaurant(chain)!;
    expect(openRestaurant(chain)).toBeNull();
    chain = openCity(chain)!;
    expect(chain).toMatchObject({ cities: 2, restaurants: 6 });
    expect(chain.log.at(-1)).toMatchObject({ key: "cityOpen", city: 1 });
    chain = openCity(openCity(chain)!)!;
    for (let i = 0; i < 34; i++) chain = openRestaurant(chain)!;
    expect(chain.restaurants).toBe(40);
    expect(chain.milestones).toEqual(expect.arrayContaining(["city", "country"]));
    // Each restaurant brings its customers, and each city beyond the first some more everywhere.
    expect(demandRate(chain)).toBeCloseTo(demandRate(counter) * 40 * (1 + RULES.cityBoost * 3));
  });

  it("sells the factory plans once the chain is settled in seven cities and has sold twenty million pizzas: they open era 3", () => {
    expect(isForSale(rich({ era: 2, totalSold: 3e7, cities: 6 }), "factoryPlans")).toBe(false);
    expect(isForSale(rich({ era: 2, totalSold: 1e7, cities: 7 }), "factoryPlans")).toBe(false);
    const factories = buyUpgrade(rich({ era: 2, totalSold: 3e7, cities: 7, upgrades: ["franchise"] }), "factoryPlans")!;
    expect(factories.era).toBe(3);
    expect(factories.log.map((entry) => entry.key)).toContain("factoriesOpen");
  });

  it("sells an upgrade only once it shows, once, and for its price", () => {
    expect(buyUpgrade(rich(), "woodOven")).toBeNull();
    const state = buyUpgrade(rich({ cooks: 2 }), "woodOven")!;
    expect(state.money).toBe(1e9 - UPGRADES.woodOven.cost);
    expect(buyUpgrade(state, "woodOven")).toBeNull();
    expect(buyUpgrade({ ...newFactory(), cooks: 2, money: 10 }, "woodOven")).toBeNull();
  });
});

describe("the factories", () => {
  const plantState = (buildings: Partial<Record<BuildingId, number>>, overrides: Partial<FactoryState> = {}): FactoryState =>
    rich({ era: 3, buildings: { ...noBuildings(), ...buildings }, ...overrides });
  // A plant sized by the planner for one pizza factory.
  const oneFactory = (overrides: Partial<FactoryState> = {}): FactoryState => {
    const plan = planFor(plantState({}), BUILDINGS.pizzaFactory.makes.frozen ?? 0);
    return plantState(Object.fromEntries(BUILDING_IDS.map((id) => [id, Math.ceil(plan[id] - 1e-9)])), overrides);
  };
  const runFor = (state: FactoryState, seconds: number) => advance(state, seconds, seededRandom(1));

  it("ship frozen pizzas at the wholesale price, and count them sold", () => {
    // The story told and every achievement unlocked: what is earned is the trucks' sales alone, with the achievements' bonus.
    const start = oneFactory({ money: 0, price: 500, chapter: CHAPTER_IDS.length, achievements: [...ACHIEVEMENT_IDS] });
    const after = runFor(start, 60);
    expect(after.totalSold).toBeGreaterThan(start.totalSold);
    expect(after.money).toBeGreaterThan(0);
    expect(after.totalEarned - start.totalEarned).toBeCloseTo((after.totalSold - start.totalSold) * WHOLESALE_PRICE * salesBonus(start), -3);
    expect(frozenRate(after)).toBeGreaterThan(2000);
    expect(after.milestones).toContain("firstFactoryPizza");
  });

  it("serve the restaurants first, as kits, when the player says so (off at first)", () => {
    const hungry = oneFactory({ kits: 0, cooks: 5, restaurants: 1 });
    expect(hungry.autoKits).toBe(false);
    expect(runFor(hungry, 30).kits).toBeLessThan(1);
    expect(hasAutomation(hungry, "autoKits")).toBe(true);
    const served = runFor(toggleAutomation(hungry, "autoKits"), 30);
    expect(served.kits).toBeGreaterThan(0);
    expect(served.kitsFromPlant).toBeGreaterThan(0);
    // Taken before the pizza factories: fewer frozen pizzas.
    expect(frozenRate(served)).toBeLessThan(frozenRate(runFor(hungry, 30)));
  });

  it("build only in era 3, one building or a whole module", () => {
    expect(build(rich({ era: 2 }), "mill")).toBeNull();
    const built = build(plantState({}), "mill")!;
    expect(built.buildings.mill).toBe(1);
    const module = nextModule(plantState({}));
    const withModule = buildModule(plantState({}))!;
    expect(withModule.money).toBeCloseTo(1e9 - module.cost);
    expect(withModule.buildings.pizzaFactory).toBe(1);
    expect(buildModule(plantState({}, { money: 1000 }))).toBeNull();
  });

  it("sell a building back for half of what the last one cost, to slow a step down", () => {
    const built = build(build(plantState({}), "mill")!, "mill")!;
    const sold = sell(built, "mill")!;
    expect(sold.buildings.mill).toBe(1);
    expect(sold.money - built.money).toBeCloseTo(buildingCost(sold, "mill") / 2);
    expect(sell(sell(sold, "mill")!, "mill")).toBeNull();
    expect(sell(rich({ era: 2 }), "mill")).toBeNull();
  });

  it("research what is open, with the points, and the foreman then builds on their own", () => {
    const state = plantState({}, { research: 400 });
    expect(doResearch(state, "modules")).toBeNull();
    const calculator = doResearch(state, "calculator")!;
    expect(calculator.researched).toEqual(["calculator"]);
    expect(calculator.research).toBe(100);
    expect(calculator.log.at(-1)).toMatchObject({ key: "researchDone", research: "calculator" });
    expect(doResearch(calculator, "calculator")).toBeNull();
    const foreman = doResearch(plantState({}, { research: 5000, researched: ["calculator", "modules"] }), "foreman")!;
    expect(foreman.autoBuild).toBe(true);
    expect(runFor(foreman, 2).buildings.pizzaFactory).toBeGreaterThan(0);
  });

  it("sell the rocket plans once enough pizzas are sold: they open era 4, the universe", () => {
    expect(isForSale(plantState({}, { totalSold: SPACE_PLANS_SALES - 1 }), "spacePlans")).toBe(false);
    const state = plantState({}, { totalSold: SPACE_PLANS_SALES, money: 1e10 });
    expect(isForSale(state, "spacePlans")).toBe(true);
    const universe = buyUpgrade(state, "spacePlans")!;
    expect(universe.era).toBe(4);
    expect(universe.money).toBe(state.money - UPGRADES.spacePlans.cost);
    expect(universe.log.at(-1)?.key).toBe("universeOpen");
  });
});

describe("time away", () => {
  it("goes on while the page is closed, up to eight hours", () => {
    const state = rich({ cooks: 5, kits: 1e7, upgrades: ["supplier"] });
    const hour = advance(state, 3600, seededRandom(4));
    expect(hour.seconds).toBeCloseTo(3600);
    expect(hour.totalSold).toBeGreaterThan(0);
    expect(advance(state, 30 * 24 * 3600, seededRandom(4)).seconds).toBeCloseTo(RULES.offlineCap);
    expect(advance(state, -50).seconds).toBe(0);
  });
});

describe("saves", () => {
  it("load back as they were, and anything odd starts afresh", () => {
    const state = advance(buyCrate(makePizza(newFactory()))!, 120, seededRandom(1));
    expect(readFactory(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(readFactory(null)).toBeNull();
    expect(readFactory({ ...state, version: 2 })).toBeNull();
    expect(readFactory({ ...state, money: -5 })).toBeNull();
    expect(readFactory({ ...state, money: "lots" })).toBeNull();
    expect(readFactory({ ...state, restaurants: 0 })).toBeNull();
    expect(readFactory({ ...state, upgrades: ["woodOven", "timeMachine"] })?.upgrades).toEqual(["woodOven"]);
    // A save from before the factories: none of them yet.
    const { buildings, stocks, factoryRates, stockTrends, research, researched, autoBuild, autoKits, kitsFromPlant, incident, incidentClock, incidentsOn, cosmos, ...older } = state;
    expect(cosmos).toEqual(newCosmos());
    expect(buildings && stocks && factoryRates && stockTrends && research === 0 && researched && !autoBuild && !autoKits && kitsFromPlant === 0).toBeTruthy();
    expect(incident === null && incidentClock === FIRST_INCIDENT && incidentsOn).toBeTruthy();
    expect(readFactory(JSON.parse(JSON.stringify(older)))).toEqual(state);
    expect(readFactory({ ...state, buildings: { mill: -3, pizzaFactory: "many" } })?.buildings).toEqual(noBuildings());
    // A save from the first factories: their distribution deals and old buildings are dropped, the rest stays.
    const firstFactories = { ...state, era: 3, deals: 4, buildings: { wheatFarm: 3, mill: 2, oldThing: 9 }, researched: ["calculator", "warpDrive"] };
    const read = readFactory(JSON.parse(JSON.stringify(firstFactories)))!;
    expect(read.buildings).toEqual({ ...noBuildings(), wheatFarm: 3, mill: 2 });
    expect(read.researched).toEqual(["calculator"]);
    expect("deals" in read).toBe(false);
  });

  it("stay small, even late in the game", () => {
    let state = rich({ era: 2, restaurants: 120, cooks: 2000 });
    for (let i = 0; i < 200; i++) state = { ...state, log: [...state.log, { id: i + 10, key: "upgradeBought", upgrade: "tvAd" }] };
    expect(JSON.stringify(readFactory(JSON.parse(JSON.stringify(tick(state, 1)))))?.length).toBeLessThan(20_000);
  });
});

describe("a whole game, played by a robot", () => {
  it("climbs from the counter to a chain of restaurants, then to factories, at a good pace, never breaking a rule", () => {
    const random = seededRandom(1);
    let state = newFactory();
    const reached: Record<string, number> = {};
    let incidents = 0;
    for (let second = 0; second < 110 * 60; second++) {
      const before = state;
      state = botSecond(state, { clicksPerSecond: 4, random });
      expect(state.money).toBeGreaterThanOrEqual(0);
      expect(state.kits).toBeGreaterThanOrEqual(-1e-9);
      expect(state.pizzas).toBeGreaterThanOrEqual(-1e-9);
      expect(state.cooks).toBeLessThanOrEqual(cookCapacity(state));
      expect(state.totalSold).toBeGreaterThanOrEqual(before.totalSold);
      for (const id of ["franchise", "manager", "pricingAnalyst"] as const) if (state.upgrades.includes(id)) reached[id] ??= second / 60;
      if (state.totalSold >= 1e6) reached.million ??= second / 60;
      if (state.restaurants >= 10) reached.city ??= second / 60;
      if (state.era >= 3) reached.factories ??= second / 60;
      if (frozenRate(state) >= 10_000) reached.factory10k ??= second / 60;
      if (state.researched.length >= 5) reached.fiveResearches ??= second / 60;
      if (state.totalSold >= 1e8) reached.hundredMillion ??= second / 60;
      if (state.incident && !before.incident) incidents++;
    }
    // A robot plays faster than a person (perfect prices, instant hires, every rush called): five minutes at the counter
    // for it is about ten for a player; the chain soon after; a million pizzas within half an hour.
    expect(reached.franchise).toBeGreaterThan(4);
    expect(reached.franchise).toBeLessThan(10);
    expect(reached.manager - reached.franchise).toBeLessThan(8);
    expect(reached.city).toBeLessThan(15);
    expect(reached.million).toBeGreaterThan(8);
    expect(reached.million).toBeLessThan(30);
    // The factories after about fifty minutes of chain, running within minutes, five researches within half an hour, a
    // hundred million pizzas soon after (and the rocket, era 3's end, well past the 110 minutes played here).
    expect(reached.factories).toBeGreaterThan(40);
    expect(reached.factories).toBeLessThan(75);
    expect(reached.factory10k - reached.factories).toBeLessThan(15);
    expect(reached.fiveResearches - reached.factories).toBeLessThan(30);
    expect(reached.hundredMillion - reached.factories).toBeLessThan(45);
    // Incidents along the way (one every five to ten minutes once the plant runs), and the pace above all the same.
    expect(incidents).toBeGreaterThan(3);
    expect(state.log.length).toBeLessThanOrEqual(RULES.logKept);
    // The crate grows with the central kitchen.
    expect(crateSize(state)).toBe(RULES.crateSize * 10);
  }, 180_000);
});
