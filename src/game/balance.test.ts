import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { orderWeight } from "./customers";
import { forecastCustomers } from "./economy";
import { canHappen } from "./events";
import { PACE_ARRIVALS, paceFor } from "./difficulty";
import { SLICE_PATIENCE_SECONDS } from "./slice";
import { THEME_CROWD_FACTOR, THEME_ORDER_BOOST, themeOnMenu } from "./themes";
import { morningTips, type Tip } from "./tips";
import { createTranslator, LANGUAGES, translateMessage } from "../i18n";
import { MAX_SECONDS_BETWEEN_ARRIVALS, MIN_SECONDS_BETWEEN_ARRIVALS } from "./actions/serviceActions";
import { LIGHTNING_SECONDS } from "../data/tonight";
import type { DayRecord, GameState, Recipe } from "./types";

afterEach(() => vi.restoreAllMocks());

// The suppliers the pizzas below need, signed, with plenty in the fridge.
const UNLOCKED = { ...makeState().unlocked, creme: true, champi: true, chevre: true, jambon: true };
const STOCK = { pate: 50, tomate: 50, mozza: 50, basilic: 50, creme: 50, champi: 50, chevre: 50, jambon: 50 };

const recipe = (id: `c-${string}`, ingredients: Recipe["ingredients"], overrides: Partial<Recipe> = {}): Recipe =>
  ({ id, name: id.slice(2), ingredients, price: 8, classic: false, custom: true, onMenu: true, newUntil: 0, ...overrides });
const BIANCA = recipe("c-bianca", ["pate", "creme", "mozza"]);
const PROSCIUTTO = recipe("c-prosciutto", ["pate", "tomate", "mozza", "jambon"]);

// A baked pizza nobody ordered on the pass, and these customers at the counter.
const withUnwantedPizza = (customers = [makeCustomer({ id: "a", recipeId: "c-bianca", ingredients: BIANCA.ingredients, waitedSeconds: 40 })]) => {
  const state = stateInService(customers, { recipes: [...makeState().recipes, BIANCA], unlocked: UNLOCKED, stock: STOCK });
  const baked = play(state, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 6 });
  return { state: baked, pizzaId: serviceOf(baked).ready[0].id };
};

