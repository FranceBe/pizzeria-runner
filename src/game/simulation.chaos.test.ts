// A chaotic robot: the sloppy one's mistakes, plus everything nobody should do mid-evening (emptying the menu,
// deleting a recipe, changing language, buying and selling upgrades, buying random stock), and mornings messed up
// before the manager puts them right. The game must survive it all, every day ending with its receipt.
import { describe, it, expect, vi, afterEach } from "vitest";
import { seededRandom } from "../utils/random";
import { DATES, lateGame, middling } from "../test/fixtures";
import { messUpMorning, playDays, runMorning } from "../test/robot";

afterEach(() => vi.restoreAllMocks());

describe("a chaotic robot", () => {
  it.each([
    ["a big pizzeria", lateGame, 101],
    ["a middling pizzeria", middling, 202],
  ] as const)("running %s", (_, start, seed) => {
    const random = seededRandom(seed);
    vi.spyOn(Math, "random").mockImplementation(random);
    const end = playDays(start(), {
      days: 15,
      style: "chaotic",
      random,
      dates: DATES,
      beforeOpening: (state) => runMorning(messUpMorning(state, random), random),
    });
    expect(end.history.length).toBeGreaterThan(0);
  }, 120_000);
});
