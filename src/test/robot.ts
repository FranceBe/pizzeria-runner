// Robots that play the game the way people do, for the long tests (game/simulation*.test.ts): a careful one that makes
// what is ordered, and a sloppy one that also makes the mistakes players make (the wrong pizza, a binned board, a pause,
// a mid-service reload, a restarted day). Both run the morning like a manager: suppliers, upgrades, the menu, the
// market, Nonna when broke. checkInvariants says what must hold whatever they do.
import { expect } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { DRINK_IDS } from "../data/drinks";
import { STORIES } from "../data/stories";
import { COMPETITOR_DAYS } from "../data/competitor";
import { weekOf } from "../game/weekly";
import { canOfferSlice } from "../game/slice";
import { commisMood, MAX_FATIGUE } from "../game/commis";
import { DIFFICULTIES, isEventOn } from "../game/playOptions";
import { UPGRADES, UPGRADE_KEYS } from "../data/progression";
import { BATCH_ID, nextBatchRecipe, openBatch } from "../game/batch";
import { canBorrowFromNonna, forecastCustomers } from "../game/economy";
import { activeMenu } from "../game/menu";
import { levelForXp, menuCapacity } from "../game/progression";
import { gameReducer } from "../game/reducer";
import { destinationOf, maxQueueLength, ovenSlots, selectedCustomer } from "../game/service";
import { hydrateState, toSaveData } from "../game/state";
import type { GameAction, GameState } from "../game/types";
import { toJson } from "./helpers";

// Careful makes what is ordered; sloppy also makes players' mistakes; chaotic, on top of that, does what nobody should
// in the middle of an evening (emptying the menu, deleting a recipe, changing language, buying an oven…).
export type RobotStyle = "careful" | "sloppy" | "chaotic";

const isCount = (value: number): boolean => Number.isFinite(value) && value >= 0;

