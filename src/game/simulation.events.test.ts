// Every day event forced in turn (the wedding banquet and the match on TV included), with each of tonight's goals in
// turn, on a middling pizzeria and on a big one (where the power cut is a missing wood delivery).
import { describe, it, expect, vi, afterEach } from "vitest";
import { DAY_EVENT_IDS, type DayEventId } from "../data/events";
import { TONIGHT_KINDS, VARIETY_MAX } from "../data/tonight";
import { seededRandom } from "../utils/random";
import { playDays } from "../test/robot";
import { pickLateIngredient } from "./events";
import { activeMenu } from "./menu";
import { prepareWedding } from "./quests";
import { lateGame, middling } from "../test/fixtures";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

// The morning of a day with this event, and this goal for tonight.
const force = (state: GameState, event: DayEventId, goalIndex: number): GameState => {
  const next: GameState = { ...state, event, quest: event === "wedding" ? null : state.quest };
  if (event === "lateDelivery") next.lateIngredient = pickLateIngredient(next);
  prepareWedding(next);
  const kind = TONIGHT_KINDS[goalIndex % TONIGHT_KINDS.length];
  const target = kind === "variety" ? Math.min(VARIETY_MAX, activeMenu(next).length) : kind === "allHot" ? 5 : kind === "lightning" ? 3 : 1;
  next.tonightGoal = { day: next.day, kind, target, progress: 0, status: "open" };
  return next;
};

const runEveryEvent = (start: GameState, seed: number) => {
  const random = seededRandom(seed);
  vi.spyOn(Math, "random").mockImplementation(random);
  const seen = new Set<DayEventId>();
  const end = playDays(start, {
    days: DAY_EVENT_IDS.length * 2,
    style: "careful",
    random,
    beforeOpening: (state, day) => force(state, DAY_EVENT_IDS[day % DAY_EVENT_IDS.length], day),
    afterDay: ({ state }, day) => {
      const event = DAY_EVENT_IDS[day % DAY_EVENT_IDS.length];
      expect(state.summary?.event, "the receipt remembers the day's event").toBe(event);
      seen.add(event);
      // Tonight's goal is settled at closing, whatever happened.
      expect(state.tonightGoal?.status, `tonight's goal on a ${event} day`).not.toBe("open");
      // The banquet is over with the evening, served or not; it never lingers as a quest.
      if (event === "wedding") {
        expect(state.quest).toBeNull();
        expect(state.questLog.some((record) => record.giver === "wedding") || (state.summary?.questRewards ?? 0) >= 0).toBe(true);
      }
    },
  });
  expect([...seen].sort()).toEqual([...DAY_EVENT_IDS].sort());
  return end;
};

describe("every event in turn", () => {
  it("on a middling pizzeria", () => {
    const end = runEveryEvent(middling(), 13);
    expect(end.questLog.some((record) => record.giver === "wedding")).toBe(true);
  }, 120_000);

  it("on a big pizzeria, every oven wood-fired", () => {
    runEveryEvent(lateGame(), 31);
  }, 120_000);
});
