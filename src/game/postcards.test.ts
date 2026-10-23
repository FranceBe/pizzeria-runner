import { describe, it, expect, vi, afterEach } from "vitest";
import { makeBookEntry, makeCustomer, makeState, play, serviceOf } from "../test/helpers";
import { COMPETITOR_DAYS, COMPETITOR_STARS_TO_WIN } from "../data/competitor";
import { MATCH_HALFTIME } from "../data/events";
import { EVENING_MINUTES, OPENING_MINUTES } from "./clock";
import { followCompetitor } from "./competitor";
import { sendPostcard } from "./postcards";
import { turnStoryPage } from "./stories";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const at = (state: GameState, minutes: number): GameState => {
  const service = serviceOf(state);
  return { ...state, service: { ...service, elapsed: ((minutes - OPENING_MINUTES) / EVENING_MINUTES) * (service.expectedSeconds ?? 1) } };
};
const toastKeys = (state: GameState) => state.toasts.map((toast) => toast.key);

describe("postcards", () => {
  it("come once, the first time, dated, with a word", () => {
    const state = makeState({ day: 7 });
    sendPostcard(state, "perfectDay");
    expect(state.postcards.perfectDay).toBe(7);
    expect(toastKeys(state)).toEqual(["postcard"]);
    sendPostcard({ ...state, day: 9 }, "perfectDay");
    expect(state.postcards.perfectDay).toBe(7);
  });

  it("come with a festival, a match's half-time, the rush, a power cut", () => {
    expect(play(makeState(), { type: "syncCalendar", date: "2026-10-25" }).postcards.halloween).toBe(1);
    const match = play(at(play(makeState({ day: 8, event: "match" }), { type: "openRestaurant" }), MATCH_HALFTIME + 1), { type: "tick", seconds: 0.1 });
    expect(match.postcards.matchNight).toBe(8);
    const rush = play(at(play(makeState({ xp: 300, upgrades: { ...makeState().upgrades, salle: 2 }, rushPlan: { day: 1, at: 20 * 60 + 30 } }), { type: "openRestaurant" }), 20 * 60 + 31), { type: "tick", seconds: 0.1 });
    expect(rush.postcards.rush).toBe(1);
    const powerCut = play(play(makeState({ day: 9, event: "powerCut" }), { type: "openRestaurant" }), { type: "closeEarly" });
    expect(powerCut.postcards.powerCut).toBe(9);
  });

  it("come when the competitor gives up, and when a regular's story ends", () => {
    const state = makeState({ day: 20 + COMPETITOR_DAYS, xp: 8000, competitor: { name: "Pizza Fusée", firstDay: 20, stars: COMPETITOR_STARS_TO_WIN } });
    followCompetitor(state);
    expect(state.postcards.competitorGone).toBe(state.day);
    const story = makeState({ day: 30 });
    story.customerBook = { Luca: makeBookEntry({ regular: true, story: { id: "oldChef", chapter: 3, dueDay: 30 } }) };
    turnStoryPage(story, makeCustomer({ name: "Luca", story: { id: "oldChef", chapter: 3 } }));
    expect(story.postcards.storyOldChef).toBe(30);
    expect(story.postcards.storySweethearts).toBeUndefined();
  });
});
