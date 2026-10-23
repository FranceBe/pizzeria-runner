import { describe, it, expect, vi, afterEach } from "vitest";
import { makeBookEntry, makeCustomer, makeState, play, serviceOf } from "../test/helpers";
import { MYSTERY_REWARDS } from "../data/events";
import { mysteryStars, planMysteryGuest, welcomeMaybeMystery } from "./mystery";
import type { Customer, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const mysteryNight = (overrides: Partial<GameState> = {}): GameState => play(makeState({ day: 9, event: "mysteryGuest", ...overrides }), { type: "openRestaurant" });
// The guest at the counter, served this long after coming in, their pizza this long on the pass.
const withGuest = (state: GameState, guest: Partial<Customer> = {}): GameState => {
  const customer = makeCustomer({ id: "g", name: "Paolo", mystery: true, ...guest });
  return { ...state, service: { ...serviceOf(state), customers: [customer], customersToCome: 0, mysteryArrival: 1 } };
};
const serveGuest = (state: GameState, waitingSeconds = 0): GameState => {
  const guest = serviceOf(state).customers[0];
  const ready = { ...state, service: { ...serviceOf(state), ready: [{ id: "p", ingredients: [...guest.ingredients], waitingSeconds }] } };
  return play(ready, { type: "servePizza", pizzaId: "p" });
};

describe("the mystery guest", () => {
  it("gives five stars, one less for each mood reached, one or two less for a lukewarm or cold pizza, never below one", () => {
    expect(mysteryStars(0, 0)).toBe(5);
    expect(mysteryStars(1, 0)).toBe(4);
    expect(mysteryStars(0, 30)).toBe(4);
    expect(mysteryStars(0, 60)).toBe(3);
    expect(mysteryStars(3, 60)).toBe(1);
  });

  it("comes in among the first customers of a mystery evening, and only then", () => {
    const state = mysteryNight();
    const arrival = serviceOf(state).mysteryArrival ?? 0;
    expect(arrival).toBeGreaterThanOrEqual(1);
    expect(arrival).toBeLessThanOrEqual(serviceOf(state).customersToCome);
    expect(serviceOf(play(makeState({ day: 9 }), { type: "openRestaurant" })).mysteryArrival).toBeNull();
  });

  it("is someone on their own passing by: never a regular, a table, a critic or a delivery", () => {
    const state = makeState({ day: 9, event: "mysteryGuest" });
    state.customerBook = { Luca: makeBookEntry({ regular: true }) };
    const service = { ...serviceOf(play(state, { type: "openRestaurant" })), mysteryArrival: 1, arrivals: 0 };
    const party = [
      makeCustomer({ id: "a", name: "Luca" }),
      makeCustomer({ id: "b", name: "Rosa", tableId: "t" }),
      makeCustomer({ id: "c", name: "Mme Sato", critic: true }),
      makeCustomer({ id: "d", name: "Marco", delivery: true }),
      makeCustomer({ id: "e", name: "Paolo" }),
    ];
    welcomeMaybeMystery(state, service, party);
    expect(party.filter((customer) => customer.mystery).map((customer) => customer.name)).toEqual(["Paolo"]);
    // Only one guest a night.
    const later = [makeCustomer({ id: "f", name: "Zoé" })];
    welcomeMaybeMystery(state, { ...service, customers: party }, later);
    expect(later[0].mystery).toBeUndefined();
  });

  it("waits for their turn: nobody before their arrival", () => {
    const state = makeState({ day: 9, event: "mysteryGuest" });
    const service = { ...serviceOf(play(state, { type: "openRestaurant" })), arrivals: 0 };
    planMysteryGuest(state, service, 10);
    service.mysteryArrival = 3;
    const first = [makeCustomer({ id: "a", name: "Ada" })];
    welcomeMaybeMystery(state, service, first);
    expect(first[0].mystery).toBeUndefined();
  });

  it("is unmasked on the receipt, with their stars and what they bring, and writes in the papers when pleased", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = withGuest(mysteryNight());
    const ended = serveGuest(state);
    expect(ended.phase).toBe("summary");
    expect(ended.summary?.mystery).toMatchObject({ name: "Paolo", stars: 5, ...MYSTERY_REWARDS[5] });
    expect(ended.press.at(-1)).toMatchObject({ mystery: true, critic: "Paolo", stars: 5 });
    // An inspector never becomes a regular: not in the customer book.
    expect(ended.customerBook.Paolo).toBeUndefined();
  });

  it("gives a cold welcome a low mark, nothing in the papers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const ended = serveGuest(withGuest(mysteryNight(), { waitedSeconds: 95 }), 60);
    expect(ended.summary?.mystery).toMatchObject({ stars: 1, xp: 0, money: 0 });
    expect(ended.press.some((article) => article.mystery)).toBe(false);
  });

  it("gives one star if still waiting when the kitchen closes early", () => {
    const closed = play(withGuest(mysteryNight()), { type: "closeEarly" });
    expect(closed.summary?.mystery).toMatchObject({ name: "Paolo", stars: 1 });
  });

  it("says so when they never came in", () => {
    const state = mysteryNight();
    const closed = play({ ...state, service: { ...serviceOf(state), customers: [makeCustomer()], customersToCome: 0 } }, { type: "closeEarly" });
    expect(closed.summary).toHaveProperty("mystery", null);
    // Any other evening says nothing of it.
    const ordinary = play(play(makeState({ day: 9 }), { type: "openRestaurant" }), { type: "closeEarly" });
    expect(ordinary.summary).not.toHaveProperty("mystery");
  });
});
