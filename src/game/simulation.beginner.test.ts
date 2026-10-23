// Robots starting from nothing: a brand-new pizzeria played for a month, and a broke one that has to lean on Nonna.
import { describe, it, expect, vi, afterEach } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { seededRandom } from "../utils/random";
import { makeState } from "../test/helpers";
import { playDays } from "../test/robot";
import { levelForXp } from "./progression";

afterEach(() => vi.restoreAllMocks());

const unlockedCount = (unlocked: Record<string, boolean>) => Object.values(unlocked).filter(Boolean).length;
const upgradeLevels = (upgrades: Record<string, number>) => Object.values(upgrades).reduce((total, level) => total + level, 0);

describe("a careful robot opening a brand-new pizzeria", () => {
  it("plays its first month: the tutorial, then suppliers, upgrades, a longer menu, events and quests as they come", () => {
    const random = seededRandom(424242);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = makeState();
    expect(start.settings.tutorialDone).toBe(false);
    let eventsSeen = 0;
    const end = playDays(start, {
      days: 30,
      style: "careful",
      random,
      afterDay: (report) => {
        if (report.state.summary?.event) eventsSeen += 1;
      },
    });
    expect(end.day).toBe(31);
    expect(end.settings.tutorialDone).toBe(true);
    expect(end.history).toHaveLength(30);
    expect(levelForXp(end.xp)).toBeGreaterThan(levelForXp(start.xp));
    expect(upgradeLevels(end.upgrades)).toBeGreaterThan(upgradeLevels(start.upgrades));
    expect(unlockedCount(end.unlocked)).toBeGreaterThan(unlockedCount(start.unlocked));
    expect(eventsSeen).toBeGreaterThan(3);
  }, 120_000);
});

describe("a broke pizzeria", () => {
  it("never gets stuck: with no money and an empty fridge, Nonna gets it going again", () => {
    const random = seededRandom(777);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = makeState({ day: 5, money: 0, xp: 600 });
    start.settings.tutorialDone = true;
    INGREDIENTS.forEach(({ id }) => (start.stock[id] = 0));
    const end = playDays(start, { days: 10, style: "careful", random });
    expect(end.day).toBe(15);
    expect(end.lastNonnaVisitDay).toBeGreaterThan(0);
    expect(end.lifetime.served).toBeGreaterThan(0);
  }, 120_000);
});
