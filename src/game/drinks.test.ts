import { describe, it, expect, vi, afterEach } from "vitest";
import { play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { customerForPizza, isStuck } from "./service";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const serveMargherita = (state: GameState): GameState => {
  const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
};

describe("drinks", () => {
  it("keep the customer at the counter after the pizza, until the drink comes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = stateInService([makeCustomer({ drink: "vin" }), makeCustomer({ id: "c2", name: "Zoé" })], { money: 0 });
    state = serveMargherita(state);
    expect(serviceOf(state).customers[0]).toMatchObject({ id: "cust-1", pizzaServed: true });
    // The next order to work on is the one still waiting for a pizza.
    expect(serviceOf(state).selectedCustomerId).toBe("c2");
    state = play(state, { type: "serveDrink", drinkId: "vin" });
    expect(serviceOf(state).customers.map((customer) => customer.id)).toEqual(["c2"]);
    expect(state.money).toBe(7 + 4.5);
  });

  it("let them go with the pizza when the drink came first", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = stateInService([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé" })]);
    state = play(state, { type: "serveDrink", drinkId: "eau" });
    state = serveMargherita(state);
    expect(serviceOf(state).customers.map((customer) => customer.id)).toEqual(["c2"]);
  });

  it("end the day once the last drink is served", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = serveMargherita(stateInService([makeCustomer({ drink: "limonade" })]));
    expect(state.phase).toBe("service");
    state = play(state, { type: "serveDrink", drinkId: "limonade" });
    expect(state.phase).toBe("summary");
    expect(state.summary?.drinks).toBe(2.5);
  });

  it("never send a second pizza to someone who already had theirs", () => {
    const state = serveMargherita(stateInService([makeCustomer({ drink: "vin" }), makeCustomer({ id: "c2", name: "Zoé", ingredients: ["pate"] })]));
    expect(customerForPizza(serviceOf(state), MARGHERITA)).toBeUndefined();
  });

  it("don't count as stuck: only customers waiting for a pizza do", () => {
    const state = serveMargherita(stateInService([makeCustomer({ drink: "vin" })], { stock: { pate: 9, tomate: 9, mozza: 9, basilic: 9 } }));
    expect(isStuck({ ...state, money: 0 }, serviceOf(state))).toBe(false);
  });

  it("can be offered to a regular only before the pizza, since the gesture shows in its tip", () => {
    const regulars = { Luca: makeBookEntry({ visits: 4 }) };
    const before = play(stateInService([makeCustomer({ drink: "vin" })], { customerBook: regulars }), { type: "offerDrink" });
    expect(serviceOf(before).customers[0].drinkOffered).toBe(true);
    const after = serveMargherita(stateInService([makeCustomer({ drink: "vin" }), makeCustomer({ id: "c2", name: "Zoé" })], { customerBook: regulars }));
    serviceOf(after).selectedCustomerId = "cust-1";
    expect(serviceOf(play(after, { type: "offerDrink" })).customers[0].drinkOffered).toBeFalsy();
  });
});
