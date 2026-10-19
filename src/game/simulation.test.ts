// A robot plays many full days with every feature on, to catch what only shows up when everything mixes:
// group orders, rushes, incidents, festivals, tables, drinks, streaks, stars and weekly missions.
import { describe, it, expect, vi, afterEach } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { UPGRADES, UPGRADE_KEYS } from "../data/progression";
import { seededRandom } from "../utils/random";
import { makeState, toJson } from "../test/helpers";
import { BATCH_ID, nextBatchRecipe, openBatch } from "./batch";
import { gameReducer } from "./reducer";
import { destinationOf, selectedCustomer } from "./service";
import { hydrateState } from "./state";
import type { GameAction, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const DATES = ["2026-10-25", "2026-12-24", "2027-02-14", "2027-05-01"];

function lateGame(): GameState {
  const state = makeState({ money: 20000, xp: 30000, day: 3 });
  INGREDIENTS.filter((ingredient) => !ingredient.festival).forEach(({ id }) => (state.unlocked[id] = true));
  UPGRADE_KEYS.forEach((key) => (state.upgrades[key] = UPGRADES[key].costs.length));
  state.settings.tutorialDone = true;
  state.secretIngredient = true;
  state.secretStock = 5;
  return state;
}

function checkInvariants(state: GameState): void {
  expect(Number.isFinite(state.money)).toBe(true);
  expect(state.money).toBeGreaterThanOrEqual(-1e-9);
  expect(Number.isFinite(state.xp)).toBe(true);
  Object.values(state.stock).forEach((quantity) => expect(quantity).toBeGreaterThanOrEqual(0));
  expect(state.secretStock).toBeGreaterThanOrEqual(0);
}

// One decision of the robot during service.
function nextMove(state: GameState): GameAction {
  const service = state.service;
  if (!service) return { type: "tick", seconds: 1 };
  const servable = service.ready.find((pizza) => destinationOf(state, service, pizza.ingredients));
  if (servable) return { type: "servePizza", pizzaId: servable.id };
  if (service.ready.length > 2) return { type: "trashUnwantedPizzas" };
  // Drinks: the selected customer's, poured right (or now and then wrong, like a player), and the tray kept moving.
  const trayIndex = (service.tray ?? []).findIndex((id) => service.customers.some((c) => c.drink === id && !c.drinkServed));
  if (trayIndex >= 0) return { type: "serveTrayDrink", index: trayIndex };
  if ((service.tray?.length ?? 0) >= 3) return { type: "binTray" };
  const selected = selectedCustomer(service);
  if (selected?.drink && !selected.drinkServed) {
    return { type: "pourDrink", drinkId: Math.random() < 0.15 ? "eau" : selected.drink };
  }
  const waiting = service.customers.find((customer) => customer.pizzaServed && !customer.drinkServed);
  if (waiting && waiting.id !== service.selectedCustomerId) return { type: "selectCustomer", customerId: waiting.id };
  if (openBatch(state, service) && service.selectedCustomerId !== BATCH_ID && Math.random() < 0.3) return { type: "selectBatch" };
  const canMake = (ingredients: readonly string[]) =>
    ingredients.every((id) => service.board.includes(id as never) || (state.stock[id as keyof typeof state.stock] ?? 0) > 0);
  const target =
    service.selectedCustomerId === BATCH_ID ? nextBatchRecipe(state, service)?.ingredients : selectedCustomer(service)?.ingredients;
  // Like a player, run to the market when something runs out (there's money for it here).
  const outOf = service.customers.flatMap((customer) => customer.ingredients).find((id) => (state.stock[id] ?? 0) === 0);
  if (outOf) return { type: "buyIngredient", ingredientId: outOf, quantity: 10 };
  // And move on to another order when this one can't be made right now.
  if (!target || !canMake(target)) {
    const doable = service.customers.find((customer) => customer.id !== service.selectedCustomerId && canMake(customer.ingredients));
    if (doable) return { type: "selectCustomer", customerId: doable.id };
  }
  if (target) {
    const extra = service.board.find((id) => !target.includes(id));
    if (extra) return { type: "trashBoard" };
    const missing = target.find((id) => !service.board.includes(id) && (state.stock[id] ?? 0) > 0);
    if (missing) return { type: "toggleIngredient", ingredientId: missing };
    if (target.every((id) => service.board.includes(id))) return { type: "bake" };
  }
  return { type: "tick", seconds: 0.5 };
}

describe("a robot playing many days", () => {
  it("never breaks the game", () => {
    vi.spyOn(Math, "random").mockImplementation(seededRandom(20261018));
    let state = lateGame();
    const days = 25;
    for (let day = 0; day < days; day++) {
      state = gameReducer(state, { type: "syncCalendar", date: DATES[day % DATES.length] });
      state = gameReducer(state, { type: "restock", targetQuantity: 20 });
      state = gameReducer(state, { type: "openRestaurant" });
      expect(state.phase).toBe("service");
      let steps = 0;
      while (state.phase === "service" && steps < 6000) {
        state = gameReducer(state, nextMove(state));
        state = gameReducer(state, { type: "tick", seconds: 0.25 });
        steps += 1;
        if (steps % 500 === 0) {
          checkInvariants(state);
          // A save taken mid-service loads back.
          expect(hydrateState(toJson(state)).service?.customers.length).toBe(state.service?.customers.length);
        }
      }
      if (state.phase === "service") state = gameReducer(state, { type: "closeEarly" });
      expect(state.phase).toBe("summary");
      expect(state.summary?.stars).toBeGreaterThanOrEqual(0);
      checkInvariants(state);
      state = gameReducer(state, { type: "startNextDay" });
    }
    expect(state.day).toBe(3 + days);
    expect(state.lifetime.served).toBeGreaterThan(days * 5);
    expect(state.history).toHaveLength(days);
  });
});
