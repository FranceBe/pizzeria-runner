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

  it("go to the customer whose ticket was tapped", () => {
    const state = play(
      stateInService([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé", drink: "eau", pizzaServed: true })]),
      { type: "serveDrink", drinkId: "eau", customerId: "c2" },
    );
    expect(serviceOf(state).customers.map((customer) => customer.id)).toEqual(["cust-1"]);
    expect(serviceOf(state).customers[0].drinkServed).toBeFalsy();
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

  describe("with the barman", () => {
    const withBarman = (customers: Parameters<typeof stateInService>[0]) => {
      const state = stateInService(customers, { money: 0 });
      state.upgrades.bar = 3;
      return state;
    };

    it("go out on their own, one at a time, in queue order", () => {
      let state = withBarman([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé", drink: "limonade" })]);
      state = play(state, { type: "tick", seconds: 5 });
      expect(serviceOf(state).customers.every((customer) => !customer.drinkServed)).toBe(true);
      state = play(state, { type: "tick", seconds: 1 });
      expect(serviceOf(state).customers.map((customer) => Boolean(customer.drinkServed))).toEqual([true, false]);
      expect(state.money).toBe(2);
      state = play(state, { type: "tick", seconds: 6 });
      expect(serviceOf(state).customers[1].drinkServed).toBe(true);
      expect(state.lifetime.drinksSold).toBe(2);
    });

    it("start over on the next drink when one is served by hand", () => {
      let state = withBarman([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé", drink: "limonade" })]);
      state = play(state, { type: "tick", seconds: 4 }, { type: "serveDrink", drinkId: "eau" }, { type: "tick", seconds: 4 });
      expect(serviceOf(state).customers[1].drinkServed).toBeFalsy();
      state = play(state, { type: "tick", seconds: 2 });
      expect(serviceOf(state).customers[1].drinkServed).toBe(true);
    });

    it("let a customer who only waited for their drink leave, and close the day", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const state = withBarman([makeCustomer({ drink: "vin" })]);
      // Held back while the pizza bakes, so the drink comes after it.
      serviceOf(state).barmanSeconds = -100;
      let served = serveMargherita(state);
      expect(served.phase).toBe("service");
      served = play(served, { type: "tick", seconds: 106 });
      expect(served.phase).toBe("summary");
    });

    it("don't work below bar level 3", () => {
      const state = play(stateInService([makeCustomer({ drink: "eau" })]), { type: "tick", seconds: 20 });
      expect(serviceOf(state).customers[0].drinkServed).toBeFalsy();
    });
  });
});
