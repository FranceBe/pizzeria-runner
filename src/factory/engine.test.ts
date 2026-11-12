import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import {
  advance, buyCrate, buyUpgrade, changePrice, cookCapacity, cookCost, crateSize, demandRate, fairPrice, hireCook, hireCooks, hiringPlan, makePizza,
  newFactory, openRestaurant, productionRate, readFactory, RULES, tick, toggleAutomation, UPGRADES, type FactoryState, type UpgradeId,
} from "./engine";
import { botSecond } from "./bot";

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
    for (let i = 0; i < 39; i++) chain = openRestaurant(chain)!;
    expect(chain.restaurants).toBe(40);
    expect(chain.milestones).toEqual(expect.arrayContaining(["city", "country"]));
    expect(demandRate(chain)).toBeCloseTo(demandRate(counter) * 40);
  });

  it("keeps the factories' plans for later: shown, not for sale yet", () => {
    const state = rich({ era: 2, totalSold: 1e6 });
    expect(UPGRADES.factoryPlans.comingSoon).toBe(true);
    expect(buyUpgrade(state, "factoryPlans")).toBeNull();
  });

  it("sells an upgrade only once it shows, once, and for its price", () => {
    expect(buyUpgrade(rich(), "woodOven")).toBeNull();
    const state = buyUpgrade(rich({ cooks: 2 }), "woodOven")!;
    expect(state.money).toBe(1e9 - UPGRADES.woodOven.cost);
    expect(buyUpgrade(state, "woodOven")).toBeNull();
    expect(buyUpgrade({ ...newFactory(), cooks: 2, money: 10 }, "woodOven")).toBeNull();
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
  });

  it("stay small, even late in the game", () => {
    let state = rich({ era: 2, restaurants: 120, cooks: 2000 });
    for (let i = 0; i < 200; i++) state = { ...state, log: [...state.log, { id: i + 10, key: "upgradeBought", upgrade: "tvAd" }] };
    expect(JSON.stringify(readFactory(JSON.parse(JSON.stringify(tick(state, 1)))))?.length).toBeLessThan(20_000);
  });
});

describe("a whole game, played by a robot", () => {
  it("climbs from the counter to a chain of restaurants at a good pace, never breaking a rule", () => {
    const random = seededRandom(1);
    let state = newFactory();
    const reached: Record<string, number> = {};
    for (let second = 0; second < 75 * 60; second++) {
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
    }
    // A robot plays faster than a person (perfect prices, instant hires): five minutes at the counter for it is about
    // ten for a player; the chain soon after; a million pizzas within half an hour (about an hour for a player).
    expect(reached.franchise).toBeGreaterThan(4);
    expect(reached.franchise).toBeLessThan(10);
    expect(reached.manager - reached.franchise).toBeLessThan(8);
    expect(reached.city).toBeLessThan(15);
    expect(reached.million).toBeGreaterThan(18);
    expect(reached.million).toBeLessThan(40);
    expect(state.log.length).toBeLessThanOrEqual(RULES.logKept);
    // The crate grows with the central kitchen.
    expect(crateSize(state)).toBe(RULES.crateSize * 10);
  }, 60_000);
});
