import { describe, it, expect } from "vitest";
import { makeState, play, serviceOf } from "../test/helpers";
import { WEDDING_MAX_PIZZAS, WEDDING_MIN_PIZZAS, WEDDING_TIME } from "../data/events";
import { BATCH_ARRIVES_AFTER, BATCH_ID, nextBatchRecipe, pizzaCount, rewardFor } from "./batch";
import { secondsUntil } from "./clock";
import { canHappen } from "./events";
import { prepareWedding, weddingOrder } from "./quests";
import type { GameState, Quest } from "./types";

const weddingDay = (overrides: Partial<GameState> = {}): GameState => {
  const state = makeState({ day: 8, xp: 4000, event: "wedding", ...overrides });
  prepareWedding(state);
  return state;
};
// Bakes and serves one pizza for the banquet, as a player would (the pizza lands on the pass baked).
const deliverOne = (state: GameState): GameState => {
  const recipe = nextBatchRecipe(state, serviceOf(state));
  if (!recipe) throw new Error("nothing left to make");
  const service = serviceOf(state);
  const withPizza = { ...state, service: { ...service, selectedCustomerId: BATCH_ID, ready: [...service.ready, { id: `b${service.ready.length}-${Math.random()}`, ingredients: [...recipe.ingredients], waitingSeconds: 0 }] } };
  return play(withPizza, { type: "servePizza", pizzaId: withPizza.service.ready.at(-1)!.id });
};
// Opens, lets everyone through and serves nobody: just the banquet left.
const openedWithNobodyLeft = (state: GameState): GameState => {
  const opened = play(state, { type: "openRestaurant" });
  return { ...opened, service: { ...serviceOf(opened), customersToCome: 0, customers: [] } };
};

describe("the wedding banquet", () => {
  it("is a big group order from the newlyweds, for tonight, paid half as much again", () => {
    const state = weddingDay();
    const quest = state.quest as Quest;
    expect(quest).toMatchObject({ kind: "batch", giver: "wedding", deadlineDay: state.day, rewardFactor: 1.5 });
    const count = pizzaCount(quest.items ?? []);
    expect(count).toBeGreaterThanOrEqual(WEDDING_MIN_PIZZAS);
    expect(count).toBeLessThanOrEqual(WEDDING_MAX_PIZZAS);
    expect(quest.target).toBe(count);
    expect(rewardFor(state, quest.items ?? [], "gold", quest.rewardFactor)).toBeGreaterThan(rewardFor(state, quest.items ?? [], "gold"));
  });

  it("doesn't happen while a quest runs, or without anything savoury to serve", () => {
    const busy = makeState({ day: 8, quest: { kind: "happy", giver: "school", target: 8, progress: 0, deadlineDay: 10, reward: 30, xp: 40 } });
    expect(canHappen(busy, "wedding")).toBe(false);
    expect(canHappen(makeState({ day: 8 }), "wedding")).toBe(true);
    expect(canHappen(makeState({ day: 5 }), "wedding")).toBe(false);
    // Rolled anyway (say, the quest came after): no wedding after all, the quest is kept.
    const rolled = makeState({ day: 8, event: "wedding", quest: busy.quest });
    prepareWedding(rolled);
    expect(rolled.event).toBeNull();
    expect(rolled.quest?.kind).toBe("happy");
    const sweetOnly = makeState({ day: 8, event: "wedding" });
    sweetOnly.recipes = sweetOnly.recipes.map((recipe) => ({ ...recipe, onMenu: false }));
    expect(weddingOrder(sweetOnly)).toBeNull();
  });

  it("comes in at 21:00 on the evening's clock, not soon after opening", () => {
    const opened = play(weddingDay(), { type: "openRestaurant" });
    const service = serviceOf(opened);
    expect(service.batchArrivesIn).toBeCloseTo(secondsUntil(WEDDING_TIME, service.expectedSeconds ?? 0));
    expect(service.batchArrivesIn).toBeGreaterThan(BATCH_ARRIVES_AFTER);
  });

  it("keeps the evening open for it, and comes in early once nobody else is left", () => {
    const waiting = play(openedWithNobodyLeft(weddingDay()), { type: "tick", seconds: 0.5 });
    expect(waiting.phase).toBe("service");
    expect(serviceOf(waiting).batch).toBeTruthy();
    expect(waiting.toasts.map((toast) => toast.key)).toContain("weddingArrived");
  });

  it("ends the evening once served, paid with its medal", () => {
    let state = play(openedWithNobodyLeft(weddingDay()), { type: "tick", seconds: 0.5 });
    const count = pizzaCount(state.quest?.items ?? []);
    const before = state.money;
    for (let pizza = 0; pizza < count; pizza++) state = deliverOne(state);
    expect(state.phase).toBe("summary");
    expect(state.quest).toBeNull();
    expect(state.money).toBeGreaterThan(before);
    expect(state.summary?.questRewards).toBeGreaterThan(0);
    expect(state.questLog.at(-1)?.giver).toBe("wedding");
  });

  it("pays what arrived when the kitchen closes before it is complete", () => {
    let state = play(openedWithNobodyLeft(weddingDay()), { type: "tick", seconds: 0.5 });
    state = deliverOne(deliverOne(state));
    expect(state.phase).toBe("service");
    const closed = play(state, { type: "closeEarly" });
    expect(closed.phase).toBe("summary");
    expect(closed.quest).toBeNull();
    expect(closed.toasts.map((toast) => toast.key)).toContain("weddingUnfinished");
  });

  it("holds nothing once it can't be completed: a recipe of it deleted mid-service", () => {
    const state = play(openedWithNobodyLeft(weddingDay()), { type: "tick", seconds: 0.5 });
    const items = state.quest?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    const { recipeId } = items[0];
    // The evening ends at once, on its own, and the banquet is paid for what arrived.
    const ended = play(state, { type: "deleteRecipe", recipeId }, { type: "tick", seconds: 0.25 });
    expect(ended.phase).toBe("summary");
    expect(ended.quest).toBeNull();
  });

  it("doesn't hold a neighbourhood group order's evening either until it comes in", () => {
    const state = makeState({ day: 8 });
    state.quest = { kind: "batch", giver: "bakery", target: 1, progress: 0, deadlineDay: 8, reward: 0, xp: 8, items: [{ recipeId: "margherita", recipeName: null, count: 1, delivered: 0 }] };
    const after = play(openedWithNobodyLeft(state), { type: "tick", seconds: 0.5 });
    expect(after.phase).toBe("service");
    expect(after.toasts.map((toast) => toast.key)).toContain("batchArrived");
    expect(deliverOne(after).phase).toBe("summary");
  });
});
