import { describe, it, expect, vi, afterEach } from "vitest";
import { gameReducer } from "./reducer";
import { isStuck } from "./service";
import { shortcutAction } from "./shortcuts";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

// The situation that used to end a game: no dough left, and almost nothing in the till.
const brokeWithoutDough = (): GameState =>
  stateInService([makeCustomer()], { money: 0.5, stock: { pate: 0, tomate: 5, mozza: 5, basilic: 5 } });

describe("getting stuck mid-service", () => {
  it("is detected when no waiting order can be made or bought", () => {
    const stuck = brokeWithoutDough();
    expect(isStuck(stuck, serviceOf(stuck))).toBe(true);
    const withMoney = stateInService([makeCustomer()], { money: 5, stock: { pate: 0, tomate: 5, mozza: 5, basilic: 5 } });
    expect(isStuck(withMoney, serviceOf(withMoney))).toBe(false);
    const fine = stateInService([makeCustomer()]);
    expect(isStuck(fine, serviceOf(fine))).toBe(false);
  });

  it("can be solved with a loan from Nonna, once a day and within reason", () => {
    let state = play(brokeWithoutDough(), { type: "borrowFromNonna" });
    expect(state).toMatchObject({ money: 30.5, debt: 30, lastNonnaLoanDay: 1 });
    expect(isStuck(state, serviceOf(state))).toBe(false);
    expect(play(state, { type: "borrowFromNonna" }).money).toBe(30.5);
    state = play(makeState({ debt: 70, day: 4 }), { type: "borrowFromNonna" });
    expect(state.debt).toBe(70);
  });

  it("can be solved by closing for today: the waiting customers go home and the day ends", () => {
    const state = play(brokeWithoutDough(), { type: "closeEarly" });
    expect(state.phase).toBe("summary");
    expect(state.service).toBeNull();
    expect(state.summary).toMatchObject({ served: 0 });
  });
});

describe("starting the day over", () => {
  it("goes back to this morning's prep, whatever happened since", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const morning = makeState({ money: 20 });
    let state = play(morning, { type: "openRestaurant" });
    serviceOf(state).customers = [makeCustomer()];
    state = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, { type: "servePizza", pizzaId: serviceOf(state).ready[0].id });
    expect(state.money).not.toBe(20);
    const restarted = play(state, { type: "restartDay" });
    expect(restarted).toMatchObject({ phase: "prep", service: null, money: 20, dayStart: null });
    expect(restarted.stock).toEqual(morning.stock);
    expect(restarted.toasts.at(-1)?.key).toBe("dayRestarted");
  });

  it("keeps this morning's copy out of reach of the day's changes", () => {
    let state = play(makeState(), { type: "openRestaurant" });
    serviceOf(state).customers = [makeCustomer()];
    state = play(state, ...toggle("pate", "tomate"));
    expect(state.dayStart?.stock).toEqual(makeState().stock);
  });

  it("keeps the settings chosen during the day", () => {
    const state = play(makeState(), { type: "openRestaurant" }, { type: "setLanguage", language: "en" }, { type: "restartDay" });
    expect(state.settings.language).toBe("en");
  });
});

describe("pausing", () => {
  it("stops the clock: nobody waits, nothing bakes", () => {
    const state = play(stateInService([makeCustomer()]), ...toggle("pate"), { type: "bake" }, { type: "togglePause" });
    const later = gameReducer(state, { type: "tick", seconds: 30 });
    expect(later).toBe(state);
    expect(play(state, { type: "togglePause" }).service?.paused).toBe(false);
  });

  it("leaves only the pause key working", () => {
    const paused = play(stateInService([makeCustomer()]), { type: "togglePause" });
    expect(shortcutAction(paused, "0")).toBeNull();
    expect(shortcutAction(paused, "Escape")).toEqual({ type: "togglePause" });
    expect(shortcutAction(stateInService([makeCustomer()]), "p")).toEqual({ type: "togglePause" });
  });
});

describe("pizzas nobody ordered", () => {
  it("can all be binned in one go, keeping the ones someone is waiting for", () => {
    let state = stateInService([makeCustomer()], { stock: { pate: 9, tomate: 9, mozza: 9, basilic: 9 } });
    state = play(state, ...toggle("pate"), { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, ...toggle("pate", "tomate"), { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
    expect(serviceOf(state).ready).toHaveLength(3);
    const binned = play(state, { type: "trashUnwantedPizzas" });
    expect(serviceOf(binned).ready.map((pizza) => pizza.ingredients)).toEqual([MARGHERITA]);
    expect(serviceOf(binned).stats.waste).toBeGreaterThan(0);
  });
});
