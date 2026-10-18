import { describe, it, expect, vi, afterEach } from "vitest";
import type { IngredientId } from "../data/ingredients";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { achievementProgress, unlockAchievements } from "./achievements";
import { CHALLENGE_SECONDS } from "./challenge";
import { createCustomer, orderWeight } from "./customers";
import { forecastCustomers, restockPlan } from "./economy";
import { marketPrice, rollDayEvent } from "./events";
import { discoverPairings, pairingKey, visiblePairings } from "./pairings";
import { hydrateState, migrateSave } from "./state";
import { shortcutAction } from "./shortcuts";
import type { Customer, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const waitForOven = (state: GameState): GameState => play(state, { type: "tick", seconds: 10 });

// Builds, bakes and serves the first customer's order.
function serveFirst(state: GameState, ingredients: readonly IngredientId[] = MARGHERITA): GameState {
  const baked = waitForOven(play(state, ...toggle(...ingredients), { type: "bake" }));
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
}

const NO_TIP = 0.99;

describe("daily events", () => {
  it("never happen on the first days", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollDayEvent(2, null)).toBeNull();
    expect(rollDayEvent(3, null)).toBe("market");
  });

  it("never repeat two days in a row", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollDayEvent(5, "market")).toBe("rain");
  });

  it("are picked when the next day starts", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = play(makeState({ day: 4, phase: "summary" }), { type: "startNextDay" });
    expect(state.event).toBe("market");
  });

  it("make the market cheaper on market day", () => {
    const state = makeState({ event: "market" });
    expect(marketPrice(state, "mozza")).toBeCloseTo(marketPrice(makeState(), "mozza") * 0.8);
    expect(restockPlan(state, 10).cost).toBeCloseTo(restockPlan(makeState(), 10).cost * 0.8);
    const bought = play(makeState({ event: "market", money: 10 }), { type: "buyIngredient", ingredientId: "mozza", quantity: 5 });
    expect(bought.money).toBeCloseTo(10 - 5 * marketPrice(state, "mozza"));
  });

  it("bring more customers to a party and fewer in the rain", () => {
    const normal = forecastCustomers(makeState());
    expect(forecastCustomers(makeState({ event: "festival" }))).toBeGreaterThan(normal);
    expect(forecastCustomers(makeState({ event: "rain" }))).toBeLessThan(normal);
  });

  it("send a critic who rewards quick service and skips the customer book", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let state = play(makeState({ event: "critic" }), { type: "openRestaurant" });
    expect(serviceOf(state).criticPending).toBe(true);
    // With 6 customers to come, the chance for each arrival is 1 in the number still to come.
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    state = play(state, { type: "tick", seconds: 1 });
    const critic = serviceOf(state).customers[0];
    expect(critic.critic).toBe(true);
    expect(serviceOf(state).criticPending).toBe(false);

    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    serviceOf(state).customersToCome = 0;
    state = serveFirst(state, critic.ingredients);
    expect(state.customerBook[critic.name]).toBeUndefined();
    expect(state.lifetime.criticsPleased).toBe(1);
    expect(state.toasts.map((toast) => toast.key)).toContain("critic");
  });
});

describe("terrace and delivery", () => {
  const withUpgrades = (upgrades: Partial<GameState["upgrades"]>, overrides: Partial<GameState> = {}) => {
    const state = makeState(overrides);
    return { ...state, upgrades: { ...state.upgrades, ...upgrades } };
  };

  it("adds customers, more on sunny days", () => {
    const normal = forecastCustomers(makeState());
    expect(forecastCustomers(withUpgrades({ terrasse: 1 }))).toBe(normal + 1);
    expect(forecastCustomers(withUpgrades({ terrasse: 1 }, { event: "sunny" }))).toBeGreaterThan(normal + 2);
    expect(forecastCustomers(withUpgrades({ livraison: 1 }))).toBe(normal + 2);
  });

  it("delivers with a fee and an express bonus instead of a tip, outside the customer book", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const delivery = makeCustomer({ delivery: true, price: 8, waitedSeconds: 10 });
    const state = serveFirst(stateInService([delivery, makeCustomer({ id: "cust-2" })], { money: 0 }));
    expect(state.money).toBe(8 + 1.5);
    expect(state.pops).toMatchObject([{ kind: "money" }, { kind: "express", amount: 1.5 }]);
    expect(state.customerBook).toEqual({});
    expect(state.lifetime.deliveries).toBe(1);
  });

  it("creates delivery orders with the delivery fee", () => {
    const customer = createCustomer(makeState(), "delivery");
    expect(customer).toMatchObject({ delivery: true, price: 7 + 1, visitNumber: undefined });
  });
});

describe("the usual", () => {
  const withRegular = (state: GameState): GameState => {
    state.customerBook = { Luca: makeBookEntry({ visits: 4, orders: { margherita: 4 } }) };
    return state;
  };

  it("is what regulars sometimes order when they pick their favourite", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = withRegular(makeState());
    const customer = createCustomer(state, "regular", { name: "Luca" }) as Customer;
    expect(customer.name).toBe("Luca");
    expect(customer.asUsual).toBe(true);
  });

  it("disables the ingredient shortcuts and earns a bonus", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = withRegular(stateInService([makeCustomer({ asUsual: true })]));
    expect(shortcutAction(play(state, ...toggle("pate")), "1")).toBeNull();
    const served = serveFirst(state);
    expect(served.lifetime.asUsualServed).toBe(1);
  });

  it("can be revealed, losing the bonus", () => {
    const state = play(stateInService([makeCustomer({ asUsual: true })]), { type: "revealUsualOrder", customerId: "cust-1" });
    expect(serviceOf(state).customers[0].asUsual).toBe(false);
  });
});

