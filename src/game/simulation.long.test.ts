// A long game: two months from halfway, mornings saved and loaded back, to see that nothing grows without end.
import { describe, it, expect, vi, afterEach } from "vitest";
import { seededRandom } from "../utils/random";
import { DATES, middling } from "../test/fixtures";
import { playDays } from "../test/robot";
import { toSaveData } from "./state";
import { LOCALS_COUNT, MAX_REGULARS, regularsOf } from "./regulars";
import { PRESS_KEPT, REVIEWS_KEPT } from "./reviews";
import { CELEBRITY_WALL_SIZE } from "./serving";

afterEach(() => vi.restoreAllMocks());

describe("a long game", () => {
  it("plays 60 days from halfway (more than two of the game's years): nothing grows without end, and the save stays small", () => {
    const random = seededRandom(80);
    vi.spyOn(Math, "random").mockImplementation(random);
    const end = playDays(middling(), { days: 60, style: "careful", random, dates: DATES });
    expect(end.day).toBe(6 + 60);
    expect(regularsOf(end).length).toBeLessThanOrEqual(MAX_REGULARS);
    expect(end.locals).toHaveLength(LOCALS_COUNT);
    expect(end.questLog.length).toBeLessThanOrEqual(30);
    expect(end.reviews.length).toBeLessThanOrEqual(REVIEWS_KEPT);
    expect(end.press.length).toBeLessThanOrEqual(PRESS_KEPT);
    expect(end.celebrityWall.length).toBeLessThanOrEqual(CELEBRITY_WALL_SIZE);
    // Regulars' stories came along, and turned pages.
    expect(Object.values(end.customerBook).some((entry) => (entry.story?.chapter ?? 0) > 0)).toBe(true);
    // Browsers keep about 5 MB per site: a save stays far below.
    expect(JSON.stringify(toSaveData(end)).length).toBeLessThan(300_000);
  }, 180_000);
});
