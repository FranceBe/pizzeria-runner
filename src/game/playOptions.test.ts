import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, makeBookEntry, toJson } from "../test/helpers";
import { DAY_EVENT_IDS, EVENT_CATEGORIES, type DayEventId } from "../data/events";
import { rollDayEvent } from "./events";
import { createCustomer } from "./customers";
import { ensureRushPlan, tonightsRush } from "./evening";
import { maybeOfferQuest } from "./quests";
import { maybeOpenCompetitor } from "./competitor";
import { PLAY_FEATURES, isAllOff, isEventOn, isFeatureOn } from "./playOptions";
import { hydrateState } from "./state";
import type { GameState } from "./types";
import { lateGame } from "../test/fixtures";
import { playDays } from "../test/robot";
import { seededRandom } from "../utils/random";

afterEach(() => vi.restoreAllMocks());

const XP_LEVEL_8 = 30000;
const offEvents = (events: readonly DayEventId[], overrides: Partial<GameState> = {}): GameState =>
  play(makeState({ day: 20, xp: XP_LEVEL_8, ...overrides }), { type: "setEventsOff", events, off: true });

describe("a calmer game", () => {
  it("is all on by default, in new games and older saves alike", () => {
    const state = makeState();
    expect(DAY_EVENT_IDS.every((id) => isEventOn(state, id))).toBe(true);
    expect(PLAY_FEATURES.every((feature) => isFeatureOn(state, feature))).toBe(true);
    const { offEvents: _events, offFeatures: _features, ...olderSettings } = state.settings;
    const older = hydrateState(toJson({ ...state, settings: olderSettings }));
    expect(older.settings.offEvents).toEqual([]);
    expect(older.settings.offFeatures).toEqual([]);
  });

  it("sorts every day event into one family", () => {
    const sorted = Object.values(EVENT_CATEGORIES).flat();
    expect([...sorted].sort()).toEqual([...DAY_EVENT_IDS].sort());
    expect(new Set(sorted).size).toBe(sorted.length);
  });

  it("never draws an event switched off, and draws none at all with them all off", () => {
    const off = EVENT_CATEGORIES.incidents;
    const state = offEvents(off);
    for (let draw = 0; draw < 300; draw++) {
      const event = rollDayEvent(state, null);
      if (event) expect(off).not.toContain(event);
    }
    const none = offEvents(DAY_EVENT_IDS);
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollDayEvent(none, null)).toBeNull();
  });

  it("takes today's event away when switched off in the morning (the wedding with its banquet), not during service", () => {
    const morning = makeState({ day: 20, event: "fridgeFailure", spoilingIngredient: "mozza" });
    const calm = play(morning, { type: "setEventsOff", events: ["fridgeFailure"], off: true });
    expect(calm).toMatchObject({ event: null, spoilingIngredient: null });
    const wedding = makeState({ day: 20, event: "wedding", quest: { kind: "batch", giver: "wedding", target: 8, progress: 0, deadlineDay: 20, reward: 0, xp: 40, items: [] } });
    expect(play(wedding, { type: "setEventsOff", events: ["wedding"], off: true }).quest).toBeNull();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const open = play(makeState({ day: 20, event: "rain" }), { type: "openRestaurant" });
    expect(play(open, { type: "setEventsOff", events: ["rain"], off: true }).event).toBe("rain");
    // Switched back on, it may come again (from the next day).
    expect(isEventOn(play(calm, { type: "setEventsOff", events: ["fridgeFailure"], off: false }), "fridgeFailure")).toBe(true);
  });

  it("can do without quests, or only without group orders", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const noQuests = play(makeState({ day: 20, xp: XP_LEVEL_8 }), { type: "setFeaturesOff", features: ["quests"], off: true });
    maybeOfferQuest(noQuests);
    expect(noQuests.quest).toBeNull();
    const noBatch = play(makeState({ day: 20, xp: XP_LEVEL_8 }), { type: "setFeaturesOff", features: ["groupOrders"], off: true });
    for (let day = 0; day < 40; day++) {
      noBatch.quest = null;
      vi.spyOn(Math, "random").mockReturnValue((day * 0.37) % 1);
      maybeOfferQuest(noBatch);
      expect((noBatch.quest as GameState["quest"])?.kind).not.toBe("batch");
    }
    // A group order already planned for tonight goes, a longer quest stays.
    const planned = makeState({ day: 20, quest: { kind: "batch", giver: "school", target: 3, progress: 0, deadlineDay: 20, reward: 0, xp: 24, items: [] } });
    expect(play(planned, { type: "setFeaturesOff", features: ["groupOrders"], off: true }).quest).toBeNull();
    const longer = makeState({ day: 20, quest: { kind: "happy", giver: "school", target: 10, progress: 2, deadlineDay: 22, reward: 30, xp: 40 } });
    expect(play(longer, { type: "setFeaturesOff", features: ["groupOrders"], off: true }).quest).not.toBeNull();
  });

  it("can do without the rush, the competitor, \"the usual\" and special requests", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = play(makeState({ day: 20, xp: XP_LEVEL_8, rushPlan: { day: 20, at: 20 * 60 + 30 } }), {
      type: "setFeaturesOff",
      features: ["rush", "competitor", "asUsual", "specialRequests"],
      off: true,
    });
    expect(state.rushPlan).toBeNull();
    ensureRushPlan(state);
    expect(state.rushPlan).toBeNull();
    expect(tonightsRush(state, 30)).toBeNull();
    maybeOpenCompetitor(state);
    expect(state.competitor ?? null).toBeNull();
    state.customerBook = { Giulia: makeBookEntry({ visits: 9, orders: { margherita: 9 } }) };
    state.locals = ["Giulia"];
    for (let i = 0; i < 30; i++) {
      const customer = createCustomer(state);
      expect(customer?.asUsual).toBe(false);
      expect(customer?.extraIngredient ?? null).toBeNull();
      expect(customer?.removedIngredient ?? null).toBeNull();
    }
    // A competitor already across the street settles in quietly.
    const running = makeState({ day: 20, competitor: { name: "Da Mario", firstDay: 19, stars: 1 } });
    expect(play(running, { type: "setFeaturesOff", features: ["competitor"], off: true }).competitor?.outcome).toBe("stayed");
  });

  it("switches everything off at once, and back on", () => {
    let state = makeState();
    state = play(state, { type: "setEventsOff", events: DAY_EVENT_IDS, off: true }, { type: "setFeaturesOff", features: PLAY_FEATURES, off: true });
    expect(isAllOff(state)).toBe(true);
    state = play(state, { type: "setEventsOff", events: DAY_EVENT_IDS, off: false }, { type: "setFeaturesOff", features: PLAY_FEATURES, off: false });
    expect(state.settings).toMatchObject({ offEvents: [], offFeatures: [] });
  });

  it("plays out calm for weeks: no event, quest, rush, competitor, \"usual\" nor special request", () => {
    const random = seededRandom(31);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = play(lateGame(), { type: "setEventsOff", events: DAY_EVENT_IDS, off: true }, { type: "setFeaturesOff", features: PLAY_FEATURES, off: true });
    let calmDays = 0;
    playDays(start, {
      days: 30,
      style: "careful",
      random,
      afterDay: ({ state }) => {
        expect(state.summary?.event ?? null).toBeNull();
        expect(state.quest).toBeNull();
        expect(state.competitor ?? null).toBeNull();
        calmDays += 1;
      },
    });
    expect(calmDays).toBe(30);
  }, 120_000);
});