// What must hold at any moment, whatever was played. `before`: the same game a little earlier, for what only grows.
export const checkInvariants = (state: GameState, before?: GameState): void => {
  expect(Number.isFinite(state.money), "money is a number").toBe(true);
  expect(state.money, "money never goes below zero").toBeGreaterThanOrEqual(-1e-9);
  expect(isCount(state.debt), "debt is a count").toBe(true);
  expect(Number.isFinite(state.xp), "reputation is a number").toBe(true);
  Object.entries(state.stock).forEach(([id, quantity]) => expect(isCount(quantity), `stock of ${id}`).toBe(true));
  expect(isCount(state.secretStock) && isCount(state.mammaStock), "secret jars").toBe(true);
  expect(state.toasts.length, "messages on screen").toBeLessThanOrEqual(4);
  if (before) {
    expect(state.xp, "reputation never goes down").toBeGreaterThanOrEqual(before.xp);
    expect(state.day, "days only move on").toBeGreaterThanOrEqual(before.day);
    expect(state.lifetime.served, "pizzas served only add up").toBeGreaterThanOrEqual(before.lifetime.served);
  }
  const { quest, tonightGoal, service, summary } = state;
  if (quest) {
    expect(quest.progress, "a quest's progress").toBeLessThanOrEqual(quest.target);
    quest.items?.forEach((item) => expect(item.delivered, "a group order's line").toBeLessThanOrEqual(item.count));
  }
  if (tonightGoal && tonightGoal.status === "open" && tonightGoal.kind !== "lightning") {
    expect(tonightGoal.progress, "tonight's goal").toBeLessThanOrEqual(tonightGoal.target);
  }
  if (service && !service.challenge) {
    expect(service.oven.length, "pizzas in the ovens").toBeLessThanOrEqual(ovenSlots(state));
    // A table may sit down together past the queue's length, never more than a table's worth.
    expect(service.customers.length, "customers at the counter").toBeLessThanOrEqual(maxQueueLength(state) + 3);
    expect(service.customersToCome, "customers to come").toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(service.elapsed ?? 0), "the evening's clock").toBe(true);
    service.ready.forEach((pizza) => expect(isCount(pizza.waitingSeconds ?? 0), "a pizza's time on the pass").toBe(true));
    service.customers.forEach((customer) => expect(customer.waitedSeconds, "a customer's wait").toBeGreaterThanOrEqual(0));
    const ids = service.customers.map((customer) => customer.id);
    expect(new Set(ids).size, "customers are each there once").toBe(ids.length);
  }
  if (service?.challenge) expect(isCount(service.challenge.secondsLeft) && isCount(service.challenge.score), "the challenge's clock and score").toBe(true);
  if (summary) {
    [summary.revenue, summary.tips, summary.charges, summary.net, summary.waste, summary.xp].forEach((value) =>
      expect(Number.isFinite(value), "the receipt's figures").toBe(true),
    );
    expect(summary.stars ?? 0).toBeGreaterThanOrEqual(0);
    expect(summary.stars ?? 0).toBeLessThanOrEqual(3);
  }
  state.history.forEach((day) => expect(Number.isFinite(day.net), "a day in the history").toBe(true));
  // Postcards are dated on a day of the game, never one to come.
  Object.values(state.postcards).forEach((day) => expect(day, "a postcard's day").toBeLessThanOrEqual(state.day));
  // The competitor across the street gives up only once its days are over (it may settle in sooner, when the
  // difficulty goes down to gentle).
  if (state.competitor) {
    expect(state.competitor.stars, "the stars against the competitor").toBeGreaterThanOrEqual(0);
    if (state.competitor.outcome === "gaveUp") expect(state.day, "the competitor's days").toBeGreaterThan(state.competitor.firstDay + COMPETITOR_DAYS - 1);
  }
  // A morning never plans what the player switched off.
  if (state.phase === "prep" && state.event) expect(isEventOn(state, state.event), "an event this level doesn't have").toBe(true);
  // The commis: named once hired, their fatigue within bounds.
  if (state.upgrades.commis > 0) expect(state.commis?.name, "a hired commis has a name").toBeTruthy();
  if (state.commis) expect(state.commis.fatigue >= 0 && state.commis.fatigue <= MAX_FATIGUE, "the commis's fatigue").toBe(true);
  // Loyalty only counts what was bought.
  Object.values(state.bought ?? {}).forEach((portions) => expect(isCount(portions), "portions bought").toBe(true));
  // The week's special is a pizza of the menu, of this week or an earlier one (until the next morning tells it).
  if (state.special) {
    expect(state.special.week, "the special's week").toBeLessThanOrEqual(weekOf(state.day));
    expect(isCount(state.special.served), "specials served").toBe(true);
    if (state.special.week === weekOf(state.day)) {
      expect(state.recipes.find((recipe) => recipe.id === state.special?.recipeId)?.onMenu, "the special is on the menu").toBe(true);
    }
  }
  // Stories never run past their last chapter, and only regulars ever had one.
  Object.values(state.customerBook).forEach((entry) => {
    if (!entry.story) return;
    expect(entry.story.chapter, "a story's chapter").toBeGreaterThanOrEqual(0);
    expect(entry.story.chapter, "a story's chapter").toBeLessThanOrEqual(STORIES[entry.story.id].length);
  });
};

// What a save must give back exactly: the game itself. (Loading may add what the game would have added by then: an
// achievement already earned, a morning's goal.)
const GAME_KEYS = ["money", "debt", "xp", "day", "phase", "stock", "unlocked", "upgrades", "recipes", "quest", "weekly", "service", "summary", "customerBook", "event", "festival", "special"] as const;

// A save of the game loads back as the same game, and loading it again changes nothing more.
export const expectSaveRoundTrip = (state: GameState): GameState => {
  const loaded = hydrateState(toJson(toSaveData(state)));
  GAME_KEYS.forEach((key) => expect(JSON.stringify(loaded[key]), `a save gives back ${key}`).toBe(JSON.stringify(state[key])));
  const again = hydrateState(toJson(toSaveData(loaded)));
  expect(JSON.stringify(toSaveData(again)), "loading twice changes nothing more").toBe(JSON.stringify(toSaveData(loaded)));
  return { ...loaded, toasts: state.toasts };
};

const pick = <T>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

