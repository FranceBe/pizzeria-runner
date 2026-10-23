import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { createCustomer, orderWeight } from "./customers";
import { forecastCustomers } from "./economy";
import { canHappen } from "./events";
import { happeningsToday, isDayFull, MAX_HAPPENINGS } from "./dayLoad";
import { drinkChance, pickSpoilingIngredient } from "./incidents";
import { familyMenu } from "./family";
import { DRINK_CHANCE } from "../data/drinks";
import { FAMILY_BONUS, FAMILY_SIZE, FAMILY_TIME, FAMILY_XP, FRIDGE_ORDER_BOOST, HEATWAVE_WAITING } from "../data/events";
import { secondsUntil } from "./clock";
import type { GameState, Recipe } from "./types";

afterEach(() => vi.restoreAllMocks());

const XP_LEVEL_5 = 760;

describe("a day's load", () => {
  // Tomorrow (day 10) already holds a birthday, the competitor's second day and a running quest.
  const busyEve = (): GameState =>
    makeState({
      day: 9,
      xp: XP_LEVEL_5,
      customerBook: { Giulia: makeBookEntry({ visits: 6, birthday: 10 }) },
      competitor: { name: "Da Mario", firstDay: 9, stars: 0 },
      quest: { kind: "happy", giver: "school", target: 10, progress: 2, deadlineDay: 12, reward: 30, xp: 40 },
    });

  it("counts the day's event, the competitor, story chapters, birthdays and a quest, the wedding once", () => {
    const state = busyEve();
    state.day = 10;
    expect(happeningsToday(state)).toBe(3);
    expect(isDayFull(state)).toBe(true);
    expect(happeningsToday({ ...state, quest: null, competitor: null })).toBe(1);
    const wedding = { ...state, competitor: null, customerBook: {}, event: "wedding" as const, quest: { ...state.quest!, giver: "wedding" as const } };
    expect(happeningsToday(wedding)).toBe(1);
  });

  it("keeps a full day free of anything new: no event, no new story, competitor or quest", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const next = play(busyEve(), { type: "startNextDay" });
    expect(next.event).toBeNull();
    expect(happeningsToday(next)).toBe(MAX_HAPPENINGS);
  });

  it("lets an ordinary day have its event, and stops adding once the day is full", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const quiet = play(makeState({ day: 9, xp: XP_LEVEL_5 }), { type: "startNextDay" });
    expect(quiet.event).not.toBeNull();
    expect(happeningsToday(quiet)).toBeLessThanOrEqual(MAX_HAPPENINGS);
  });

  it("never goes past the limit with what it adds itself, day after day", () => {
    let state = makeState({ day: 3, xp: XP_LEVEL_5, customerBook: { Giulia: makeBookEntry({ visits: 6, birthday: 12 }) } });
    for (let day = 0; day < 60; day++) {
      const before = happeningsToday({ ...state, day: state.day + 1, event: null });
      state = play(state, { type: "startNextDay" });
      // Birthdays and story chapters are dates already set: they may fill a day on their own, never with more added.
      expect(happeningsToday(state)).toBeLessThanOrEqual(Math.max(MAX_HAPPENINGS, before));
    }
  });
});

describe("the fridge breakdown", () => {
  const stocked = (overrides: Partial<GameState> = {}): GameState =>
    makeState({ day: 8, stock: { pate: 40, tomate: 9, mozza: 20, basilic: 3 }, ...overrides });

  it("threatens the best-stocked ingredient of the menu, never the dough, and needs one worth it", () => {
    expect(pickSpoilingIngredient(stocked())).toBe("mozza");
    expect(canHappen(stocked(), "fridgeFailure")).toBe(true);
    expect(canHappen(stocked({ stock: { pate: 40, tomate: 2, mozza: 5, basilic: 1 } }), "fridgeFailure")).toBe(false);
  });

  it("gets pizzas using it ordered more", () => {
    const state = stocked({ event: "fridgeFailure", spoilingIngredient: "basilic" });
    const margherita = state.recipes[0];
    expect(orderWeight(state, margherita)).toBeCloseTo(orderWeight({ ...state, event: null }, margherita) * FRIDGE_ORDER_BOOST);
  });

  it("loses half of what is left at closing, shown on the receipt but not as waste", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const open = play(stocked({ event: "fridgeFailure", spoilingIngredient: "mozza" }), { type: "openRestaurant" });
    const closed = play(open, { type: "closeEarly" });
    expect(closed.stock.mozza).toBe(10);
    expect(closed.summary?.spoiled).toEqual({ id: "mozza", portions: 10 });
    expect(closed.summary?.waste).toBe(0);
    const ordinary = play(play(stocked(), { type: "openRestaurant" }), { type: "closeEarly" });
    expect(ordinary.stock.mozza).toBe(20);
    expect(ordinary.summary?.spoiled).toBeUndefined();
  });
});

describe("the heatwave", () => {
  it("comes with the summer market only", () => {
    expect(canHappen(makeState({ day: 9 }), "heatwave")).toBe(true);
    expect(canHappen(makeState({ day: 5 }), "heatwave")).toBe(false);
  });

  it("brings twice as many drinks, the terrace as on a sunny day, and harder waiting", () => {
    const hot = makeState({ day: 9, event: "heatwave", upgrades: { ...makeState().upgrades, terrasse: 1 } });
    expect(drinkChance(hot)).toBeCloseTo(Math.min(0.8, DRINK_CHANCE * 2));
    expect(forecastCustomers(hot)).toBe(forecastCustomers({ ...hot, event: "sunny" }));
    const service = stateInService([makeCustomer()], { event: "heatwave" });
    serviceOf(service).nextArrivalIn = 99;
    expect(serviceOf(play(service, { type: "tick", seconds: 10 })).customers[0].waitedSeconds).toBeCloseTo(10 * HEATWAVE_WAITING);
  });
});

