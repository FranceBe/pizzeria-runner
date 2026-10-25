import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, makeBookEntry, toJson } from "../test/helpers";
import { DAY_EVENT_IDS, EVENT_CATEGORIES, type DayEventId } from "../data/events";
import { rollDayEvent } from "./events";
import { createCustomer } from "./customers";
import { ensureRushPlan, tonightsRush } from "./evening";
import { maybeOfferQuest } from "./quests";
import { maybeOpenCompetitor } from "./competitor";
import { happeningsToday, isDayFull } from "./dayLoad";
import { DIFFICULTIES, DIFFICULTY_RULES, difficultyOf, eventWeight, isEventOn, isFeatureOn, type Difficulty } from "./playOptions";
import { hydrateState, migrateSave } from "./state";
import { lateGame } from "../test/fixtures";
import { playDays } from "../test/robot";
import { seededRandom } from "../utils/random";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const XP_LEVEL_8 = 30000;
const at = (difficulty: Difficulty, overrides: Partial<GameState> = {}): GameState =>
  play(makeState({ day: 20, xp: XP_LEVEL_8, ...overrides }), { type: "setDifficulty", difficulty });

// How often each family comes, over many draws.
const drawFamilies = (state: GameState, draws = 2000): Record<string, number> => {
  const counts: Record<string, number> = { none: 0, weather: 0, incidents: 0, evenings: 0 };
  for (let draw = 0; draw < draws; draw++) {
    const event = rollDayEvent(state, null);
    const family = event ? Object.entries(EVENT_CATEGORIES).find(([, ids]) => (ids as readonly DayEventId[]).includes(event))?.[0] : "none";
    counts[family ?? "none"] += 1;
  }
  return counts;
};