// One decision during service.
export const nextMove = (state: GameState, style: RobotStyle, random: () => number = Math.random): GameAction => {
  const service = state.service;
  if (!service) return { type: "tick", seconds: 1 };
  if (service.paused) return { type: "togglePause" };

  if (style === "chaotic") {
    const roll = random();
    const recipe = state.recipes.length ? pick(state.recipes, random) : undefined;
    if (roll < 0.004 && recipe) return { type: "toggleOnMenu", recipeId: recipe.id };
    if (roll < 0.006 && recipe) return { type: "changePrice", recipeId: recipe.id, delta: random() < 0.5 ? -5 : 5 };
    if (roll < 0.007 && recipe && state.recipes.length > 3) return { type: "deleteRecipe", recipeId: recipe.id };
    if (roll < 0.009) return { type: "buyUpgrade", upgradeKey: pick(UPGRADE_KEYS, random) };
    if (roll < 0.010) {
      // Selling an upgrade back, the week's special changed, the commis sent home: each now and then.
      const which = random();
      if (which < 0.5) return { type: "sellUpgrade", upgradeKey: pick(UPGRADE_KEYS, random) };
      if (which < 0.75 && recipe) return { type: "setSpecial", recipeId: recipe.id };
      return { type: "toggleCommisOff" };
    }
    if (roll < 0.012) return { type: "setLanguage", language: random() < 0.5 ? "en" : "fr" };
    if (roll < 0.014) return { type: "offerDrink" };
    if (roll < 0.016) return { type: "craftSecret" };
    if (roll < 0.018 && service.customers.length) return { type: "revealUsualOrder", customerId: pick(service.customers, random).id };
    if (roll < 0.019) return { type: "selectBatch" };
    if (roll < 0.020) return { type: "toggleComfort", option: random() < 0.5 ? "useDrawer" : "commisFade" };
    if (roll < 0.021) return { type: "buyIngredient", ingredientId: pick(INGREDIENTS, random).id, quantity: 1 + Math.floor(random() * 10) };
  }

  // The sloppy one's mistakes, now and then (and the chaotic one's).
  if (style !== "careful") {
    const roll = random();
    if (roll < 0.01) return { type: "togglePause" };
    if (roll < 0.03 && service.board.length) return { type: "trashBoard" };
    if (roll < 0.05) return { type: "toggleIngredient", ingredientId: pick(INGREDIENTS, random).id };
    if (roll < 0.06 && service.board.length) return { type: "bake" };
    if (roll < 0.07 && service.ready.length) return { type: "trashReadyPizza", pizzaId: pick(service.ready, random).id };
    if (roll < 0.08) return { type: "pourDrink", drinkId: pick(DRINK_IDS, random) };
    if (roll < 0.085 && service.customers.length) return { type: "selectCustomer", customerId: pick(service.customers, random).id };
    if (roll < 0.088) return { type: "toggleSecret" };
    if (roll < 0.09) return { type: "toggleMamma" };
    if (roll < 0.095 && service.ready.length) return { type: "offerSlice", pizzaId: pick(service.ready, random).id };
  }

  const servable = service.ready.find((pizza) => destinationOf(state, service, pizza.ingredients));
  if (servable) return { type: "servePizza", pizzaId: servable.id };
  // A pizza nobody wants goes to the queue in slices when someone would enjoy it, else to the bin once they pile up.
  const sliceable = service.ready.find((pizza) => canOfferSlice(state, service, pizza.id));
  if (sliceable) return { type: "offerSlice", pizzaId: sliceable.id };
  if (service.ready.length > 2) return { type: "trashUnwantedPizzas" };
  // Drinks: the selected customer's, poured right (or now and then wrong), and the tray kept moving.
  const trayIndex = (service.tray ?? []).findIndex((id) => service.customers.some((c) => c.drink === id && !c.drinkServed));
  if (trayIndex >= 0) return { type: "serveTrayDrink", index: trayIndex };
  if ((service.tray?.length ?? 0) >= 3) return { type: "binTray" };
  const selected = selectedCustomer(service);
  if (selected?.drink && !selected.drinkServed) return { type: "pourDrink", drinkId: random() < 0.15 ? "eau" : selected.drink };
  const waiting = service.customers.find((customer) => customer.pizzaServed && !customer.drinkServed);
  if (waiting && waiting.id !== service.selectedCustomerId) return { type: "selectCustomer", customerId: waiting.id };
  // The group order: now and then, and always once nobody else is waiting.
  if (openBatch(state, service) && service.selectedCustomerId !== BATCH_ID && (random() < 0.3 || !service.customers.length)) {
    return { type: "selectBatch" };
  }
  // In a challenge the fridge is bottomless.
  const inStock = (id: string): boolean => Boolean(service.challenge) || (state.stock[id as keyof typeof state.stock] ?? 0) > 0;
  const canMake = (ingredients: readonly string[]) => ingredients.every((id) => service.board.includes(id as never) || inStock(id));
  const target = service.selectedCustomerId === BATCH_ID ? nextBatchRecipe(state, service)?.ingredients : selected?.ingredients;
  // Like a player, run to the market when something runs out, if there's the money.
  const needed = [...service.customers.flatMap((customer) => customer.ingredients), ...(target ?? [])];
  const outOf = needed.find((id) => !inStock(id) && state.unlocked[id]);
  if (outOf && state.money > 15) return { type: "buyIngredient", ingredientId: outOf, quantity: 5 };
  // And move on to another order when this one can't be made right now.
  if (!target || !canMake(target)) {
    const doable = service.customers.find((customer) => customer.id !== service.selectedCustomerId && !customer.pizzaServed && canMake(customer.ingredients));
    if (doable) return { type: "selectCustomer", customerId: doable.id };
  }
  if (target) {
    const extra = service.board.find((id) => !target.includes(id));
    if (extra) return { type: "trashBoard" };
    const missing = target.find((id) => !service.board.includes(id) && inStock(id));
    if (missing) return { type: "toggleIngredient", ingredientId: missing };
    if (target.every((id) => service.board.includes(id))) return { type: "bake" };
  }
  return { type: "tick", seconds: 0.5 };
};

