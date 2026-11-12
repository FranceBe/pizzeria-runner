import { describe, it, expect } from "vitest";
import { advance, cookCapacity, frozenRate, isForSale, newFactory, readFactory, tick } from "../engine";
import { buildDevFactory, DEV_PRESET_IDS, DEV_PRESETS, devSetupOf } from "./devFactory";
import { seededRandom } from "../../utils/random";

describe("the dev tab's games", () => {
  it("start each preset in its era, playable and loadable", () => {
    DEV_PRESET_IDS.forEach((id) => {
      const state = buildDevFactory(DEV_PRESETS[id]);
      expect(state.era).toBe(DEV_PRESETS[id].era);
      expect(readFactory(JSON.parse(JSON.stringify(state)))).toEqual(state);
      expect(tick(state, 1, seededRandom(1)).seconds).toBe(1);
    });
  });

  it("come with what their era needs, and the automations owned switched on", () => {
    const start = buildDevFactory(DEV_PRESETS.era3Start);
    expect(start.upgrades).toEqual(expect.arrayContaining(["franchise", "factoryPlans", "manager", "pricingAnalyst"]));
    expect(start.autoHire && start.autoPrice && start.autoBuy).toBe(true);
    expect(start.upgrades).not.toContain("spacePlans");
    expect(frozenRate(advance(start, 30, seededRandom(1)))).toBe(0);
    // A balanced plant: two factories flat out within a minute.
    expect(frozenRate(advance(buildDevFactory(DEV_PRESETS.era3Running), 60, seededRandom(1)))).toBeGreaterThan(5500);
    expect(isForSale(buildDevFactory(DEV_PRESETS.era3Late), "spacePlans")).toBe(false);
  });

  it("keep things consistent whatever is typed: cooks fit, no buildings or research before era 3, no negatives", () => {
    const odd = buildDevFactory({ ...DEV_PRESETS.era2Start, era: 1, cooks: 500, research: 900, researched: ["calculator"], money: -50, restaurants: 40, buildings: { ...DEV_PRESETS.era3Running.buildings } });
    expect(odd.cooks).toBe(cookCapacity(odd));
    expect(odd.restaurants).toBe(1);
    expect(odd.research).toBe(0);
    expect(odd.researched).toEqual([]);
    expect(Object.values(odd.buildings).every((count) => count === 0)).toBe(true);
    expect(odd.money).toBe(0);
    expect(odd.upgrades).not.toContain("franchise");
  });

  it("read back a game's own setup", () => {
    const state = buildDevFactory(DEV_PRESETS.era3Running);
    expect(buildDevFactory(devSetupOf(state))).toEqual(state);
    expect(devSetupOf(newFactory()).era).toBe(1);
  });
});