describe("difficulty levels", () => {
  it("are normal by default, with every event and feature of the game", () => {
    const state = makeState();
    expect(difficultyOf(state)).toBe("normal");
    expect(DAY_EVENT_IDS.every((id) => isEventOn(state, id))).toBe(true);
    expect(DAY_EVENT_IDS.every((id) => eventWeight(state, id) > 0)).toBe(true);
  });

  it("sort every day event into one family", () => {
    const sorted = Object.values(EVENT_CATEGORIES).flat();
    expect([...sorted].sort()).toEqual([...DAY_EVENT_IDS].sort());
  });

  it("bring events more and more often, the incidents most of all", () => {
    const random = seededRandom(5);
    vi.spyOn(Math, "random").mockImplementation(random);
    const counts = Object.fromEntries(DIFFICULTIES.map((level) => [level, drawFamilies(at(level))]));
    // Event days grow with the level; hardcore has one every day.
    expect(counts.gentle.none).toBeGreaterThan(counts.normal.none);
    expect(counts.normal.none).toBeGreaterThan(counts.hard.none);
    expect(counts.hardcore.none).toBe(0);
    // Gentle has no incident nor special evening; easy has few incidents; hard and hardcore, more and more.
    expect(counts.gentle.incidents + counts.gentle.evenings).toBe(0);
    expect(counts.easy.incidents).toBeLessThan(counts.normal.incidents);
    expect(counts.hard.incidents).toBeGreaterThan(counts.normal.incidents);
    expect(counts.hardcore.incidents).toBeGreaterThan(counts.hard.incidents);
  });

  it("keep gentle to the kindest events, and off the features that add pressure", () => {
    const gentle = at("gentle");
    expect(DAY_EVENT_IDS.filter((id) => isEventOn(gentle, id)).sort()).toEqual(["market", "rain", "sunny"]);
    (["rush", "groupOrders", "asUsual", "specialRequests", "competitor"] as const).forEach((feature) => expect(isFeatureOn(gentle, feature)).toBe(false));
    expect(isFeatureOn(gentle, "quests")).toBe(true);
    vi.spyOn(Math, "random").mockReturnValue(0);
    ensureRushPlan(gentle);
    expect(gentle.rushPlan).toBeNull();
    expect(tonightsRush(gentle, 30)).toBeNull();
    maybeOpenCompetitor(gentle);
    expect(gentle.competitor ?? null).toBeNull();
    gentle.customerBook = { Giulia: makeBookEntry({ visits: 9, orders: { margherita: 9 } }) };
    gentle.locals = ["Giulia"];
    for (let i = 0; i < 30; i++) {
      const customer = createCustomer(gentle);
      expect(customer?.asUsual).toBe(false);
      expect(customer?.extraIngredient ?? null).toBeNull();
    }
    // Quests stay, never a group order.
    for (let day = 0; day < 40; day++) {
      gentle.quest = null;
      vi.spyOn(Math, "random").mockReturnValue((day * 0.37) % 1);
      maybeOfferQuest(gentle);
      expect((gentle.quest as GameState["quest"])?.kind).not.toBe("batch");
    }
  });

  it("let a day hold more as they get harder, with no limit at all in hardcore", () => {
    const busy = (difficulty: Difficulty) =>
      at(difficulty, {
        event: "rain",
        customerBook: { Giulia: makeBookEntry({ visits: 6, birthday: 20 }) },
        quest: { kind: "happy", giver: "school", target: 10, progress: 2, deadlineDay: 22, reward: 30, xp: 40 },
      });
    expect(happeningsToday(busy("normal"))).toBe(3);
    expect(isDayFull(busy("normal"))).toBe(true);
    expect(isDayFull(busy("hard"))).toBe(false);
    expect(isDayFull(busy("hardcore"))).toBe(false);
    expect(DIFFICULTY_RULES.hardcore.maxHappenings).toBe(Infinity);
  });

  it("take away in the morning what the new level doesn't have (the wedding with its banquet), not during service", () => {
    const morning = makeState({ day: 20, event: "fridgeFailure", spoilingIngredient: "mozza" });
    expect(play(morning, { type: "setDifficulty", difficulty: "gentle" })).toMatchObject({ event: null, spoilingIngredient: null });
    const wedding = makeState({ day: 20, event: "wedding", quest: { kind: "batch", giver: "wedding", target: 8, progress: 0, deadlineDay: 20, reward: 0, xp: 40, items: [] } });
    expect(play(wedding, { type: "setDifficulty", difficulty: "gentle" }).quest).toBeNull();
    const running = makeState({ day: 20, competitor: { name: "Da Mario", firstDay: 19, stars: 1 } });
    expect(play(running, { type: "setDifficulty", difficulty: "gentle" }).competitor?.outcome).toBe("stayed");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const open = play(makeState({ day: 20, event: "fridgeFailure", spoilingIngredient: "mozza" }), { type: "openRestaurant" });
    expect(play(open, { type: "setDifficulty", difficulty: "gentle" }).event).toBe("fridgeFailure");
    // Harder in the morning: today stays as it was.
    expect(play(makeState({ day: 20, event: "rain" }), { type: "setDifficulty", difficulty: "hardcore" }).event).toBe("rain");
  });

  it("come from the switches of older saves: everything off was gentle, anything else normal", () => {
    const base = toJson(makeState());
    const { difficulty: _level, ...settings } = base.settings as Record<string, unknown>;
    const calm = { ...base, version: 12, settings: { ...settings, offEvents: [...DAY_EVENT_IDS], offFeatures: ["rush", "groupOrders", "asUsual", "specialRequests", "quests", "competitor"] } };
    expect(hydrateState(calm).settings.difficulty).toBe("gentle");
    expect(migrateSave(calm).settings).not.toHaveProperty("offEvents");
    const some = { ...calm, settings: { ...settings, offEvents: ["rain"], offFeatures: [] } };
    expect(hydrateState(some).settings.difficulty).toBe("normal");
    expect(hydrateState({ ...calm, settings }).settings.difficulty).toBe("normal");
  });

  it("play out gentle for weeks: only kind events, no group order, rush nor competitor", () => {
    const random = seededRandom(31);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = play(lateGame(), { type: "setDifficulty", difficulty: "gentle" });
    let days = 0;
    playDays(start, {
      days: 30,
      style: "careful",
      random,
      afterDay: ({ state }) => {
        const event = state.summary?.event ?? null;
        if (event) expect(["market", "rain", "sunny"]).toContain(event);
        expect(state.quest?.kind).not.toBe("batch");
        expect(state.competitor ?? null).toBeNull();
        days += 1;
      },
    });
    expect(days).toBe(30);
  }, 120_000);
});