// The morning, run like a manager: suppliers and upgrades when there's money to spare, the menu filled, the fridge
// stocked as far as the till allows, Nonna when it doesn't.
export const runMorning = (state: GameState, random: () => number = Math.random): GameState => {
  let next = state;
  const act = (action: GameAction) => (next = gameReducer(next, action));
  const level = levelForXp(next.xp);
  INGREDIENTS.filter((ingredient) => !ingredient.festival && !next.unlocked[ingredient.id] && ingredient.requiredLevel <= level)
    .filter((ingredient) => next.money > ingredient.supplierFee + 80)
    .slice(0, 1)
    .forEach((ingredient) => act({ type: "signSupplier", ingredientId: ingredient.id }));
  const upgrade = UPGRADE_KEYS.map((key) => ({ key, cost: UPGRADES[key].costs[next.upgrades[key]] }))
    .filter((candidate) => candidate.cost !== undefined && next.money > candidate.cost + 100)
    .sort((a, b) => a.cost - b.cost)[0];
  if (upgrade) act({ type: "buyUpgrade", upgradeKey: upgrade.key });
  // The menu, as full as it may be.
  const capacity = menuCapacity(levelForXp(next.xp));
  next.recipes
    .filter((recipe) => !recipe.onMenu)
    .slice(0, Math.max(0, capacity - activeMenu(next).length))
    .forEach((recipe) => act({ type: "toggleOnMenu", recipeId: recipe.id }));
  if (random() < 0.5 && activeMenu(next).length) act({ type: "setSpecial", recipeId: pick(activeMenu(next), random).id });
  // A tired commis gets the evening off, most of the time.
  const commis = commisMood(next);
  if ((commis === "tired" || commis === "exhausted") && random() < 0.7) act({ type: "toggleCommisOff" });
  for (const target of [20, 12, 6, 3]) {
    const money = next.money;
    act({ type: "restock", targetQuantity: target });
    if (next.money !== money) break;
  }
  const canMakeSomething = activeMenu(next).some((recipe) => recipe.ingredients.every((id) => (next.stock[id] ?? 0) > 0));
  if (!canMakeSomething) {
    act({ type: "callNonna" });
    if (canBorrowFromNonna(next)) act({ type: "borrowFromNonna" });
  }
  return next;
};