describe("a slice for the queue", () => {
  it("cheers everyone waiting up, once each, and throws nothing away", () => {
    const { state, pizzaId } = withUnwantedPizza();
    const waited = serviceOf(state).customers[0].waitedSeconds;
    const sliced = play(state, { type: "offerSlice", pizzaId });
    const service = serviceOf(sliced);
    expect(service.ready).toHaveLength(0);
    expect(service.customers[0].waitedSeconds).toBe(waited - SLICE_PATIENCE_SECONDS);
    expect(service.customers[0].sliceSeconds).toBe(SLICE_PATIENCE_SECONDS);
    expect(service.stats.waste).toBe(0);
    expect(service.stats.slices).toBe(1);
    expect(sliced.toasts.map((toast) => toast.key)).toContain("sliceOffered");
  });

  it("is not for a pizza someone ordered, nor when nobody would enjoy it", () => {
    const ordered = withUnwantedPizza([makeCustomer({ id: "a" })]);
    expect(serviceOf(play(ordered.state, { type: "offerSlice", pizzaId: ordered.pizzaId })).ready).toHaveLength(1);
    const { state, pizzaId } = withUnwantedPizza([makeCustomer({ id: "a", recipeId: "c-bianca", ingredients: BIANCA.ingredients, sliceSeconds: 20 })]);
    expect(serviceOf(play(state, { type: "offerSlice", pizzaId })).ready).toHaveLength(1);
  });

  it("is for those still waiting for their pizza, not deliveries nor those only waiting for a drink", () => {
    const { state, pizzaId } = withUnwantedPizza([
      makeCustomer({ id: "a", recipeId: "c-bianca", ingredients: BIANCA.ingredients, waitedSeconds: 40 }),
      makeCustomer({ id: "b", recipeId: "c-bianca", ingredients: BIANCA.ingredients, waitedSeconds: 40, delivery: true }),
      makeCustomer({ id: "c", recipeId: "c-bianca", ingredients: BIANCA.ingredients, waitedSeconds: 40, pizzaServed: true, drink: "eau" }),
    ]);
    const sliced = play(state, { type: "offerSlice", pizzaId });
    expect(serviceOf(sliced).customers.map((customer) => customer.sliceSeconds)).toEqual([SLICE_PATIENCE_SECONDS, undefined, undefined]);
    expect(sliced.toasts.find((toast) => toast.key === "sliceOffered")?.params).toEqual({ count: 1 });
  });

  it("never takes a wait below zero, and remembers what it took", () => {
    const { state, pizzaId } = withUnwantedPizza([makeCustomer({ id: "a", recipeId: "c-bianca", ingredients: BIANCA.ingredients, waitedSeconds: 0 })]);
    const customer = serviceOf(play(state, { type: "offerSlice", pizzaId })).customers[0];
    expect(customer.waitedSeconds).toBe(0);
    expect(customer.sliceSeconds).toBe(6);
  });

  it("gives patience, not time: tonight's lightning goal still counts from when they came in", () => {
    const { state, pizzaId } = withUnwantedPizza([makeCustomer({ id: "a", waitedSeconds: LIGHTNING_SECONDS + 5 })]);
    // The margherita baking for them is ordered: slice a second, unwanted pizza instead.
    serviceOf(state).ready.push({ id: "spare", ingredients: BIANCA.ingredients, waitingSeconds: 0 });
    state.tonightGoal = { day: state.day, kind: "lightning", target: 1, progress: 0, status: "open" };
    const sliced = play(state, { type: "offerSlice", pizzaId: "spare" });
    expect(serviceOf(sliced).customers[0].waitedSeconds).toBeLessThan(LIGHTNING_SECONDS);
    const served = play(sliced, { type: "servePizza", pizzaId });
    expect(served.tonightGoal?.progress).toBe(0);
  });

  it("is not for challenges, where ingredients are free", () => {
    const { state, pizzaId } = withUnwantedPizza();
    serviceOf(state).challenge = { date: "2026-10-23", score: 0, happy: 0, secondsLeft: 60, seed: 1 } as never;
    expect(serviceOf(play(state, { type: "offerSlice", pizzaId })).ready).toHaveLength(1);
  });
});

describe("themed nights", () => {
  const withTheme = (overrides: Partial<GameState> = {}): GameState =>
    makeState({ day: 8, recipes: [...makeState().recipes, BIANCA, PROSCIUTTO], event: "biancaNight", unlocked: UNLOCKED, stock: STOCK, ...overrides });

  it("make the pizzas of the theme ordered much more", () => {
    const night = withTheme();
    const ordinary = { ...night, event: null };
    expect(orderWeight(night, BIANCA)).toBeCloseTo(orderWeight(ordinary, BIANCA) * THEME_ORDER_BOOST);
    expect(orderWeight(night, PROSCIUTTO)).toBeCloseTo(orderWeight(ordinary, PROSCIUTTO));
  });

  it("draw a crowd with two on the menu, fewer people with none", () => {
    const two = withTheme({ recipes: [...makeState().recipes, BIANCA, recipe("c-bianca2", ["pate", "creme", "mozza", "champi"])] });
    expect(themeOnMenu(two)).toBe(2);
    const forecastWithout = forecastCustomers({ ...two, event: null });
    expect(forecastCustomers(two)).toBe(Math.max(3, Math.round(forecastWithout * THEME_CROWD_FACTOR)));
    const none = withTheme({ recipes: [...makeState().recipes, { ...BIANCA, onMenu: false }] });
    expect(themeOnMenu(none)).toBe(0);
    expect(forecastCustomers(none)).toBeLessThan(forecastCustomers({ ...none, event: null }) + 1);
  });

  it("leave dessert pizzas out, and take a margherita for a veggie pizza", () => {
    const veggie = withTheme({ event: "veggieNight" });
    expect(orderWeight(veggie, veggie.recipes[0])).toBeCloseTo(orderWeight({ ...veggie, event: null }, veggie.recipes[0]) * THEME_ORDER_BOOST);
    expect(orderWeight(veggie, PROSCIUTTO)).toBeCloseTo(orderWeight({ ...veggie, event: null }, PROSCIUTTO));
    const dessert = recipe("c-sweet", ["pate", "chocolat", "banane"]);
    expect(orderWeight(veggie, dessert)).toBeCloseTo(orderWeight({ ...veggie, event: null }, dessert));
  });

  it("only come when the recipe book has a pizza for them", () => {
    expect(canHappen(makeState({ day: 8 }), "biancaNight")).toBe(false);
    expect(canHappen(withTheme(), "biancaNight")).toBe(true);
    expect(canHappen(makeState({ day: 8, recipes: [...makeState().recipes, PROSCIUTTO] }), "veggieNight")).toBe(true);
    expect(canHappen(withTheme({ day: 2 }), "biancaNight")).toBe(false);
  });

  it("pay a little more for a pizza of the theme", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const customer = makeCustomer({ recipeId: "c-bianca", ingredients: BIANCA.ingredients, price: 10 });
    const serve = (event: GameState["event"]) => {
      const state = stateInService([customer], { money: 0, recipes: [...makeState().recipes, BIANCA], event, unlocked: UNLOCKED, stock: STOCK });
      const baked = play(state, ...toggle("pate", "creme", "mozza"), { type: "bake" }, { type: "tick", seconds: 6 });
      return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    };
    const night = serve("biancaNight");
    expect(night.money - serve(null).money).toBeCloseTo(1.5);
    expect(night.pops.map((pop) => pop.kind)).toContain("theme");
  });
});

