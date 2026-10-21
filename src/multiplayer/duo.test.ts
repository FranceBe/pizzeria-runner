import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDuoKitchen, isAllowedInDuo, isPartnerDuoMove, playCoopMove } from "./coop";
import { deleteDuo, loadDuos, MAX_DUOS, newDuo, openDuo, saveDuo } from "./duoSaves";

// A tiny stand-in for the browser's localStorage.
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("duo pizzerias", () => {
  it("are fresh games of their own, under their own name, without the solo tutorial", () => {
    const { info, game } = newDuo("Chez nous", ["Léa"], "fr");
    expect(info).toMatchObject({ name: "Chez nous", members: ["Léa"] });
    expect(game).toMatchObject({ name: "Chez nous", day: 1 });
    expect(game.settings.tutorialDone).toBe(true);
  });

  it("are kept in this browser apart from the solo game, the latest first, a newer copy replacing the older one", () => {
    const first = newDuo("Chez nous", ["Léa", "Tom"], "fr");
    const second = newDuo("La Bande", ["Léa", "Zoé"], "fr");
    saveDuo(first.info, first.game, 1000);
    saveDuo(second.info, second.game, 2000);
    expect(loadDuos().map((duo) => duo.name)).toEqual(["La Bande", "Chez nous"]);
    const later = { ...first.game, day: 5 };
    saveDuo(first.info, later, 3000);
    expect(loadDuos().map((duo) => [duo.name, duo.day])).toEqual([["Chez nous", 5], ["La Bande", 1]]);
    expect(store.has("forno-lento-save-v1")).toBe(false);
    expect(openDuo(loadDuos()[0])).toMatchObject({ name: "Chez nous", day: 5, toasts: [] });
  });

  it("keep a few at most, and can be deleted", () => {
    for (let index = 0; index < MAX_DUOS + 2; index++) {
      const duo = newDuo(`Duo ${index}`, [], "en");
      saveDuo(duo.info, duo.game, index);
    }
    const duos = loadDuos();
    expect(duos).toHaveLength(MAX_DUOS);
    expect(duos[0].name).toBe(`Duo ${MAX_DUOS + 1}`);
    deleteDuo(duos[0].id);
    expect(loadDuos()).toHaveLength(MAX_DUOS - 1);
  });

  it("survive damaged storage", () => {
    store.set("forno-lento-duos-v1", "{not json");
    expect(loadDuos()).toEqual([]);
    store.set("forno-lento-duos-v1", JSON.stringify([{ id: 1 }, null, "x"]));
    expect(loadDuos()).toEqual([]);
  });
});

describe("playing a duo pizzeria", () => {
  const start = () => {
    const { info, game } = newDuo("Chez nous", ["Léa", "Tom"], "en");
    return createDuoKitchen({ ...game, money: 50 }, ["host", "partner"], info);
  };

  it("lets the partner cook, serve drinks and restock, and leaves the big decisions to the host", () => {
    expect(isPartnerDuoMove({ type: "buyIngredient", ingredientId: "mozza", quantity: 5 })).toBe(true);
    expect(isPartnerDuoMove({ type: "pourDrink", drinkId: "eau" })).toBe(true);
    expect(isPartnerDuoMove({ type: "toggleIngredient", ingredientId: "pate" })).toBe(true);
    ["buyUpgrade", "sellUpgrade", "openRestaurant", "startNextDay", "addRecipe", "signSupplier", "resetGame"].forEach((type) =>
      expect(isPartnerDuoMove({ type })).toBe(false),
    );
  });

  it("checks the values of the partner's moves, not just their kind: no buying -1000 mozzarellas for money", () => {
    expect(isPartnerDuoMove({ type: "buyIngredient", ingredientId: "mozza", quantity: -1000 })).toBe(false);
    expect(isPartnerDuoMove({ type: "buyIngredient", ingredientId: "mozza", quantity: 2.5 })).toBe(false);
    expect(isPartnerDuoMove({ type: "buyIngredient", ingredientId: "gold", quantity: 5 })).toBe(false);
    expect(isPartnerDuoMove({ type: "restock", targetQuantity: 1e9 })).toBe(false);
    expect(isPartnerDuoMove({ type: "toggleIngredient", ingredientId: { evil: true } })).toBe(false);
    expect(isPartnerDuoMove({ type: "pourDrink", drinkId: "champagne" })).toBe(false);
    expect(isPartnerDuoMove({ type: "serveTrayDrink", index: -1 })).toBe(false);
    expect(isPartnerDuoMove({ type: "selectCustomer", customerId: "x".repeat(500) })).toBe(false);
  });

  it("keeps the player's own things out of it, even for the host", () => {
    expect(isAllowedInDuo({ type: "startChallenge", date: "2026-10-21" })).toBe(false);
    expect(isAllowedInDuo({ type: "resetGame" })).toBe(false);
    expect(isAllowedInDuo({ type: "openRestaurant" })).toBe(true);
  });

  it("plays a day with both: the partner restocks, the host opens, each cooks on their own board", () => {
    let duo = start();
    duo = playCoopMove(duo, "partner", { type: "buyIngredient", ingredientId: "mozza", quantity: 5 });
    expect(duo.game.money).toBeLessThan(50);
    duo = playCoopMove(duo, "host", { type: "openRestaurant" });
    expect(duo.game.phase).toBe("service");
    duo = playCoopMove(duo, "host", { type: "toggleIngredient", ingredientId: "pate" });
    duo = playCoopMove(duo, "partner", { type: "toggleIngredient", ingredientId: "pate" });
    duo = playCoopMove(duo, "partner", { type: "toggleIngredient", ingredientId: "tomate" });
    expect(duo.boards.host.board).toEqual(["pate"]);
    expect(duo.boards.partner.board).toEqual(["pate", "tomate"]);
    expect(duo.duo?.name).toBe("Chez nous");
  });
});