// A morning nobody should have: upgrades sold back, the menu emptied, prices gone mad, a recipe deleted. The robot's
// manager then puts things right as far as it can (runMorning).
export const messUpMorning = (state: GameState, random: () => number): GameState => {
  let next = state;
  const act = (action: GameAction) => (next = gameReducer(next, action));
  if (random() < 0.4) act({ type: "sellUpgrade", upgradeKey: pick(UPGRADE_KEYS, random) });
  if (random() < 0.2) activeMenu(next).forEach((recipe) => act({ type: "toggleOnMenu", recipeId: recipe.id }));
  if (random() < 0.3 && next.recipes.length) act({ type: "changePrice", recipeId: pick(next.recipes, random).id, delta: random() < 0.5 ? -50 : 50 });
  if (random() < 0.1 && next.recipes.length > 3) act({ type: "deleteRecipe", recipeId: pick(next.recipes, random).id });
  if (random() < 0.2) act({ type: "setSpecial", recipeId: null });
  // A player trying another difficulty level.
  if (random() < 0.15) act({ type: "setDifficulty", difficulty: pick(DIFFICULTIES, random) });
  if (random() < 0.2 && next.recipes.length) act({ type: "setSpecial", recipeId: pick(next.recipes, random).id });
  return next;
};

export interface DayReport {
  state: GameState;
  steps: number;
  closedEarly: boolean;
}

// One evening, from opening to the receipt. The sloppy robot also reloads the game now and then, and once in a while
// restarts the day (and opens again). Gives up and closes early past `maxSteps`.
export const playEvening = (state: GameState, style: RobotStyle, random: () => number, maxSteps = 6000): DayReport => {
  let next = gameReducer(state, { type: "openRestaurant" });
  if (next.phase !== "service") return { state: next, steps: 0, closedEarly: false };
  let steps = 0;
  let restarted = false;
  while (next.phase === "service" && steps < maxSteps) {
    const before = next;
    next = gameReducer(next, nextMove(next, style, random));
    next = gameReducer(next, { type: "tick", seconds: 0.25 });
    steps += 1;
    if (steps % 400 === 0) {
      checkInvariants(next, before);
      // A save taken mid-service loads back, and the evening goes on from it.
      next = expectSaveRoundTrip(next);
    }
    if (style !== "careful" && !restarted && steps === 300 && random() < 0.3) {
      restarted = true;
      next = gameReducer(next, { type: "restartDay" });
      expect(next.phase, "a restarted day is back in its morning").toBe("prep");
      next = gameReducer(next, { type: "openRestaurant" });
    }
  }
  const closedEarly = next.phase === "service";
  if (closedEarly) next = gameReducer(next, { type: "closeEarly" });
  return { state: next, steps, closedEarly };
};

export interface RunOptions {
  days: number;
  style: RobotStyle;
  random: () => number;
  /** Real dates for calendar festivals, one per day in turn. */
  dates?: readonly string[];
  /** Changes the morning before opening (to force an event, say). */
  beforeOpening?: (state: GameState, day: number) => GameState;
  /** Checks a finished day. */
  afterDay?: (report: DayReport, day: number) => void;
}

// Many days in a row: the calendar, the morning, the evening, the receipt, the next day. Every day must end with its
// receipt, every morning must be loadable from a save.
export const playDays = (start: GameState, options: RunOptions): GameState => {
  let state = start;
  for (let day = 0; day < options.days; day++) {
    const morningBefore = state;
    if (options.dates) state = gameReducer(state, { type: "syncCalendar", date: options.dates[day % options.dates.length] });
    state = expectSaveRoundTrip(state);
    state = runMorning(state, options.random);
    if (options.beforeOpening) state = options.beforeOpening(state, day);
    if (!forecastCustomers(state)) {
      // Nobody expected (nothing on the menu): a day that can't open must still be able to move on.
      state = gameReducer(state, { type: "startNextDay" });
      continue;
    }
    const report = playEvening(state, options.style, options.random);
    state = report.state;
    expect(state.phase, `day ${state.day} ends with its receipt`).toBe("summary");
    checkInvariants(state, morningBefore);
    options.afterDay?.(report, day);
    state = gameReducer(state, { type: "startNextDay" });
    expect(state.phase).toBe("prep");
  }
  return state;
};
