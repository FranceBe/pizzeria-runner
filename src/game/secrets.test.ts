import { describe, it, expect, vi, afterEach } from "vitest";
import { ACHIEVEMENT_IDS } from "../data/achievements";
import { ACCESSORY_IDS } from "../data/customers";
import { REPUTATION_THRESHOLDS } from "../data/progression";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { tipChance } from "./customers";
import { rollLooks } from "./looks";
import { hydrateState } from "./state";
import { MAX_LEVEL } from "./progression";
import { awaitsButtons, swipeKey, typeSecretKey } from "./secretCode";
import { shortcutAction } from "./shortcuts";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const typeAll = (keys: readonly string[]) =>
  keys.reduce((progress, key) => (progress.isComplete ? progress : typeSecretKey(progress.typed, key)), { typed: [] as string[], isComplete: false });

function bakeAndServe(state: GameState, ...beforeBake: Parameters<typeof play>[1][]): GameState {
  const baked = play(play(state, ...toggle(...MARGHERITA), ...beforeBake, { type: "bake" }), { type: "tick", seconds: 10 });
  return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
}

describe("the secret code", () => {
  it("is recognised only in full and in order, even after other keys", () => {
    expect(typeAll(CODE).isComplete).toBe(true);
    expect(typeAll(["x", "ArrowUp", ...CODE]).isComplete).toBe(true);
    expect(typeAll(CODE.slice(0, 9)).isComplete).toBe(false);
    expect(typeAll([...CODE.slice(0, 8), "a", "b"]).isComplete).toBe(false);
  });

  it("can be swiped on a touch screen, then finished with the two buttons", () => {
    const swipes = [[0, -80], [0, -80], [0, 90], [0, 90], [-70, 5], [70, -5], [-70, 5], [70, -5]].map(([dx, dy]) => swipeKey(dx, dy));
    const arrows = swipes.filter((key): key is string => key !== null);
    expect(arrows).toHaveLength(8);
    expect(awaitsButtons(typeAll(arrows).typed)).toBe(true);
    expect(awaitsButtons(typeAll(arrows.slice(0, 7)).typed)).toBe(false);
    expect(typeAll([...arrows, "b", "a"]).isComplete).toBe(true);
    expect(swipeKey(10, 12)).toBeNull();
  });

  it("shares Nonna's secret and unlocks an achievement nothing else gives", () => {
    const state = play(makeState(), { type: "enterSecretCode" });
    expect(state.secretIngredient).toBe(true);
    expect(state.achievements.secretCode).toBe(1);
    expect(state.toasts.map((toast) => toast.key)).toContain("secretFromCode");
    expect(ACHIEVEMENT_IDS).toContain("secretCode");
  });
});

describe("Nonna's secret ingredient", () => {
  it("doesn't change the pizza: the customer still recognises their order", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = bakeAndServe(stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })], { secretIngredient: true, secretStock: 1 }), { type: "toggleSecret" });
    expect(serviceOf(state).customers.map((customer) => customer.name)).toEqual(["Zoé"]);
  });

  it("sometimes earns a tip as big as the pizza", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    const withSecret = bakeAndServe(stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })], { secretIngredient: true, secretStock: 1, money: 0 }), { type: "toggleSecret" });
    expect(withSecret.pops.map((pop) => pop.kind)).toContain("secret");
    const without = bakeAndServe(stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })], { secretIngredient: true, money: 0 }));
    expect(withSecret.money - without.money).toBeCloseTo(7);
  });

  it("can't be added before it is shared, without dough, or without a jar made", () => {
    const toggleSecret = { type: "toggleSecret" } as const;
    expect(serviceOf(play(stateInService([makeCustomer()], { secretStock: 1 }), ...toggle("pate"), toggleSecret)).secretOnBoard).toBeFalsy();
    expect(serviceOf(play(stateInService([makeCustomer()], { secretIngredient: true, secretStock: 1 }), toggleSecret)).secretOnBoard).toBeFalsy();
    expect(serviceOf(play(stateInService([makeCustomer()], { secretIngredient: true }), ...toggle("pate"), toggleSecret)).secretOnBoard).toBeFalsy();
  });

  it("is made at the market, 10 euros a jar of 4 pizzas, never with the restock buttons", () => {
    let state = play(makeState({ secretIngredient: true, money: 25 }), { type: "craftSecret" }, { type: "craftSecret" });
    expect(state).toMatchObject({ secretStock: 8, money: 5, purchasesToday: 20 });
    state = play(state, { type: "craftSecret" });
    expect(state.secretStock).toBe(8);
    expect(state.toasts.at(-1)?.key).toBe("notEnoughMoney");
    expect(play(makeState({ money: 25 }), { type: "craftSecret" }).secretStock).toBe(0);
    expect(play(state, { type: "restock", targetQuantity: 20 }).secretStock).toBe(8);
  });

  it("goes on the pizza with the S key", () => {
    expect(shortcutAction(stateInService([makeCustomer()], { secretIngredient: true }), "s")).toEqual({ type: "toggleSecret" });
    expect(shortcutAction(stateInService([makeCustomer()]), "s")).toBeNull();
  });

  it("uses one jar per pizza, and puts it back when taken off or unused at closing", () => {
    const toggleSecret = { type: "toggleSecret" } as const;
    let state = play(stateInService([makeCustomer()], { secretIngredient: true, secretStock: 2 }), ...toggle("pate"), toggleSecret);
    expect(state.secretStock).toBe(1);
    expect(play(state, toggleSecret).secretStock).toBe(2);
    expect(play(state, ...toggle("pate")).secretStock).toBe(2);
    expect(play(state, { type: "trashBoard" }).secretStock).toBe(1);
    state = play(state, { type: "bake" });
    expect(state.secretStock).toBe(1);
    expect(serviceOf(state).oven[0].secret).toBe(true);
  });

  it("is shared by Nonna once each of her first three recipes has been served", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Zoé" })]);
    state.lifetime.byRecipe = { nonna: { name: null, count: 1 }, nonnarosa: { name: null, count: 2 } };
    expect(bakeAndServe(state).secretIngredient).toBe(false);
    state.lifetime.byRecipe.segreto = { name: null, count: 1 };
    const trusted = bakeAndServe(state);
    expect(trusted.secretIngredient).toBe(true);
    expect(trusted.achievements.secretCode).toBeUndefined();
  });
});

