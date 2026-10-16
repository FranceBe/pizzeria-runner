import { describe, it, expect } from "vitest";
import { levelForXp, levelProgressPercent, menuCapacity, MAX_LEVEL } from "./progression";

describe("levelForXp", () => {
  it("starts at level 1", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(69)).toBe(1);
  });

  it("levels up exactly at each threshold", () => {
    expect(levelForXp(70)).toBe(2);
    expect(levelForXp(200)).toBe(3);
  });

  it("caps at the last level", () => {
    expect(levelForXp(1_000_000)).toBe(MAX_LEVEL);
  });
});

describe("levelProgressPercent", () => {
  it("measures progress inside the current level", () => {
    expect(levelProgressPercent(0)).toBe(0);
    expect(levelProgressPercent(35)).toBe(50);
  });

  it("shows a full bar at max level", () => {
    expect(levelProgressPercent(1_000_000)).toBe(100);
  });
});

describe("menuCapacity", () => {
  it("grows with level up to 12", () => {
    expect(menuCapacity(1)).toBe(4);
    expect(menuCapacity(20)).toBe(12);
  });
});
