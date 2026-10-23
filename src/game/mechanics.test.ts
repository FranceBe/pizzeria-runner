import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, toJson } from "../test/helpers";
import { marketPrice } from "./events";
import { dailyCharges } from "./economy";
import { LOYALTY_GIFT_PORTIONS, LOYALTY_TIERS, loyaltyDiscount, loyaltyTier } from "./loyalty";
import { COMMIS_NAMES, EXHAUSTED_FROM, NIGHTLY_REST, TIRED_FROM, commisLevel, commisMood } from "./commis";
import { hydrateState } from "./state";
import { INGREDIENTS_BY_ID } from "../data/ingredients";
import { UPGRADES } from "../data/progression";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

describe("loyal suppliers", () => {
  it("count what is bought, by hand or restocking, and announce each new tier", () => {
    const state = makeState({ money: 10_000 });
    const bought = play(state, { type: "buyIngredient", ingredientId: "mozza", quantity: 30 }, { type: "buyIngredient", ingredientId: "mozza", quantity: 10 });
    expect(bought.bought?.mozza).toBe(40);
    expect(loyaltyTier(bought, "mozza")).toBe(1);
    expect(bought.toasts.map((toast) => toast.key)).toContain("loyaltyTier");
    const restocked = play(bought, { type: "restock", targetQuantity: 50 });
    expect(restocked.bought?.tomate).toBe(50 - (state.stock.tomate ?? 0));
  });

  it("take a discount off the market price at each tier, on top of the day's", () => {
    const base = INGREDIENTS_BY_ID.mozza.cost;
    LOYALTY_TIERS.forEach(({ portions, discount }) => {
      const state = makeState({ bought: { mozza: portions } });
      expect(loyaltyDiscount(state, "mozza")).toBe(discount);
      expect(marketPrice(state, "mozza")).toBeCloseTo(Math.round(base * (1 - discount) * 100) / 100);
    });
    expect(marketPrice(makeState({ bought: { mozza: 39 } }), "mozza")).toBe(base);
    const marketDay = makeState({ bought: { mozza: 300 }, event: "market" });
    expect(marketPrice(marketDay, "mozza")).toBeCloseTo(Math.round(base * 0.8 * 0.85 * 100) / 100);
  });

  it("send a few portions each week at the top tier, never from a supplier no longer signed", () => {
    const state = makeState({ day: 7, bought: { mozza: 300, tomate: 120 } });
    state.weekly = { week: 0, missions: [], bonusPaid: false };
    const monday = play(state, { type: "startNextDay" });
    expect(monday.stock.mozza).toBe((state.stock.mozza ?? 0) + LOYALTY_GIFT_PORTIONS);
    expect(monday.stock.tomate).toBe(state.stock.tomate);
    expect(monday.toasts.find((toast) => toast.key === "loyaltyGifts")?.params).toEqual({ ingredientIds: ["mozza"], portions: LOYALTY_GIFT_PORTIONS });
    const tuesday = play(monday, { type: "startNextDay" });
    expect(tuesday.stock.mozza).toBe(monday.stock.mozza);
  });

  it("never count what was given: a supplier's welcome, Nonna's help, a gift", () => {
    const state = makeState({ money: 500, xp: 5000 });
    const signed = play(state, { type: "signSupplier", ingredientId: "jambon" });
    expect(signed.bought?.jambon).toBeUndefined();
  });
});

describe("the commis", () => {
  const withCommis = (fatigue: number, overrides: Partial<GameState> = {}): GameState =>
    makeState({ upgrades: { ...makeState().upgrades, commis: 2 }, commis: { name: "Sasha", fatigue }, ...overrides });

  it("is hired with a name when the upgrade is bought", () => {
    const state = makeState({ money: 1000, xp: 5000 });
    const hired = play(state, { type: "buyUpgrade", upgradeKey: "commis" });
    expect(COMMIS_NAMES).toContain(hired.commis?.name);
    expect(hired.toasts.map((toast) => toast.key)).toContain("commisHired");
    // Sold back and bought again: the same person comes back.
    const back = play(hired, { type: "sellUpgrade", upgradeKey: "commis" }, { type: "buyUpgrade", upgradeKey: "commis" });
    expect(back.commis?.name).toBe(hired.commis?.name);
  });

  it("helps less when tired, not at all when exhausted or off", () => {
    expect(commisLevel(withCommis(0))).toBe(2);
    expect(commisLevel(withCommis(TIRED_FROM))).toBe(1);
    expect(commisLevel(withCommis(EXHAUSTED_FROM))).toBe(0);
    const off = withCommis(10);
    off.commis!.offDay = off.day;
    expect(commisMood(off)).toBe("off");
    expect(commisLevel(off)).toBe(0);
  });

  it("no longer rolls the dough when exhausted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const bake = (fatigue: number) => {
      const state = stateInService([makeCustomer()], withCommis(fatigue));
      return serviceOf(play(state, ...toggle("pate", "tomate", "mozza", "basilic"), { type: "bake" })).board;
    };
    expect(bake(0)).toEqual(["pate"]);
    expect(bake(EXHAUSTED_FROM)).toEqual([]);
  });

  it("tires with each pizza (twice in a rush), rests a little each night, fully on an evening off", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const open = play(withCommis(20), { type: "openRestaurant" });
    const service = serviceOf(open);
    service.stats.served = 15;
    service.stats.rushServed = 5;
    const closed = play(open, { type: "closeEarly" });
    expect(closed.commis?.fatigue).toBe(40);
    expect(play(closed, { type: "startNextDay" }).commis?.fatigue).toBe(40 - NIGHTLY_REST);

    const morning = play(withCommis(85), { type: "toggleCommisOff" });
    expect(commisMood(morning)).toBe("off");
    expect(play(morning, { type: "toggleCommisOff" }).commis?.offDay).toBeUndefined();
    const rested = play(play(morning, { type: "openRestaurant" }), { type: "closeEarly" });
    expect(rested.commis?.fatigue).toBe(0);
  });

  it("can be found exhausted in the morning after a run of busy evenings, the night's rest included", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const open = play(withCommis(80), { type: "openRestaurant" });
    serviceOf(open).stats.served = 30;
    const next = play(play(open, { type: "closeEarly" }), { type: "startNextDay" });
    expect(next.commis?.fatigue).toBe(100 - NIGHTLY_REST);
    expect(commisMood(next)).toBe("exhausted");
  });

  it("isn't paid on an evening off, and the evening off is only given in the morning", () => {
    const state = withCommis(80);
    const full = dailyCharges(state);
    const off = play(state, { type: "toggleCommisOff" });
    expect(dailyCharges(off)).toBe(full - UPGRADES.commis.dailyCharge * 2);
    const inService = stateInService([makeCustomer()], withCommis(80));
    expect(play(inService, { type: "toggleCommisOff" }).commis?.offDay).toBeUndefined();
  });

  it("is given a name in older saves, the same each time they load", () => {
    const old = toJson({ ...makeState({ upgrades: { ...makeState().upgrades, commis: 1 } }), commis: undefined });
    const first = hydrateState(old);
    expect(COMMIS_NAMES).toContain(first.commis?.name);
    expect(hydrateState(old).commis?.name).toBe(first.commis?.name);
    expect(hydrateState(toJson(makeState())).commis).toBeUndefined();
  });
});
