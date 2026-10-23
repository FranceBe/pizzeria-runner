// A sloppy robot: wrong pizzas, binned boards, random toppings, pauses, the secrets toggled for nothing, a reload in
// the middle of the evening, a day started over. The game must take all of it.
import { describe, it, expect, vi, afterEach } from "vitest";
import { seededRandom } from "../utils/random";
import { makeState } from "../test/helpers";
import { playDays } from "../test/robot";
import { DATES, lateGame } from "../test/fixtures";

afterEach(() => vi.restoreAllMocks());

describe("a sloppy robot", () => {
  it("running a big pizzeria for 20 days", () => {
    const random = seededRandom(9001);
    vi.spyOn(Math, "random").mockImplementation(random);
    let wasted = 0;
    const end = playDays(lateGame(), {
      days: 20,
      style: "sloppy",
      random,
      dates: DATES,
      afterDay: ({ state }) => (wasted += state.summary?.waste ?? 0),
    });
    expect(end.day).toBe(23);
    expect(wasted).toBeGreaterThan(0);
  }, 120_000);

  it("starting from scratch", () => {
    const random = seededRandom(31337);
    vi.spyOn(Math, "random").mockImplementation(random);
    const end = playDays(makeState(), { days: 15, style: "sloppy", random });
    expect(end.day).toBe(16);
    expect(end.history.length).toBeGreaterThan(0);
  }, 120_000);
});
