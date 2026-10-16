import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, MARGHERITA_INGREDIENTS } from "../test/helpers";
import { recordVisit, regularsOf, favoriteRecipeId, REGULAR_VISITS } from "./regulars";
import { createCustomer, tipChance } from "./customers";

afterEach(() => vi.restoreAllMocks());

describe("customer book", () => {
  it("counts visits and announces new regulars", () => {
    const state = makeState();
    const luca = makeCustomer();
    expect(recordVisit(state, luca)).toBe(false);
    expect(recordVisit(state, luca)).toBe(false);
    expect(recordVisit(state, luca)).toBe(true);
    expect(state.customerBook.Luca).toMatchObject({ visits: REGULAR_VISITS, orders: { margherita: 3 }, skin: luca.skin });
    expect(regularsOf(state).map((regular) => regular.name)).toEqual(["Luca"]);
  });

  it("knows each customer's favourite", () => {
    expect(favoriteRecipeId(makeBookEntry({ orders: { margherita: 1, regina: 3 } }))).toBe("regina");
    expect(favoriteRecipeId(undefined)).toBeNull();
  });

  it("brings returning customers back with their look and favourite pizza", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // first name in the list ("Luca"), and reorders the favourite
    const state = makeState();
    state.customerBook.Luca = { skin: "#123456", hair: "#654321", hairStyle: 2, visits: 4, orders: { margherita: 4 } };
    expect(createCustomer(state)).toMatchObject({ name: "Luca", skin: "#123456", hairStyle: 2, visitNumber: 5, recipeId: "margherita" });
  });

  it("never seats two customers with the same name at once", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = stateInService([makeCustomer({ name: "Luca" })]);
    expect(createCustomer(state)?.name).not.toBe("Luca");
  });

  it("is updated when serving, and pops a toast for a new regular", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const start = stateInService([makeCustomer()]);
    start.customerBook.Luca = { skin: "#fff", hair: "#000", hairStyle: 0, visits: 2, orders: { margherita: 2 } };
    let state = play(start, ...toggle(...MARGHERITA_INGREDIENTS), { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[0].id });
    expect(state.customerBook.Luca?.visits).toBe(3);
    expect(state.toasts.map((toast) => toast.key)).toContain("newRegular");
  });
});

describe("tips", () => {
  it("are more likely when service is quick", () => {
    const state = makeState();
    expect(tipChance(state, makeCustomer({ waitedSeconds: 5 }))).toBeCloseTo(0.5);
    expect(tipChance(state, makeCustomer({ waitedSeconds: 30 }))).toBeCloseTo(0.4);
    expect(tipChance(state, makeCustomer({ waitedSeconds: 120 }))).toBeCloseTo(0.3);
  });

  it("are more likely from regulars", () => {
    const state = makeState();
    state.customerBook.Luca = makeBookEntry({ visits: REGULAR_VISITS });
    expect(tipChance(state, makeCustomer({ waitedSeconds: 120 }))).toBeCloseTo(0.4);
  });
});
