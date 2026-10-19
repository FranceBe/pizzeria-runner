import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, MARGHERITA_INGREDIENTS } from "../test/helpers";
import { CUSTOMER_NAMES } from "../data/customers";
import { ensureLocals, lapseAbsentRegulars, LAPSE_DAYS, LOCALS_COUNT, pickCustomerName, recordVisit, regularsOf, favoriteRecipeId, REGULAR_SAME_ORDERS } from "./regulars";
import { createCustomer, tipChance } from "./customers";

afterEach(() => vi.restoreAllMocks());

describe("customer book", () => {
  it("makes a regular of someone who ordered the same pizza three times, and announces it", () => {
    const state = makeState();
    const luca = makeCustomer();
    expect(recordVisit(state, luca)).toBe(false);
    expect(recordVisit(state, luca)).toBe(false);
    expect(recordVisit(state, luca)).toBe(true);
    expect(state.customerBook.Luca).toMatchObject({ visits: 3, orders: { margherita: REGULAR_SAME_ORDERS }, skin: luca.skin });
    expect(state.customerBook.Luca?.birthday).toBeDefined();
    expect(regularsOf(state).map((regular) => regular.name)).toEqual(["Luca"]);
  });

  it("doesn't count visits for different pizzas: a regular has a usual", () => {
    const state = makeState();
    (["margherita", "regina", "diavola", "marinara", "margherita"] as const).forEach((recipeId) => recordVisit(state, makeCustomer({ recipeId })));
    expect(state.customerBook.Luca?.visits).toBe(5);
    expect(regularsOf(state)).toHaveLength(0);
    expect(recordVisit(state, makeCustomer())).toBe(true);
  });

  it("loses sight of a regular who stays away too long, until they come back", () => {
    const state = makeState({ day: 3 });
    state.customerBook.Luca = makeBookEntry({ visits: 4, lastVisit: 3 });
    // An older save without dates starts counting today.
    state.customerBook.Sofia = makeBookEntry({ visits: 4 });
    state.day = 3 + LAPSE_DAYS;
    lapseAbsentRegulars(state);
    expect(regularsOf(state).map((regular) => regular.name).sort()).toEqual(["Luca", "Sofia"]);
    state.day += 1;
    lapseAbsentRegulars(state);
    expect(regularsOf(state).map((regular) => regular.name)).toEqual(["Sofia"]);
    // Back again: a regular at once, without a "new regular" toast.
    expect(recordVisit(state, makeCustomer())).toBe(false);
    expect(regularsOf(state).map((regular) => regular.name).sort()).toEqual(["Luca", "Sofia"]);
    expect(state.customerBook.Luca?.lastVisit).toBe(state.day);
  });

  it("knows each customer's favourite", () => {
    expect(favoriteRecipeId(makeBookEntry({ orders: { margherita: 1, regina: 3 } }))).toBe("regina");
    expect(favoriteRecipeId(undefined)).toBeNull();
  });

  it("brings returning customers back with their look and favourite pizza", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // first name in the list ("Giulia"), and reorders the favourite
    const state = makeState({ locals: ["Giulia"] });
    state.customerBook.Giulia = { skin: "#123456", hair: "#654321", hairStyle: 2, visits: 4, orders: { margherita: 4 } };
    expect(createCustomer(state)).toMatchObject({ name: "Giulia", skin: "#123456", hairStyle: 2, visitNumber: 5, recipeId: "margherita" });
  });

  it("has a neighbourhood: a few locals who come most of the time, the most loyal faces first", () => {
    const state = makeState();
    state.customerBook.Tom = makeBookEntry({ visits: 9 });
    state.customerBook.Ada = makeBookEntry({ visits: 2 });
    ensureLocals(state, CUSTOMER_NAMES);
    expect(state.locals).toHaveLength(LOCALS_COUNT);
    expect(state.locals.slice(0, 2)).toEqual(["Tom", "Ada"]);
    expect(new Set(state.locals).size).toBe(LOCALS_COUNT);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(state.locals).toContain(pickCustomerName(state, CUSTOMER_NAMES, new Set()));
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(state.locals).not.toContain(pickCustomerName(state, CUSTOMER_NAMES, new Set()));
    // Everyone from the neighbourhood already at the counter: someone passing by.
    expect(state.locals).not.toContain(pickCustomerName(state, CUSTOMER_NAMES, new Set(state.locals)));
  });

  it("never seats two customers with the same name at once", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = stateInService([makeCustomer({ name: "Giulia" })]);
    expect(createCustomer(state)?.name).not.toBe("Giulia");
  });

  it("is updated when serving, and pops a toast for a new regular", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const start = stateInService([makeCustomer()]);
    start.customerBook.Luca = { skin: "#fff", hair: "#000", hairStyle: 0, visits: 4, orders: { margherita: 2, regina: 2 } };
    let state = play(start, ...toggle(...MARGHERITA_INGREDIENTS), { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[0].id });
    expect(state.customerBook.Luca?.visits).toBe(5);
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
    state.customerBook.Luca = makeBookEntry({ visits: REGULAR_SAME_ORDERS });
    expect(tipChance(state, makeCustomer({ waitedSeconds: 120 }))).toBeCloseTo(0.4);
  });
});
