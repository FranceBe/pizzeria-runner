import { describe, it, expect } from "vitest";
import { makeState } from "../test/helpers";
import { dailyCharges, forecastCustomers, restockPlan, receivePayment, payCharges } from "./economy";

describe("dailyCharges", () => {
  it("is 6 € with no upgrades", () => {
    expect(dailyCharges(makeState())).toBe(6);
  });

  it("grows with each upgrade level", () => {
    const state = makeState({ upgrades: { oven: 1, salle: 2, deco: 0, commis: 1, terrasse: 0, livraison: 0 } });
    expect(dailyCharges(state)).toBe(6 + 2 + 6 + 5);
  });
});

describe("forecastCustomers", () => {
  it("expects nobody when the menu is empty", () => {
    const state = makeState();
    state.recipes[0].onMenu = false;
    expect(forecastCustomers(state)).toBe(0);
  });

  it("expects a handful of customers on day one", () => {
    expect(forecastCustomers(makeState())).toBe(6);
  });

  it("expects more customers with a bigger room", () => {
    const small = forecastCustomers(makeState());
    const big = forecastCustomers(makeState({ upgrades: { oven: 0, salle: 2, deco: 0, commis: 0, terrasse: 0, livraison: 0 } }));
    expect(big).toBeGreaterThan(small);
  });
});

describe("restockPlan", () => {
  it("tops up only the ingredients used on the menu", () => {
    const state = makeState({ stock: { pate: 8, tomate: 10, mozza: 0, basilic: 8, origan: 0 } });
    const plan = restockPlan(state, 10);
    expect(plan.items).toEqual([{ id: "pate", quantity: 2 }, { id: "mozza", quantity: 10 }, { id: "basilic", quantity: 2 }]);
    expect(plan.cost).toBeCloseTo(2 * 0.6 + 10 * 0.9 + 2 * 0.2);
  });
});

describe("receivePayment", () => {
  it("puts everything in the till when there is no debt", () => {
    const state = makeState({ money: 10 });
    receivePayment(state, 8);
    expect(state.money).toBe(18);
  });

  it("uses half the payment to pay down debt", () => {
    const state = makeState({ money: 0, debt: 10 });
    receivePayment(state, 8);
    expect(state.debt).toBe(6);
    expect(state.money).toBe(4);
  });
});

describe("payCharges", () => {
  it("puts what the till can't cover on the debt", () => {
    const state = makeState({ money: 4, debt: 0 });
    payCharges(state, 6);
    expect(state.money).toBe(0);
    expect(state.debt).toBe(2);
  });
});
