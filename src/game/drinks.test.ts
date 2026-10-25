import { describe, it, expect, vi, afterEach } from "vitest";
import { play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { customerForPizza, isStuck } from "./service";
import { TRAY_SIZE } from "../data/drinks";
import type { Customer, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const serveMargherita = (state: GameState): GameState => {
  const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
};

// A pizzeria with the full bar (all four drinks) and some money for the glasses.
const withBar = (customers: Customer[], overrides: Partial<GameState> = {}): GameState => {
  const state = stateInService(customers, { money: 10, ...overrides });
  state.upgrades.bar = 2;
  return state;
};

describe("drinks", () => {
  it("go straight to the selected customer when it is their drink: the glass is paid, then the drink", () => {
    const state = play(withBar([makeCustomer({ drink: "vin" })]), { type: "pourDrink", drinkId: "vin" });
    expect(serviceOf(state).customers[0].drinkServed).toBe(true);
    expect(state.money).toBe(10 - 1.5 + 4.5);
    expect(serviceOf(state).stats.drinks).toBe(4.5);
    expect(state.lifetime.drinksSold).toBe(1);
    expect(serviceOf(state).tray ?? []).toEqual([]);
  });

  it("land on the tray when poured for nobody selected, and go from there to whoever ordered them", () => {
    let state = withBar([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé", drink: "eau" })]);
    state = play(state, { type: "pourDrink", drinkId: "eau" });
    expect(serviceOf(state).tray).toEqual(["eau"]);
    expect(state.money).toBe(9.5);
    state = play(state, { type: "serveTrayDrink", index: 0 });
    expect(serviceOf(state).customers[1].drinkServed).toBe(true);
    expect(serviceOf(state).tray).toEqual([]);
    expect(state.money).toBe(11.5);
  });

  it("poured wrong, stay on the tray and cost the glass", () => {
    let state = play(withBar([makeCustomer({ drink: "vin" })]), { type: "pourDrink", drinkId: "chinotto" });
    expect(serviceOf(state).customers[0].drinkServed).toBeFalsy();
    expect(serviceOf(state).tray).toEqual(["chinotto"]);
    state = play(state, { type: "serveTrayDrink", index: 0 });
    expect(state.toasts.at(-1)?.key).toBe("nobodyWantsDrink");
    expect(serviceOf(state).tray).toEqual(["chinotto"]);
    state = play(state, { type: "binTray" });
    expect(serviceOf(state).tray).toEqual([]);
    expect(state.money).toBe(9);
  });

  it("can't pile up past a full tray", () => {
    let state = withBar([makeCustomer()]);
    state = play(state, ...Array.from({ length: TRAY_SIZE + 1 }, () => ({ type: "pourDrink", drinkId: "eau" }) as const));
    expect(serviceOf(state).tray).toHaveLength(TRAY_SIZE);
    expect(state.toasts.at(-1)?.key).toBe("trayFull");
    expect(state.money).toBe(10 - TRAY_SIZE * 0.5);
  });

  it("need the till to cover the glass, and the bar level for the drink", () => {
    expect(play(withBar([makeCustomer({ drink: "vin" })], { money: 1 }), { type: "pourDrink", drinkId: "vin" }).toasts.at(-1)?.key).toBe("notEnoughMoney");
    const smallBar = withBar([makeCustomer({ drink: "vin" })]);
    smallBar.upgrades.bar = 1;
    expect(serviceOf(play(smallBar, { type: "pourDrink", drinkId: "vin" })).customers[0].drinkServed).toBeFalsy();
  });

  it("keep the customer at the counter after the pizza, until the drink comes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = withBar([makeCustomer({ drink: "vin" }), makeCustomer({ id: "c2", name: "Zoé" })], { money: 0 });
    state = serveMargherita(state);
    expect(serviceOf(state).customers[0]).toMatchObject({ id: "cust-1", pizzaServed: true });
    // The next order to work on is the one still waiting for a pizza.
    expect(serviceOf(state).selectedCustomerId).toBe("c2");
    state = play(state, { type: "selectCustomer", customerId: "cust-1" }, { type: "pourDrink", drinkId: "vin" });
    expect(serviceOf(state).customers.map((customer) => customer.id)).toEqual(["c2"]);
    expect(state.money).toBe(7 - 1.5 + 4.5);
  });

  it("let them go with the pizza when the drink came first", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = withBar([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé" })]);
    state = play(state, { type: "pourDrink", drinkId: "eau" });
    state = serveMargherita(state);
    expect(serviceOf(state).customers.map((customer) => customer.id)).toEqual(["c2"]);
  });

  it("end the day once the last drink is served", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = serveMargherita(withBar([makeCustomer({ drink: "limonade" })]));
    expect(state.phase).toBe("service");
    state = play(state, { type: "pourDrink", drinkId: "limonade" });
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
    const before = play(withBar([makeCustomer({ drink: "vin" })], { customerBook: regulars }), { type: "offerDrink" });
    expect(serviceOf(before).customers[0].drinkOffered).toBe(true);
    // The glass is on the house, but it still costs the pizzeria.
    expect(before.money).toBe(8.5);
    const after = serveMargherita(withBar([makeCustomer({ drink: "vin" }), makeCustomer({ id: "c2", name: "Zoé" })], { customerBook: regulars }));
    serviceOf(after).selectedCustomerId = "cust-1";
    expect(serviceOf(play(after, { type: "offerDrink" })).customers[0].drinkOffered).toBeFalsy();
  });

  describe("with the barman", () => {
    const withBarman = (customers: Parameters<typeof stateInService>[0]) => {
      const state = stateInService(customers, { money: 5 });
      state.upgrades.bar = 3;
      // The steady barman of older saves: one drink every 6 seconds, never wrong.
      state.barman = { name: "Lior" };
      // Enough for a glass poured by hand; the barman's are paid out of what they bring in.
      return state;
    };

    it("go out on their own, one at a time, in queue order", () => {
      let state = withBarman([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé", drink: "limonade" })]);
      state = play(state, { type: "tick", seconds: 5 });
      expect(serviceOf(state).customers.every((customer) => !customer.drinkServed)).toBe(true);
      state = play(state, { type: "tick", seconds: 1 });
      expect(serviceOf(state).customers.map((customer) => Boolean(customer.drinkServed))).toEqual([true, false]);
      expect(state.money).toBe(5 + 2 - 0.5);
      state = play(state, { type: "tick", seconds: 6 });
      expect(serviceOf(state).customers[1].drinkServed).toBe(true);
      expect(state.lifetime.drinksSold).toBe(2);
    });

    it("start over on the next drink when one is served by hand", () => {
      let state = withBarman([makeCustomer({ drink: "eau" }), makeCustomer({ id: "c2", name: "Zoé", drink: "limonade" })]);
      state = play(state, { type: "tick", seconds: 4 }, { type: "pourDrink", drinkId: "eau" }, { type: "tick", seconds: 4 });
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
