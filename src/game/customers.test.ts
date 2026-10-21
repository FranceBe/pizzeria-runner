import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState } from "../test/helpers";
import { createCustomer as tryCreateCustomer, moodForWait, EXTRA_TOPPING_SURCHARGE } from "./customers";
import type { Customer, GameState } from "./types";

const createCustomer = (state: GameState): Customer => {
  const customer = tryCreateCustomer(state);
  if (!customer) throw new Error("Expected a customer");
  return customer;
};

afterEach(() => vi.restoreAllMocks());

describe("createCustomer", () => {
  it("orders something from the menu", () => {
    const customer = createCustomer(makeState());
    expect(customer.recipeId).toBe("margherita");
    expect(customer.ingredients).toEqual(["pate", "tomate", "mozza", "basilic"]);
    expect(customer.price).toBe(7);
    expect(customer.waitedSeconds).toBe(0);
  });

  it("returns null when the menu is empty", () => {
    const state = makeState();
    state.recipes[0].onMenu = false;
    expect(tryCreateCustomer(state)).toBeNull();
  });

  it("never makes special requests before level 3", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const customer = createCustomer(makeState({ xp: 0 }));
    expect(customer.extraIngredient).toBeNull();
    expect(customer.removedIngredient).toBeNull();
  });

  it("can ask for an extra topping at level 3, and pays for it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = makeState({ xp: 200, unlocked: { pate: true, tomate: true, mozza: true, basilic: true, origan: true } });
    const customer = createCustomer(state);
    expect(customer.extraIngredient).toBe("origan");
    expect(customer.ingredients).toContain("origan");
    expect(customer.price).toBe(7 + EXTRA_TOPPING_SURCHARGE);
  });
});

describe("moodForWait", () => {
  it("gets grumpier the longer they wait", () => {
    expect(moodForWait(0)).toBe(0);
    expect(moodForWait(30)).toBe(1);
    expect(moodForWait(60)).toBe(2);
    expect(moodForWait(500)).toBe(3);
  });
});