describe("the evening's pace", () => {
  const days = (happyShare: number, stars: number): DayRecord[] =>
    [1, 2, 3].map((day) => ({ day, served: 10, happyServed: Math.round(10 * happyShare), revenue: 0, tips: 0, net: 0, xp: 0, event: null, stars }));

  it("eases off after hard evenings, picks up after easy ones, and waits for three days to tell", () => {
    expect(paceFor(makeState({ history: days(0.3, 1) }))).toBe("gentle");
    expect(paceFor(makeState({ history: days(1, 3) }))).toBe("brisk");
    expect(paceFor(makeState({ history: days(1, 2) }))).toBe("normal");
    expect(paceFor(makeState({ history: days(0.3, 1).slice(0, 2) }))).toBe("normal");
    expect(paceFor(makeState({ history: days(0.3, 1).map(({ happyServed: _happy, ...day }) => day) }))).toBe("normal");
  });

  it("is set when the pizzeria opens: gentle evenings come more slowly and wait more patiently", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const gentle = play(makeState({ history: days(0.3, 1) }), { type: "openRestaurant" });
    expect(serviceOf(gentle).pace).toBe("gentle");
    expect(PACE_ARRIVALS.gentle).toBeGreaterThan(1);
    const service = serviceOf(gentle);
    service.customers = [makeCustomer()];
    service.nextArrivalIn = 99;
    const later = play(gentle, { type: "tick", seconds: 10 });
    expect(serviceOf(later).customers[0].waitedSeconds).toBeCloseTo(8.5);
  });

  it("spaces arrivals out on a gentle evening, closes them up on a brisk one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const firstGap = (pace: "gentle" | "normal" | "brisk") => {
      const state = play(makeState(), { type: "openRestaurant" });
      const service = serviceOf(state);
      service.pace = pace;
      service.nextArrivalIn = 0;
      return serviceOf(play(state, { type: "tick", seconds: 0.1 })).nextArrivalIn;
    };
    const normal = firstGap("normal");
    expect(normal).toBeGreaterThan(0);
    expect(normal).toBeLessThanOrEqual(MAX_SECONDS_BETWEEN_ARRIVALS * 2);
    expect(MIN_SECONDS_BETWEEN_ARRIVALS).toBeGreaterThan(0);
    expect(firstGap("gentle")).toBeCloseTo(normal * PACE_ARRIVALS.gentle);
    expect(firstGap("brisk")).toBeCloseTo(normal * PACE_ARRIVALS.brisk);
  });

  it("is never set for a challenge", () => {
    const state = makeState({ history: days(0.3, 1) });
    state.settings.tutorialDone = true;
    const challenge = play(state, { type: "startChallenge", date: "2026-10-23" });
    expect(serviceOf(challenge).pace).toBeUndefined();
  });

  it("is remembered with each day", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const open = play(makeState(), { type: "openRestaurant" });
    const closed = play(open, { type: "closeEarly" });
    expect(closed.history.at(-1)?.happyServed).toBe(0);
  });
});

