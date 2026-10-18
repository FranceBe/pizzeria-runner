import { describe, it, expect, vi, afterEach } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { createCustomer } from "./customers";
import { dietAllows, forDiet } from "./diets";
import { marketPrice } from "./events";
import { discoverClassics, knowsRecipe } from "./menu";
import { advanceQuest, expireQuest, maybeOfferQuest } from "./quests";
import { birthdaysToday, daysUntilBirthday, recordVisit } from "./regulars";
import { hydrateState } from "./state";
import { isInSeason, seasonOf, seasonalRecipe } from "./seasons";
import type { Customer, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const NO_TIP = 0.99;
const waitForOven = (state: GameState): GameState => play(state, { type: "tick", seconds: 10 });
function serveFirst(state: GameState, ingredients = MARGHERITA): GameState {
  const baked = waitForOven(play(state, ...toggle(...ingredients), { type: "bake" }));
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
}

describe("seasons", () => {
  it("turn every 7 days and make their ingredients cheaper", () => {
    expect([1, 7, 8, 15, 22, 29].map(seasonOf)).toEqual(["spring", "spring", "summer", "autumn", "winter", "spring"]);
    const summer = makeState({ day: 8 });
    expect(isInSeason(summer, "tomate")).toBe(true);
    expect(marketPrice(summer, "tomate")).toBeCloseTo(marketPrice(makeState(), "tomate") * 0.75);
  });

  it("put a recipe of the season forward when it is on the menu", () => {
    expect(seasonalRecipe(makeState({ day: 8 }))?.id).toBe("margherita");
  });
});

describe("diets", () => {
  it("rule out meat, pork or nothing", () => {
    expect(dietAllows("veggie", ["pate", "tomate", "anchois"])).toBe(false);
    expect(dietAllows("noPork", ["pate", "tomate", "anchois"])).toBe(true);
    expect(dietAllows("noPork", ["pate", "jambon"])).toBe(false);
  });

  it("swap the dough for gluten-free orders", () => {
    expect(forDiet("glutenFree", MARGHERITA)).toEqual(["pateSG", "tomate", "mozza", "basilic"]);
    expect(forDiet("veggie", MARGHERITA)).toEqual(MARGHERITA);
  });

  it("never depend on the customer's name", () => {
    // The diet is drawn on its own: same random draws, same diet, whoever walks in.
    const dietFor = (name: string) => {
      vi.spyOn(Math, "random").mockReturnValue(0.01);
      const customer = createCustomer(makeState({ xp: 450 }), "regular", { name }) as Customer;
      vi.restoreAllMocks();
      return customer.diet;
    };
    expect(new Set(["Karim", "Giulia", "Kenji", "Louis", "Fatou"].map(dietFor)).size).toBe(1);
  });

  it("show up from level 4, with a menu that fits", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    expect((createCustomer(makeState({ xp: 0 })) as Customer).diet).toBeNull();
    expect((createCustomer(makeState({ xp: 450 })) as Customer).diet).toBe("veggie");
  });
});

describe("tables", () => {
  it("pay a bonus when the whole table is served while still happy", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const table = { t1: { size: 2, served: 0, allHappy: true, color: 0 } };
    let state = stateInService([makeCustomer({ tableId: "t1" }), makeCustomer({ id: "c2", name: "Sofia", tableId: "t1" }), makeCustomer({ id: "c3", name: "Zoé" })], { money: 0 });
    serviceOf(state).tables = table;
    state = serveFirst(state);
    expect(state.money).toBe(7);
    state = serveFirst(state);
    expect(state.money).toBe(7 + 7 + 3);
    expect(state.lifetime.happyTables).toBe(1);
  });

  it("come in together", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const state = play(makeState({ xp: 300, event: null }), { type: "openRestaurant" }, { type: "tick", seconds: 1 });
    const { customers, tables } = serviceOf(state);
    expect(customers.length).toBeGreaterThan(1);
    expect(new Set(customers.map((customer) => customer.tableId)).size).toBe(1);
    expect(Object.values(tables ?? {})[0]).toMatchObject({ size: customers.length, served: 0 });
  });
});

describe("regulars' profiles", () => {
  it("get a dislike and a birthday when they become regulars", () => {
    const state = makeState({ recipes: [...makeState().recipes] });
    state.customerBook = { Luca: makeBookEntry({ visits: 2, orders: { margherita: 2 } }) };
    expect(recordVisit(state, makeCustomer())).toBe(true);
    expect(state.customerBook.Luca.birthday).toBeGreaterThanOrEqual(1);
    expect(state.customerBook.Luca.birthday).toBeLessThanOrEqual(28);
  });

  it("never order what they dislike when there is something else", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = play(makeState({ money: 500, xp: 500 }), { type: "signSupplier", ingredientId: "origan" });
    state.customerBook = { Luca: makeBookEntry({ visits: 5, dislikes: "basilic" }) };
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect((createCustomer(state, "regular", { name: "Luca" }) as Customer).ingredients).not.toContain("basilic");
  });

  it("come for their birthday and get a gift with their favourite", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const book = { Luca: makeBookEntry({ visits: 5, orders: { margherita: 5 }, birthday: 3 }) };
    expect(birthdaysToday(makeState({ day: 3, customerBook: book }))).toEqual(["Luca"]);
    expect(daysUntilBirthday(makeState({ day: 30, customerBook: book }), 3)).toBe(1);
    const state = serveFirst(stateInService([makeCustomer({ birthday: true })], { money: 0, customerBook: book }));
    expect(state.money).toBe(7 + 5 - 6);
    expect(state.lifetime.birthdays).toBe(1);
  });
});

