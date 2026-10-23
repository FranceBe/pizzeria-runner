import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play } from "../test/helpers";
import {
  COMPETITOR_BOOST_DAYS, COMPETITOR_DAYS, COMPETITOR_GAP_DAYS, COMPETITOR_LEVEL, COMPETITOR_STARS_TO_WIN, COMPETITOR_WIN_XP, FAIR_FACTOR, POOR_FACTOR,
} from "../data/competitor";
import { competitorDay, competitorFactor, countStarsAgainstCompetitor, followCompetitor, ratingFactor } from "./competitor";
import { forecastCustomers } from "./economy";
import { levelForXp } from "./progression";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const XP = 8000;
const busyPizzeria = (overrides: Partial<GameState> = {}): GameState =>
  makeState({ day: 20, xp: XP, upgrades: { ...makeState().upgrades, salle: 4 }, ...overrides });
const withCompetitor = (stars: number, overrides: Partial<GameState> = {}): GameState =>
  busyPizzeria({ competitor: { name: "Pizza Fusée", firstDay: 20, stars }, ...overrides });

describe("the competitor across the street", () => {
  it("takes customers by the online rating: none from a good one, a few from a fair one, more from a poor one or none", () => {
    expect(ratingFactor(4.6)).toBe(1);
    expect(ratingFactor(3.9)).toBe(FAIR_FACTOR);
    expect(ratingFactor(2.8)).toBe(POOR_FACTOR);
    expect(ratingFactor(null)).toBe(POOR_FACTOR);
    const without = forecastCustomers(busyPizzeria());
    expect(forecastCustomers(withCompetitor(0, { reviewScore: { count: 10, total: 25 } }))).toBeLessThan(without);
    expect(forecastCustomers(withCompetitor(0, { reviewScore: { count: 10, total: 46 } }))).toBe(without);
  });

  it("opens now and then from its level and day, and not again too soon", () => {
    expect(levelForXp(XP)).toBeGreaterThanOrEqual(COMPETITOR_LEVEL);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = busyPizzeria();
    followCompetitor(state);
    expect(state.competitor).toMatchObject({ firstDay: 20, stars: 0 });
    expect(state.toasts.map((toast) => toast.key)).toContain("competitorOpens");
    expect(competitorDay(state)).toBe(1);
    // Not before its level or day.
    const early = busyPizzeria({ day: 5 });
    followCompetitor(early);
    expect(early.competitor).toBeNull();
    // Not again before the gap.
    const after = busyPizzeria({ day: 30, competitor: { name: "Pizza Fusée", firstDay: 20, stars: 0, outcome: "stayed" } });
    followCompetitor(after);
    expect(after.competitor?.firstDay).toBe(20);
    const later = busyPizzeria({ day: 20 + COMPETITOR_GAP_DAYS, competitor: { name: "Pizza Fusée", firstDay: 20, stars: 0, outcome: "stayed" } });
    followCompetitor(later);
    expect(later.competitor?.firstDay).toBe(20 + COMPETITOR_GAP_DAYS);
  });

  it("counts the day's stars against it while it is open, and shows on the receipt", () => {
    const state = withCompetitor(0);
    countStarsAgainstCompetitor(state, 2);
    expect(state.competitor?.stars).toBe(2);
    const ended = play(play(state, { type: "openRestaurant" }), { type: "closeEarly" });
    expect(ended.summary?.competitor).toMatchObject({ name: "Pizza Fusée", day: 1 });
  });

  it("gives up after its days if enough stars were won: reputation, and its customers for a couple of days", () => {
    const state = withCompetitor(COMPETITOR_STARS_TO_WIN, { day: 20 + COMPETITOR_DAYS });
    const xp = state.xp;
    followCompetitor(state);
    expect(state.competitor).toMatchObject({ outcome: "gaveUp", boostUntil: 20 + COMPETITOR_DAYS + COMPETITOR_BOOST_DAYS - 1 });
    expect(state.xp).toBe(xp + COMPETITOR_WIN_XP);
    expect(competitorFactor(state)).toBeGreaterThan(1);
    expect(competitorFactor({ ...state, day: 20 + COMPETITOR_DAYS + COMPETITOR_BOOST_DAYS })).toBe(1);
  });

  it("stays otherwise, and weighs on nothing past its days", () => {
    const state = withCompetitor(COMPETITOR_STARS_TO_WIN - 1, { day: 20 + COMPETITOR_DAYS });
    followCompetitor(state);
    expect(state.competitor?.outcome).toBe("stayed");
    expect(state.toasts.map((toast) => toast.key)).toContain("competitorStayed");
    expect(competitorFactor(state)).toBe(1);
    expect(competitorDay(state)).toBeNull();
  });
});
