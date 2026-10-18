import { describe, it, expect, vi, afterEach } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { achievementProgress } from "./achievements";
import { medalFor, medalInReach } from "./batch";
import { festivalOn } from "./calendar";
import { createCustomer } from "./customers";
import { RUSH_SECONDS } from "./evening";
import { forecastCustomers } from "./economy";
import { destinationOf, ovensOf } from "./service";
import { hydrateState } from "./state";
import { starCount, starGoals } from "./stars";
import { nextStreak, streakMultiplier, warmthOf } from "./streak";
import { ensureWeek, recordWeekly } from "./weekly";
import type { Customer, GameState, Quest } from "./types";

afterEach(() => vi.restoreAllMocks());

const NO_TIP = 0.99;
const ALWAYS_TIP = 0.01;
const bake = (state: GameState, ingredients = MARGHERITA): GameState =>
  play(state, ...toggle(...ingredients), { type: "bake" }, { type: "tick", seconds: 10 });
const serveReady = (state: GameState, index = 0): GameState => play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[index].id });

describe("the perfect streak", () => {
  it("grows with happy customers, holds with patient ones, breaks with hungry ones", () => {
    expect(nextStreak(4, 0)).toBe(5);
    expect(nextStreak(4, 1)).toBe(4);
    expect(nextStreak(4, 2)).toBe(0);
    expect([2, 3, 6, 10].map(streakMultiplier)).toEqual([1, 1.1, 1.25, 1.5]);
  });

  it("is counted when serving and raises the tip", () => {
    vi.spyOn(Math, "random").mockReturnValue(ALWAYS_TIP);
    const base = stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })]);
    serviceOf(base).stats.streak = 9;
    const raised = serveReady(bake(base));
    const plain = serveReady(bake(stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })])));
    expect(serviceOf(raised).stats.streak).toBe(10);
    expect(raised.lifetime.bestStreak).toBe(10);
    expect(serviceOf(raised).stats.tips).toBeGreaterThan(serviceOf(plain).stats.tips);
  });

  it("breaks when someone hungry is served", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = stateInService([makeCustomer({ waitedSeconds: 70 }), makeCustomer({ id: "c2", name: "Zoé" })]);
    serviceOf(state).stats.streak = 5;
    const served = serveReady(bake(state));
    expect(serviceOf(served).stats.streak).toBe(0);
    expect(serviceOf(served).stats.hungryServed).toBe(1);
  });
});

describe("pizzas cooling on the pass", () => {
  it("go from hot to warm to cold, and tips follow", () => {
    expect([0, 30, 60].map(warmthOf)).toEqual(["hot", "warm", "cold"]);
    vi.spyOn(Math, "random").mockReturnValue(ALWAYS_TIP);
    const twoCustomers = () => stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })]);
    const hot = serveReady(bake(twoCustomers()));
    const cold = serveReady(play(bake(twoCustomers()), { type: "tick", seconds: 60 }));
    expect(serviceOf(cold).stats.tips).toBeLessThan(serviceOf(hot).stats.tips);
  });
});

describe("rush hour", () => {
  it("starts after a share of the evening, doubles tips and speeds arrivals, then ends", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    let state = play(makeState({ xp: 300, upgrades: { ...makeState().upgrades, salle: 2 } }), { type: "openRestaurant" });
    const rushAt = serviceOf(state).rushAtServed;
    expect(rushAt).toBeGreaterThan(0);
    serviceOf(state).customers = [makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })];
    serviceOf(state).stats.served = (rushAt ?? 1) - 1;
    state = serveReady(bake(state));
    expect(serviceOf(state).rush).toEqual({ secondsLeft: RUSH_SECONDS });
    expect(state.toasts.map((toast) => toast.key)).toContain("rush");
    state = play(state, { type: "tick", seconds: RUSH_SECONDS });
    expect(serviceOf(state).rush).toBeNull();
  });

  it("never happens on quiet evenings or before level 3", () => {
    const state = play(makeState({ xp: 0 }), { type: "openRestaurant" });
    expect(serviceOf(state).rushAtServed).toBeNull();
  });
});

