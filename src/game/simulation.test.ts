// Robots play many full days with every feature on, to catch what only shows up when everything mixes (see
// test/robot.ts for how they play and what is checked all along). More set-ups in the other simulation.*.test.ts.
import { describe, it, expect, vi, afterEach } from "vitest";
import { seededRandom } from "../utils/random";
import { DATES, lateGame } from "../test/fixtures";
import { playDays } from "../test/robot";

afterEach(() => vi.restoreAllMocks());

describe("a careful robot running a big pizzeria", () => {
  it("plays 25 days with every upgrade, festivals coming and going, and never breaks the game", () => {
    const random = seededRandom(20261018);
    vi.spyOn(Math, "random").mockImplementation(random);
    const end = playDays(lateGame(), { days: 25, style: "careful", random, dates: DATES });
    expect(end.day).toBe(3 + 25);
    expect(end.lifetime.served).toBeGreaterThan(25 * 5);
    expect(end.history).toHaveLength(25);
    // Tonight's goals came up and were settled, every day.
    expect(end.tonightGoal?.day).toBe(end.day);
  }, 120_000);
});
