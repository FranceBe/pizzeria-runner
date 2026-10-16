import { describe, it, expect } from "vitest";
import {
  sortByLayer, haveSameIngredients, ingredientCost, fairPrice, adjustPrice, findPairings,
  appealOf, appealToStars, priceAttractiveness, priceLevel, MIN_PRICE, MAX_PRICE,
} from "./pizza.js";

describe("sortByLayer", () => {
  it("puts dough, then sauce, then cheese, then toppings", () => {
    expect(sortByLayer(["basilic", "mozza", "pate", "tomate"])).toEqual(["pate", "tomate", "mozza", "basilic"]);
  });

  it("does not mutate its input", () => {
    const input = ["basilic", "pate"];
    sortByLayer(input);
    expect(input).toEqual(["basilic", "pate"]);
  });
});

describe("haveSameIngredients", () => {
  it("ignores order", () => {
    expect(haveSameIngredients(["pate", "tomate"], ["tomate", "pate"])).toBe(true);
  });

  it("detects a missing or extra ingredient", () => {
    expect(haveSameIngredients(["pate", "tomate"], ["pate"])).toBe(false);
    expect(haveSameIngredients(["pate", "tomate"], ["pate", "mozza"])).toBe(false);
  });
});

describe("prices", () => {
  it("adds up ingredient costs", () => {
    expect(ingredientCost(["pate", "tomate", "mozza", "basilic"])).toBeCloseTo(2.1);
  });

  it("suggests a fair price rounded to 50 cents", () => {
    // 3.5 + 1.6 * 2.1 = 6.86 -> 7
    expect(fairPrice(["pate", "tomate", "mozza", "basilic"])).toBe(7);
  });

  it("keeps adjusted prices within bounds", () => {
    expect(adjustPrice(MIN_PRICE, -0.5)).toBe(MIN_PRICE);
    expect(adjustPrice(MAX_PRICE, 0.5)).toBe(MAX_PRICE);
    expect(adjustPrice(7, 0.5)).toBe(7.5);
  });

  it("rewards cheap prices a little and punishes expensive ones a lot", () => {
    expect(priceAttractiveness(10, 10)).toBe(1);
    expect(priceAttractiveness(5, 10)).toBeCloseTo(1.3);
    expect(priceAttractiveness(12, 10)).toBeCloseTo(0.6);
    expect(priceAttractiveness(100, 10)).toBe(0.1);
  });

  it("rates the price level", () => {
    expect(priceLevel(8, 10)).toBe("gentle");
    expect(priceLevel(10, 10)).toBe("fair");
    expect(priceLevel(12, 10)).toBe("high");
    expect(priceLevel(20, 10)).toBe("tooHigh");
  });
});

describe("findPairings", () => {
  it("finds good and bad pairings present in the recipe", () => {
    const { good, bad } = findPairings(["pate", "tomate", "basilic", "miel", "anchois"]);
    expect(good).toContainEqual(["tomate", "basilic"]);
    expect(bad).toContainEqual(["miel", "anchois"]);
  });
});

describe("appealOf", () => {
  it("rates a margherita well, and better as a classic", () => {
    const margherita = ["pate", "tomate", "mozza", "basilic"];
    expect(appealOf(margherita, true)).toBeGreaterThan(appealOf(margherita, false));
    expect(appealToStars(appealOf(margherita, true))).toBeGreaterThanOrEqual(3);
  });

  it("penalises a pizza with no sauce and no cheese", () => {
    expect(appealOf(["pate", "basilic"], false)).toBeLessThan(appealOf(["pate", "tomate", "mozza", "basilic"], false));
  });

  it("stays within its bounds", () => {
    const clashing = ["pate", "miel", "anchois", "capres", "oeuf", "truffe", "piment", "salami"];
    expect(appealOf(clashing, false)).toBeGreaterThanOrEqual(0.3);
  });
});

describe("appealToStars", () => {
  it("maps the appeal range to 1–5 stars", () => {
    expect(appealToStars(0.3)).toBe(1);
    expect(appealToStars(1.6)).toBe(5);
  });
});