describe("group orders", () => {
  const batchQuest = (count = 2): Quest => ({
    kind: "batch", giver: "football", target: count, progress: 0, deadlineDay: 1, reward: 0, xp: 16,
    items: [{ recipeId: "margherita", recipeName: null, count, delivered: 0 }],
  });
  const withBatch = (customers: Customer[] = [], count = 2): GameState => {
    const state = makeState({ quest: batchQuest(count), money: 0, stock: { pate: 9, tomate: 9, mozza: 9, basilic: 9 } });
    const open = play(state, { type: "openRestaurant" });
    serviceOf(open).customers = customers;
    serviceOf(open).customersToCome = 3;
    serviceOf(open).nextArrivalIn = 999;
    return play(open, { type: "tick", seconds: 16 });
  };

  it("come in a little after opening, as their own ticket", () => {
    const state = withBatch();
    expect(serviceOf(state).batch).toEqual({ elapsed: expect.any(Number) });
    expect(state.toasts.map((toast) => toast.key)).toContain("batchArrived");
  });

  it("take pizzas nobody at the counter is waiting for, and pay a gold medal when quick", () => {
    let state = withBatch();
    state = serveReady(bake(state));
    expect(state.quest?.items?.[0].delivered).toBe(1);
    state = serveReady(bake(state));
    expect(state.quest).toBeNull();
    expect(state.money).toBe(Math.round(7 * 2 * 1.3));
    expect(state.questLog.at(-1)).toMatchObject({ kind: "batch", medal: "gold" });
    expect(state.lifetime.batchGolds).toBe(1);
  });

  it("leave a matching pizza to the customer, unless the group ticket is selected", () => {
    const customer = makeCustomer();
    let state = bake(withBatch([customer]));
    expect(destinationOf(state, serviceOf(state), MARGHERITA)).toEqual({ customer: serviceOf(state).customers[0] });
    state = play(state, { type: "selectBatch" });
    expect(destinationOf(state, serviceOf(state), MARGHERITA)).toEqual({ batch: true });
  });

  it("give medals by time, with the time left for the current one", () => {
    expect([40, 70, 100].map((seconds) => medalFor(seconds, 2))).toEqual(["gold", "silver", "bronze"]);
    expect(medalInReach(30, 2)).toEqual({ medal: "gold", secondsLeft: 20 });
    expect(medalInReach(100, 2)).toEqual({ medal: "bronze", secondsLeft: null });
  });

  it("pay half for what was delivered when the evening ends first", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    let state = withBatch([], 4);
    state = serveReady(bake(state));
    serviceOf(state).customersToCome = 0;
    state = play(state, { type: "closeEarly" });
    expect(state.quest).toBeNull();
    expect(state.summary?.questRewards).toBe(Math.round(7 * 0.5));
  });
});

describe("incidents", () => {
  it("power cut: one oven, one pizza at a time", () => {
    const state = makeState({ event: "powerCut", upgrades: { ...makeState().upgrades, oven: 3, oven2: 2 } });
    expect(ovensOf(state)).toEqual([{ index: 0, slots: 1, bakeSeconds: 2.2 }]);
  });

  it("late delivery: the ingredient can't be used until it arrives, then comes with free portions", () => {
    let state = stateInService([makeCustomer()], { event: "lateDelivery", lateIngredient: "mozza" });
    serviceOf(state).elapsed = 0;
    state = play(state, ...toggle("pate", "mozza"));
    expect(serviceOf(state).board).toEqual(["pate"]);
    expect(state.toasts.at(-1)?.key).toBe("notDeliveredYet");
    const before = state.stock.mozza ?? 0;
    state = play(state, { type: "tick", seconds: 61 });
    expect(serviceOf(state).lateArrived).toBe(true);
    expect(state.stock.mozza).toBe(before + 3);
    expect(serviceOf(play(state, ...toggle("mozza"))).board).toContain("mozza");
  });

  it("inspection: a spotless day earns reputation", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    let state = stateInService([0, 1, 2].map((index) => makeCustomer({ id: `c${index}`, name: ["Zoé", "Tom", "Ada"][index] })), { event: "inspection" });
    for (let index = 0; index < 3; index++) state = serveReady(bake(state));
    expect(state.summary?.inspectionPassed).toBe(true);
  });

  it("scooter strike: no deliveries, more people eating in", () => {
    const withDelivery = { upgrades: { ...makeState().upgrades, livraison: 1 } };
    expect(forecastCustomers(makeState({ ...withDelivery, event: "scooterStrike" }))).toBeGreaterThan(forecastCustomers(makeState(withDelivery)) - 2);
  });
});

describe("the day's stars", () => {
  it("one per goal reached", () => {
    const goals = starGoals({ served: 6, hungryServed: 0, closedEarly: false, waste: 0, net: 30, charges: 6 });
    expect(goals).toEqual({ happy: true, waste: true, profit: true });
    expect(starCount(starGoals({ served: 6, hungryServed: 1, closedEarly: false, waste: 2, net: 30, charges: 6 }))).toBe(1);
    expect(starGoals({ served: 6, hungryServed: 0, closedEarly: true, waste: 0, net: 0, charges: 6 }).happy).toBe(false);
  });

  it("are given at closing time and add up", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = serveReady(bake(stateInService([makeCustomer()])));
    expect(state.summary).toMatchObject({ stars: 1, starGoals: { happy: true, waste: false, profit: false } });
    expect(state.lifetime.stars).toBe(1);
  });

  it("unlock looks that can't be bought", () => {
    const poor = play(makeState({ money: 999 }), { type: "chooseCosmetic", slot: "awning", id: "golden" });
    expect(poor.cosmetics.awning).toBe("red");
    const starry = makeState();
    starry.lifetime.stars = 20;
    expect(play(starry, { type: "chooseCosmetic", slot: "awning", id: "golden" }).cosmetics.awning).toBe("golden");
  });
});