describe("the water cut", () => {
  it("only comes with a bar, and nobody orders a drink", () => {
    const withBar = makeState({ day: 8, upgrades: { ...makeState().upgrades, bar: 2 } });
    expect(canHappen(withBar, "waterCut")).toBe(true);
    expect(canHappen(makeState({ day: 8 }), "waterCut")).toBe(false);
    const dry = { ...withBar, event: "waterCut" as const };
    expect(drinkChance(dry)).toBe(0);
    for (let i = 0; i < 50; i++) expect(createCustomer(dry)?.drink).toBeNull();
  });
});

describe("Nonna's family", () => {
  const NONNA: Recipe = { id: "nonna", name: null, ingredients: ["pate", "tomate", "mozza", "basilic"], price: 9, classic: true, custom: false, onMenu: true, newUntil: 0 };

  // The evening open on their night, nobody else at the counter for now.
  const familyNight = (overrides: Partial<GameState> = {}): GameState => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = play(makeState({ day: 9, xp: XP_LEVEL_5, event: "nonnaFamily", ...overrides }), { type: "openRestaurant" });
    const service = serviceOf(state);
    service.nextArrivalIn = 999;
    return state;
  };
  const atTheirTime = (state: GameState): GameState => {
    const service = serviceOf(state);
    service.elapsed = secondsUntil(FAMILY_TIME, service.expectedSeconds ?? 60);
    return play(state, { type: "tick", seconds: 0.1 });
  };
  const familyOf = (state: GameState) => serviceOf(state).customers.filter((customer) => customer.family);

  it("comes as a table of four at their time, on top of the evening's customers", () => {
    const early = play(familyNight(), { type: "tick", seconds: 0.1 });
    expect(familyOf(early)).toHaveLength(0);
    const toCome = serviceOf(early).customersToCome;
    const come = atTheirTime(early);
    expect(familyOf(come)).toHaveLength(FAMILY_SIZE);
    expect(new Set(familyOf(come).map((customer) => customer.tableId)).size).toBe(1);
    expect(serviceOf(come).customersToCome).toBe(toCome);
    expect(come.toasts.map((toast) => toast.key)).toContain("familyArrived");
    // Only once.
    expect(familyOf(atTheirTime(come))).toHaveLength(FAMILY_SIZE);
  });

  it("orders Nonna's recipes when the menu has them, a margherita otherwise, and never has a diet", () => {
    const menu = makeState().recipes;
    expect(familyMenu([...menu, NONNA]).map((recipe) => recipe.id)).toEqual(["nonna"]);
    expect(familyMenu(menu).map((recipe) => recipe.id)).toEqual(["margherita"]);
    const come = atTheirTime(familyNight({ recipes: [...menu, NONNA] }));
    familyOf(come).forEach((member) => {
      expect(member.recipeId).toBe("nonna");
      expect(member.diet).toBeNull();
    });
  });

  it("are waited for: the evening doesn't end before they came (closing early still does)", () => {
    const state = familyNight();
    serviceOf(state).customersToCome = 0;
    const next = play(state, { type: "tick", seconds: 0.1 });
    expect(next.phase).toBe("service");
    expect(familyOf(next)).toHaveLength(FAMILY_SIZE);
    expect(play(familyNight(), { type: "closeEarly" }).phase).toBe("summary");
  });

  // Serves the four margheritas, one after the other.
  const serveFamily = (state: GameState): GameState => {
    let next = state;
    for (let i = 0; i < FAMILY_SIZE; i++) {
      next = play(next, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 7 });
      const pizza = serviceOf(next).ready[0];
      next = play(next, { type: "servePizza", pizzaId: pizza.id });
    }
    return next;
  };

  it("leave a bonus and reputation when all are served in time, and stay out of the customer book", () => {
    const state = atTheirTime(familyNight());
    serviceOf(state).customersToCome = 0;
    const xp = state.xp;
    const served = serveFamily(state);
    expect(served.phase).toBe("summary");
    expect(served.summary?.bonuses).toBeGreaterThanOrEqual(FAMILY_BONUS);
    expect(served.xp - xp).toBeGreaterThanOrEqual(FAMILY_XP);
    expect(served.toasts.map((toast) => toast.key)).toContain("familyHappy");
    expect(Object.keys(served.customerBook).some((name) => name.startsWith("Zi") || name.startsWith("Cugin") || name.startsWith("Nonno"))).toBe(false);
  });

  it("leave nothing extra, just a word, when one of them waited too long", () => {
    const state = atTheirTime(familyNight());
    serviceOf(state).customersToCome = 0;
    familyOf(state)[0].waitedSeconds = 200;
    const served = serveFamily(state);
    expect(served.toasts.map((toast) => toast.key)).toContain("familyDisappointed");
    expect(served.summary?.bonuses ?? 0).toBe(0);
  });

  it("only come with tables (a regular's level), and never to a challenge", () => {
    expect(canHappen(makeState({ day: 9 }), "nonnaFamily")).toBe(false);
    expect(canHappen(makeState({ day: 9, xp: XP_LEVEL_5 }), "nonnaFamily")).toBe(true);
    const state = makeState({ day: 9, xp: XP_LEVEL_5, event: "nonnaFamily" });
    state.settings.tutorialDone = true;
    const challenge = play(state, { type: "startChallenge", date: "2026-10-23" });
    const service = serviceOf(challenge);
    service.elapsed = 10_000;
    expect(familyOf(play(challenge, { type: "tick", seconds: 0.1 }))).toHaveLength(0);
  });
});