describe("pairings", () => {
  it("are discovered once, by serving them", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = serveFirst(stateInService([makeCustomer(), makeCustomer({ id: "cust-2" })]));
    expect(state.discoveredPairings).toEqual(["tomate+basilic", "mozza+basilic"]);
    expect(state.toasts.map((toast) => toast.key)).toContain("newPairing");
    expect(discoverPairings(state, MARGHERITA)).toEqual([]);
  });

  it("stay secret in the recipe editor until discovered", () => {
    const state = makeState({ discoveredPairings: ["tomate+basilic"] });
    expect(visiblePairings(state, MARGHERITA)).toEqual({ known: [["tomate", "basilic"]], hasSecret: true });
    expect(visiblePairings(state, ["pate", "tomate", "mozza"])).toEqual({ known: [], hasSecret: false });
  });
});

describe("chef's special", () => {
  it("is ordered more often, and cleared with its recipe", () => {
    const state = makeState();
    const before = orderWeight(state, state.recipes[0]);
    const special = play(state, { type: "setChefSpecial", recipeId: "margherita" });
    expect(orderWeight(special, special.recipes[0])).toBeCloseTo(before * 1.5);
    expect(play(special, { type: "setChefSpecial", recipeId: "margherita" }).chefSpecial).toBeNull();
  });
});

describe("journal", () => {
  it("keeps every day and lifetime totals", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = serveFirst(stateInService([makeCustomer()]));
    expect(state.history).toEqual([{ day: 1, served: 1, revenue: 7, tips: 0, net: 1, xp: expect.any(Number), event: null }]);
    expect(state.lifetime).toMatchObject({ served: 1, revenue: 7, happyServed: 1, bestDay: { day: 1, net: 1 } });
    expect(state.lifetime.byRecipe).toEqual({ margherita: { name: null, count: 1 } });
  });
});

describe("achievements", () => {
  it("unlock with a toast when reached", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = serveFirst(stateInService([makeCustomer(), makeCustomer({ id: "cust-2" })]));
    expect(state.achievements.firstPizza).toBe(1);
    expect(state.toasts).toContainEqual(expect.objectContaining({ key: "achievement", params: { achievementId: "firstPizza" } }));
  });

  it("report progress, capped at the target", () => {
    const state = makeState();
    state.lifetime.served = 70;
    expect(achievementProgress(state, "served50")).toEqual({ current: 50, target: 50 });
    expect(achievementProgress(state, "served250")).toEqual({ current: 70, target: 250 });
  });

  it("unlock silently when loading an older save", () => {
    const state = makeState();
    state.lifetime.served = 60;
    expect(unlockAchievements(state, { silent: true })).toEqual(["firstPizza", "served50"]);
    expect(state.toasts).toEqual([]);
  });
});

describe("time challenge", () => {
  const inChallenge = (): GameState => {
    const state = play(makeState({ settings: { ...makeState().settings, tutorialDone: true } }), { type: "startChallenge", date: "2026-10-17" });
    serviceOf(state).customers = [makeCustomer()];
    serviceOf(state).selectedCustomerId = "cust-1";
    return state;
  };

  it("uses free ingredients and leaves money, stock and reputation alone", () => {
    const before = makeState();
    const state = serveFirst(inChallenge());
    expect(state.stock).toEqual(before.stock);
    expect(state.money).toBe(before.money);
    expect(state.xp).toBe(0);
    expect(state.customerBook).toEqual({});
    expect(serviceOf(state).challenge?.score).toBe(10 + 3 * 2 + 10);
  });

  it("ends when the clock runs out and keeps the best score", () => {
    let state = serveFirst(inChallenge());
    state = play(state, { type: "tick", seconds: CHALLENGE_SECONDS });
    expect(state.phase).toBe("prep");
    expect(state.service).toBeNull();
    expect(state.challengeResult).toEqual({ date: "2026-10-17", score: 26, served: 1, happy: 1, isNewBest: true });
    expect(state.bestChallengeScore).toBe(26);
    expect(state.dailyChallenge).toEqual({ date: "2026-10-17", best: 26 });
    expect(play(state, { type: "dismissChallengeResult" }).challengeResult).toBeNull();
  });
});

describe("saves from version 3", () => {
  const VERSION_3_SAVE = {
    version: 3,
    money: 50,
    xp: 300,
    recipes: [{ id: "c-x", name: "Miel", ingredients: ["pate", "creme", "chevre", "miel"], price: 9, classic: false, custom: true, onMenu: true, newUntil: 0 }],
    customerBook: { Luca: { visits: 3, orders: {} }, Sofia: { visits: 2, orders: {} } },
  };

  it("count pairings already used and pizzas served", () => {
    const migrated = migrateSave(VERSION_3_SAVE);
    expect(migrated.discoveredPairings).toEqual([pairingKey(["chevre", "miel"])]);
    expect(migrated).toHaveProperty("lifetime.served", 5);
  });

  it("record what was already earned, quietly", () => {
    const state = hydrateState(toJson(VERSION_3_SAVE));
    expect(state.achievements).toMatchObject({ firstPizza: expect.any(Number), firstRecipe: expect.any(Number), firstRegular: expect.any(Number) });
    expect(state.toasts).toEqual([]);
  });
});
