import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { createCustomer } from "./customers";
import { RARE_LINES } from "../data/customers";
import { countWeeklySale, gazetteFor, publishGazette, todaysGazette } from "./gazette";
import { PERFECT_PASS_SECONDS } from "./serving";
import { fr } from "../i18n/fr";
import { en } from "../i18n/en";
import { zh } from "../i18n/zh";
import type { DayRecord, GameState, Review } from "./types";

afterEach(() => vi.restoreAllMocks());

describe("rare lines", () => {
  it("come now and then, one of the lines every language has", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(createCustomer(makeState())?.rareLine).toBe(0);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(createCustomer(makeState())?.rareLine).toBeUndefined();
    [fr, en, zh].forEach((dictionary) => expect(dictionary.rareCustomerLines).toHaveLength(RARE_LINES));
  });
});

describe("a perfect pizza", () => {
  const serveAfter = (customer: Parameters<typeof makeCustomer>[0], secondsOnPass: number): GameState => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = stateInService([makeCustomer(customer)]);
    serviceOf(state).nextArrivalIn = 999;
    const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 6 });
    serviceOf(baked).ready[0].waitingSeconds = secondsOnPass;
    return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
  };

  it("goes straight from the oven to someone who hardly waited: a burst, and counted", () => {
    const served = serveAfter({}, 0);
    expect(served.pops.map((pop) => pop.kind)).toContain("perfect");
    expect(served.summary?.perfectServed ?? serviceOf(served).stats.perfect).toBe(1);
  });

  it("isn't one after a while on the pass, a long wait, or a wait only a slice made up for", () => {
    expect(serveAfter({}, PERFECT_PASS_SECONDS + 1).pops.map((pop) => pop.kind)).not.toContain("perfect");
    expect(serveAfter({ waitedSeconds: 14 }, 0).pops.map((pop) => pop.kind)).not.toContain("perfect");
    expect(serveAfter({ waitedSeconds: 2, sliceSeconds: 20 }, 0).pops.map((pop) => pop.kind)).not.toContain("perfect");
  });
});

describe("the neighbourhood gazette", () => {
  const day = (number: number, overrides: Partial<DayRecord> = {}): DayRecord => ({
    day: number, served: 8, revenue: 60, tips: 4, net: 20 + number, xp: 40, event: null, stars: 2, happyServed: 6, ...overrides,
  });
  const review = (dayNumber: number, stars: number): Review => ({ day: dayNumber, name: "Luca", stars, reason: "perfect", line: 0, recipeId: "margherita", recipeName: null });
  // The first morning of week 2 (day 8), after a week of seven evenings.
  const monday = (overrides: Partial<GameState> = {}, days: DayRecord[] = [1, 2, 3, 4, 5, 6, 7].map((n) => day(n))): GameState => {
    const state = makeState({ day: 8, history: days, ...overrides });
    state.weekly = { week: 0, missions: [], bonusPaid: false, sales: { margherita: { name: null, count: 30 }, "c-x": { name: "Rossa", count: 12 } } };
    return state;
  };

  it("comes out on the first morning of a week, about the week gone by, once", () => {
    const state = monday({ reviews: [review(3, 3), review(5, 5), review(9, 5)] });
    publishGazette(state);
    expect(state.gazettes).toHaveLength(1);
    const issue = state.gazettes[0];
    expect(issue).toMatchObject({ week: 0, firstDay: 1, lastDay: 7, publishedDay: 8, evenings: 7, served: 56, stars: 14, happyShare: 75 });
    expect(issue.top).toEqual({ recipeId: "margherita", recipeName: null, count: 30 });
    expect(issue.bestDay).toEqual({ day: 7, net: 27 });
    expect(issue.review?.stars).toBe(5);
    expect(issue.review?.day).toBe(5);
    expect(state.toasts.map((toast) => toast.key)).toContain("gazetteOut");
    expect(todaysGazette(state)).toBe(issue);
    expect(todaysGazette({ ...state, day: 9 })).toBeNull();
    publishGazette(state);
    expect(state.gazettes).toHaveLength(1);
  });

  it("leads with what made the week", () => {
    const headline = (overrides: Partial<GameState> = {}, days?: DayRecord[]) => gazetteFor(monday(overrides, days), 0, monday().weekly?.sales)?.headline;
    expect(headline()).toBe("topPizza");
    expect(headline({}, [1, 2, 3, 4, 5].map((n) => day(n, { stars: 3 })))).toBe("perfectWeek");
    expect(headline({ competitor: { name: "Da Mario", firstDay: 4, stars: 6, outcome: "gaveUp" } })).toBe("competitorGone");
    expect(headline({}, [day(1), day(2, { event: "wedding" })])).toBe("wedding");
    expect(headline({}, [day(1, { event: "rain" }), day(2, { event: "rain" }), day(3, { event: "rain" })])).toBe("rainyWeek");
    expect(headline({}, [day(1, { served: 3 })])).toBe("quietWeek");
    const withEarlier = [day(0), ...[1, 2, 3].map((n) => day(n))];
    expect(headline({ lifetime: { ...makeState().lifetime, bestDay: { day: 3, net: 23 } } }, withEarlier)).toBe("record");
    expect(gazetteFor(monday({}, []), 0)).toBeNull();
  });

  it("counts the week's sales as pizzas are served, and comes out through the morning", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = stateInService([makeCustomer()], { day: 7 });
    state.weekly = { week: 0, missions: [], bonusPaid: false };
    const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 6 });
    const served = play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    expect(served.weekly?.sales).toEqual({ margherita: { name: null, count: 1 } });
    const next = play(served, { type: "startNextDay" });
    expect(next.gazettes.at(-1)?.top?.recipeId).toBe("margherita");
    expect(next.weekly?.week).toBe(1);
    expect(next.weekly?.sales).toBeUndefined();
  });

  it("counts nothing before the week's missions exist", () => {
    const state = makeState();
    countWeeklySale(state, "margherita", null);
    expect(state.weekly).toBeNull();
  });
});

describe("the first day's weekly missions", () => {
  it("stay the same when the day is started over", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    const open = play(makeState(), { type: "openRestaurant" });
    const missions = open.weekly?.missions;
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const again = play(play(open, { type: "restartDay" }), { type: "openRestaurant" });
    expect(again.weekly?.missions).toEqual(missions);
  });
});