describe("weekly missions", () => {
  it("come three at a time, renewed each week", () => {
    const state = makeState({ day: 2 });
    ensureWeek(state);
    expect(state.weekly?.missions).toHaveLength(3);
    const first = state.weekly;
    ensureWeek(state);
    expect(state.weekly).toBe(first);
    state.day = 8;
    ensureWeek(state);
    expect(state.weekly?.week).toBe(1);
  });

  it("pay when done, and a bonus for all three", () => {
    const state = makeState({ money: 0 });
    state.weekly = {
      week: 0, bonusPaid: false,
      missions: [
        { kind: "served", target: 2, progress: 0, done: false },
        { kind: "streak", target: 5, progress: 0, done: false },
        { kind: "tips", target: 3, progress: 0, done: false },
      ],
    };
    recordWeekly(state, "served", 2);
    expect(state.money).toBe(25);
    recordWeekly(state, "streak", 3, "max");
    recordWeekly(state, "streak", 2, "max");
    expect(state.weekly.missions[1].progress).toBe(3);
    recordWeekly(state, "streak", 6, "max");
    recordWeekly(state, "tips", 3.5);
    expect(state.weekly.bonusPaid).toBe(true);
    expect(state.money).toBe(25 * 3 + 50);
  });
});

describe("celebrities", () => {
  it("order the finest pizza with an extra topping, and leave a big tip and a photo", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = play(makeState({ money: 999, xp: 900 }), { type: "signSupplier", ingredientId: "jambon" }, { type: "signSupplier", ingredientId: "champi" });
    const star = createCustomer(state, "celebrity") as Customer;
    expect(star).toMatchObject({ celebrity: true, visitNumber: undefined });
    expect(star.extraIngredient).not.toBeNull();
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const served = serveReady(bake(stateInService([makeCustomer({ name: "Luna Star", celebrity: true })], { money: 0 })));
    expect(served.money).toBe(7 + 10 - 6);
    expect(served.celebrityWall).toEqual(["Luna Star"]);
    expect(served.customerBook["Luna Star"]).toBeUndefined();
  });
});

describe("calendar festivals", () => {
  it("follow the real date, including across the new year", () => {
    expect(festivalOn("2026-10-31")).toBe("halloween");
    expect(festivalOn("2026-12-31")).toBe("christmas");
    expect(festivalOn("2027-01-01")).toBe("christmas");
    expect(festivalOn("2027-02-14")).toBe("valentine");
    expect(festivalOn("2027-06-01")).toBeNull();
  });

  it("put their ingredient on sale with a gift and their recipe in the book, then take it away", () => {
    let state = makeState();
    expect(state.unlocked.potiron).toBeFalsy();
    state = play(state, { type: "syncCalendar", date: "2026-10-25" });
    expect(state).toMatchObject({ festival: "halloween", stock: expect.objectContaining({ potiron: 6 }) });
    expect(state.unlocked.potiron).toBe(true);
    expect(state.recipes.map((recipe) => recipe.id)).toContain("zucca");
    state = play(state, { type: "syncCalendar", date: "2026-11-10" });
    expect(state.festival).toBeNull();
    expect(state.unlocked.potiron).toBe(false);
  });

  it("never count among the suppliers to sign", () => {
    const allSigned = makeState({ unlocked: Object.fromEntries(INGREDIENTS.filter((ingredient) => !ingredient.festival).map(({ id }) => [id, true])) });
    const { current, target } = achievementProgress(allSigned, "allSuppliers");
    expect(current).toBe(target);
  });
});

describe("customers' variety", () => {
  it("keeps names unique at the counter even with the bigger crowd", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = stateInService([makeCustomer({ name: "Giulia" })]);
    expect((createCustomer(state) as Customer).name).not.toBe("Giulia");
    expect(makeBookEntry().visits).toBe(1);
  });
});

describe("saves from version 8", () => {
  it("load with every new field in place", () => {
    const state = hydrateState(toJson({ version: 8, money: 2, recipes: [] }));
    expect(state).toMatchObject({ festival: null, weekly: null, celebrityWall: [], lateIngredient: null });
    expect(state.lifetime).toMatchObject({ stars: 0, bestStreak: 0, celebrities: 0, batchGolds: 0 });
  });
});