describe("offering a drink", () => {
  const regular = { Luca: makeBookEntry({ visits: 4 }) };

  it("is only for regulars, and makes a good tip more likely", () => {
    const state = stateInService([makeCustomer({ drink: "vin" })], { customerBook: regular, money: 5 });
    const before = tipChance(state, serviceOf(state).customers[0]);
    const offered = play(state, { type: "offerDrink" });
    const customer = serviceOf(offered).customers[0];
    expect(customer).toMatchObject({ drinkServed: true, drinkOffered: true });
    // Nothing comes in: only the glass goes out.
    expect(offered.money).toBe(5 - 1.5);
    expect(tipChance(offered, customer)).toBeCloseTo(before + 0.25);
    expect(serviceOf(play(stateInService([makeCustomer({ drink: "vin" })]), { type: "offerDrink" })).customers[0].drinkOffered).toBeFalsy();
  });

  it("has a keyboard shortcut", () => {
    expect(shortcutAction(stateInService([makeCustomer({ drink: "vin" })], { customerBook: regular }), "o")).toEqual({ type: "offerDrink" });
    expect(shortcutAction(stateInService([makeCustomer({ drink: "vin" })]), "o")).toBeNull();
  });
});

describe("customers' looks", () => {
  it("are varied, sometimes bold, sometimes with an accessory", () => {
    let seed = 0;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const crowd = Array.from({ length: 300 }, () => rollLooks("Sam", random));
    expect(new Set(crowd.map((looks) => looks.hairStyle)).size).toBe(8);
    expect(crowd.some((looks) => ["#3d6fd9", "#2fa36b", "#e26aa6", "#8a55d6", "#1fb3b3"].includes(looks.hair))).toBe(true);
    expect(new Set(crowd.map((looks) => looks.accessory)).size).toBe(ACCESSORY_IDS.length + 1); // every accessory, and none
  });

  it("follow the name: no facial hair for feminine names, mostly longer or shorter hair", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const giulias = Array.from({ length: 400 }, () => rollLooks("Giulia", random));
    expect(giulias.some((looks) => looks.accessory === "moustache" || looks.accessory === "beard")).toBe(false);
    expect(giulias.filter((looks) => [1, 2, 3, 4, 5].includes(looks.hairStyle)).length).toBeGreaterThan(330);
    const lucas = Array.from({ length: 400 }, () => rollLooks("Luca", random));
    expect(lucas.filter((looks) => [0, 4, 6, 7].includes(looks.hairStyle)).length).toBeGreaterThan(330);
    expect(lucas.some((looks) => looks.accessory === "beard")).toBe(true);
  });

  it("lose facial hair for feminine regulars met before", () => {
    const state = hydrateState(toJson({ version: 7, money: 1, recipes: [], customerBook: { Léa: makeBookEntry({ accessory: "moustache" }), Tom: makeBookEntry({ accessory: "beard" }) } }));
    expect(state.customerBook.Léa.accessory).toBeNull();
    expect(state.customerBook.Tom.accessory).toBe("beard");
  });

  it("stay the same for a regular", () => {
    const state = stateInService([makeCustomer({ accessory: "beret", hairStyle: 7 })]);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const served = bakeAndServe(state);
    expect(served.customerBook.Luca).toMatchObject({ accessory: "beret", hairStyle: 7 });
  });
});