describe("neighbourhood quests", () => {
  it("are offered from day 4: a group order is for tonight", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = makeState({ day: 4 });
    maybeOfferQuest(state);
    expect(state.quest).toMatchObject({ kind: "batch", target: 4, deadlineDay: 4 });
    expect(state.quest?.items).toEqual([{ recipeId: "margherita", recipeName: null, count: 4, delivered: 0 }]);
    expect(makeState({ day: 3 }).quest).toBeNull();
  });

  it("pay their reward once complete", () => {
    const state = makeState({ day: 4, money: 0 });
    state.quest = { kind: "happy", giver: "school", target: 2, progress: 0, deadlineDay: 6, reward: 30, xp: 40 };
    advanceQuest(state, makeCustomer(), false, 0);
    expect(state.quest).toMatchObject({ progress: 0 });
    advanceQuest(state, makeCustomer(), true, 0);
    advanceQuest(state, makeCustomer(), true, 0);
    expect(state.quest).toBeNull();
    expect(state.money).toBe(30);
    expect(state.lifetime.questsDone).toBe(1);
  });

  it("show their reward apart on the day's receipt, and stay in the journal", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = stateInService([makeCustomer()], { money: 0 });
    state.quest = { kind: "serveTotal", giver: "townHall", target: 1, progress: 0, deadlineDay: 3, reward: 45, xp: 50 };
    const after = serveFirst(state);
    expect(after.summary).toMatchObject({ revenue: 7, questRewards: 45, net: 7 + 45 - 6 });
    expect(after.questLog).toEqual([{ day: 1, kind: "serveTotal", giver: "townHall", target: 1, recipeId: undefined, recipeName: undefined, reward: 45 }]);
    expect(after.lifetime.questRewards).toBe(45);
  });

  it("are simply dropped after their deadline", () => {
    const state = makeState({ day: 7 });
    state.quest = { kind: "happy", giver: "school", target: 8, progress: 2, deadlineDay: 6, reward: 30, xp: 40 };
    expireQuest(state);
    expect(state.quest).toBeNull();
    expect(state.toasts.at(-1)?.key).toBe("questExpired");
  });
});

describe("Nonna's recipes", () => {
  it("are shared once the pizzeria reaches their level", () => {
    const allUnlocked = Object.fromEntries(INGREDIENTS.map(({ id }) => [id, true]));
    const early = makeState({ xp: 0, unlocked: allUnlocked });
    discoverClassics(early);
    expect(knowsRecipe(early, "nonna")).toBe(false);
    const later = makeState({ xp: 400, unlocked: allUnlocked });
    discoverClassics(later);
    expect(knowsRecipe(later, "nonna")).toBe(true);
    expect(later.toasts.map((toast) => toast.key)).toContain("nonnaRecipe");
  });
});

describe("late game", () => {
  it("lets the player buy and switch looks", () => {
    let state = play(makeState({ money: 200 }), { type: "chooseCosmetic", slot: "awning", id: "green" });
    expect(state.cosmetics).toMatchObject({ awning: "green" });
    expect(state.money).toBe(80);
    state = play(state, { type: "chooseCosmetic", slot: "awning", id: "red" }, { type: "chooseCosmetic", slot: "awning", id: "green" });
    expect(state.money).toBe(80);
    expect(play(state, { type: "chooseCosmetic", slot: "sign", id: "gold" }).toasts.at(-1)?.key).toBe("notEnoughMoney");
  });

  it("ignores looks that don't exist, even with tricky names from a save code", () => {
    const state = makeState({ money: 200 });
    for (const id of ["__proto__", "constructor", "purple"]) {
      const after = play(state, { type: "chooseCosmetic", slot: "awning", id });
      expect(after.cosmetics.awning).toBe("red");
      expect(after.money).toBe(200);
    }
  });

  it("brings in the second address's income every evening", () => {
    vi.spyOn(Math, "random").mockReturnValue(NO_TIP);
    const state = serveFirst(stateInService([makeCustomer()], { money: 0, upgrades: { ...makeState().upgrades, annexe: 1 } }));
    expect(state.summary).toMatchObject({ annexeIncome: 30 });
    expect(state.money).toBe(7 + 30 - 6);
  });

  it("loads version 4 saves with every new field in place", () => {
    const state = hydrateState(toJson({ version: 4, money: 3, recipes: [], challengeResult: { score: 1, served: 1, isNewBest: true } }));
    expect(state.challengeResult).toBeNull();
    expect(state.cosmetics.awning).toBe("red");
    expect(state.settings.theme).toBe("auto");
    expect(state.lifetime.drinksSold).toBe(0);
  });
});