describe("morning tips", () => {
  const morning = (overrides: Partial<GameState> = {}): GameState => {
    const state = makeState(overrides);
    state.settings.tutorialDone = true;
    return state;
  };

  it("say what tonight will need from the fridge", () => {
    // A bigger room: more customers than dough tonight.
    const upgrades = { ...makeState().upgrades, salle: 3 };
    const tips = morningTips(morning({ upgrades, stock: { pate: 6, tomate: 30, mozza: 30, basilic: 30 } }));
    expect(tips[0]).toEqual({ key: "stockForTonight", params: { id: "pate", need: expect.any(Number), have: 6 } });
    // Almost out, it is already in the morning's low stock list.
    expect(morningTips(morning({ stock: { pate: 2, tomate: 30, mozza: 30, basilic: 30 } }))).toEqual([]);
  });

  it("point at prices far from the suggested one, pizzas nobody orders, room on the menu, an affordable upgrade", () => {
    const state = morning({ money: 1000, unlocked: UNLOCKED, stock: STOCK, history: [1, 2, 3].map((day) => ({ day, served: 5, revenue: 0, tips: 0, net: 0, xp: 0, event: null })) });
    state.recipes = [{ ...state.recipes[0], price: 40 }, recipe("c-cheap", ["pate", "creme", "mozza", "chevre"], { price: 2, newUntil: 0 }), { ...BIANCA, onMenu: false }];
    state.lifetime.byRecipe = { margherita: { name: null, count: 9 } };
    const keys = morningTips(state).map((tip) => tip.key);
    expect(keys).toEqual(expect.arrayContaining(["overpriced", "underpriced", "neverOrdered", "menuRoom", "upgrade"]));
  });

  it("don't suggest spending while Nonna is owed money", () => {
    expect(morningTips(morning({ money: 1000 })).map((tip) => tip.key)).toContain("upgrade");
    expect(morningTips(morning({ money: 1000, debt: 20 })).map((tip) => tip.key)).not.toContain("upgrade");
  });

  it("count sales migrated from old saves, kept by name", () => {
    const state = morning({ unlocked: UNLOCKED, stock: STOCK, history: [1, 2, 3].map((day) => ({ day, served: 5, revenue: 0, tips: 0, net: 0, xp: 0, event: null })) });
    state.recipes = [...state.recipes, BIANCA];
    state.lifetime.byRecipe = { margherita: { name: null, count: 3 }, bianca: { name: "bianca", count: 4 } };
    expect(morningTips(state).map((tip) => tip.key)).not.toContain("neverOrdered");
  });

  it("read well in every language", () => {
    const tips: Tip[] = [
      { key: "stockForTonight", params: { id: "mozza", need: 12, have: 7 } },
      { key: "overpriced", params: { recipeId: "margherita", recipeName: null, fair: 7.5 } },
      { key: "underpriced", params: { recipeId: "c-bianca", recipeName: "Bianca", fair: 9 } },
      { key: "neverOrdered", params: { recipeId: "c-bianca", recipeName: "Bianca" } },
      { key: "menuRoom", params: { count: 2 } },
      { key: "upgrade", params: { upgradeKey: "oven" } },
    ];
    for (const language of LANGUAGES) {
      const t = createTranslator(language);
      tips.forEach((tip) => {
        const text = translateMessage(t, "prep.tips", tip);
        expect(text, `${language}: ${tip.key}`).not.toMatch(/prep\.tips|undefined|NaN|\{/);
      });
    }
  });

  it("stay quiet during the tutorial, and when all is well", () => {
    expect(morningTips(makeState())).toEqual([]);
    const fine = morning({ money: 0, stock: { pate: 99, tomate: 99, mozza: 99, basilic: 99 } });
    expect(morningTips(fine)).toEqual([]);
  });
});