describe("levels", () => {
  it("go up to 20", () => {
    expect(MAX_LEVEL).toBe(20);
  });
});

describe("Mamma's secret", () => {
  const PROFITABLE_WEEK = [5, 12, 3, 20, 8].map((net, index) => ({ day: index + 1, served: 6, revenue: 50, tips: 4, net, xp: 40, event: null }));
  const sixthLevel = REPUTATION_THRESHOLDS[5];

  it("is shared after 5 profitable days in a row, from level 6, with a hidden achievement", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const closeTheDay = (overrides: Partial<GameState>) => bakeAndServe(stateInService([makeCustomer()], { money: 50, ...overrides }));
    // Four good days before this one, and this one ends in profit too: the fifth in a row.
    const shared = closeTheDay({ xp: sixthLevel, history: PROFITABLE_WEEK.slice(1) });
    expect(shared.phase).toBe("summary");
    expect(shared.summary?.net).toBeGreaterThan(0);
    expect(shared.mammaSecret).toBe(true);
    expect(shared.toasts.map((toast) => toast.key)).toContain("secretFromMamma");
    expect(shared.achievements.mammaSecret).toBeDefined();
    // A day at a loss in the row, or too low a level: not yet.
    expect(closeTheDay({ xp: sixthLevel, history: [...PROFITABLE_WEEK.slice(1, 3), { ...PROFITABLE_WEEK[3], net: -2 }, PROFITABLE_WEEK[4]] }).mammaSecret).toBe(false);
    expect(closeTheDay({ xp: 0, history: PROFITABLE_WEEK }).mammaSecret).toBe(false);
  });

  it("is made at the market, 8 euros for 3 pizzas", () => {
    const state = play(makeState({ mammaSecret: true, money: 10 }), { type: "craftMamma" }, { type: "craftMamma" });
    expect(state).toMatchObject({ mammaStock: 3, money: 2 });
    expect(play(makeState({ money: 10 }), { type: "craftMamma" }).mammaStock).toBe(0);
  });

  it("charms the next customer: patience back to full, and a tip for sure", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const waiting = makeCustomer({ id: "c2", name: "Zoé", waitedSeconds: 70 });
    let state = stateInService([makeCustomer(), waiting], { mammaSecret: true, mammaStock: 1 });
    expect(tipChance(state, waiting)).toBeLessThan(1);
    state = bakeAndServe(state, { type: "toggleMamma" });
    expect(state.mammaStock).toBe(0);
    const zoe = serviceOf(state).customers[0];
    expect(zoe).toMatchObject({ id: "c2", charmed: true });
    expect(zoe.waitedSeconds).toBeLessThan(15);
    // Math.random is stuck at 0.99, which would never give a tip: the charm does.
    const tipped = bakeAndServe(state);
    expect(tipped.summary?.tips).toBeGreaterThan(0);
  });

  it("skips critics, deliveries and celebrities, and waits for the next one to come in if nobody is there", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let state = stateInService([makeCustomer(), makeCustomer({ id: "c2", name: "Mme Sato", critic: true })], { mammaSecret: true, mammaStock: 1 });
    state = bakeAndServe(state, { type: "toggleMamma" });
    expect(serviceOf(state).customers[0].charmed).toBeFalsy();
    expect(serviceOf(state).charmsPending).toBe(1);
    serviceOf(state).customers.push(makeCustomer({ id: "c3", name: "Zoé", waitedSeconds: 40 }));
    state = play(state, { type: "tick", seconds: 0.1 });
    expect(serviceOf(state).customers[1]).toMatchObject({ id: "c3", charmed: true });
    expect(serviceOf(state).charmsPending).toBe(0);
  });

  it("goes back in the jar when taken off or when the dough comes off, and works with the M key", () => {
    const toggleMamma = { type: "toggleMamma" } as const;
    const state = play(stateInService([makeCustomer()], { mammaSecret: true, mammaStock: 2 }), ...toggle("pate"), toggleMamma);
    expect(state.mammaStock).toBe(1);
    expect(play(state, toggleMamma).mammaStock).toBe(2);
    expect(play(state, ...toggle("pate")).mammaStock).toBe(2);
    expect(shortcutAction(state, "m")).toEqual(toggleMamma);
    expect(shortcutAction(stateInService([makeCustomer()]), "m")).toBeNull();
  });

  it("loads in an older save as not shared yet", () => {
    const { mammaSecret, mammaStock, ...older } = makeState();
    expect([mammaSecret, mammaStock]).toEqual([false, 0]);
    expect(hydrateState(toJson(older as GameState))).toMatchObject({ mammaSecret: false, mammaStock: 0 });
  });
});
