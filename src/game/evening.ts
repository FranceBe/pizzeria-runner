// What happens over the evening, besides customers: the rush hour, tonight's group order, a late delivery.
import { WEDDING_TIME, HALFTIME_SECONDS, LATE_DELIVERY_GIFT, LATE_DELIVERY_SECONDS, MATCH_FIRST_HALF_PACE, MATCH_HALFTIME, MATCH_KICKOFF } from "../data/events";
import { randomBetween } from "../utils/random";
import {
  BATCH_ARRIVES_AFTER, BATCH_GOLD_XP, deliveredCount, medalFor, openBatch, pizzaCount, rewardFor, unfinishedPay,
  batchItemFor,
} from "./batch";
import { eveningMinutes, expectedEveningSeconds, secondsUntil } from "./clock";
import { receivePayment } from "./economy";
import { levelForXp } from "./progression";
import { pushPop, pushToast } from "./toasts";
import { recordWeekly } from "./weekly";
import type { GameState, ReadyPizza, Service } from "./types";

// Rush hour: from this level, once in a busy evening, after a share of the pizzas are served.
const RUSH_LEVEL = 3;
const RUSH_MIN_CUSTOMERS = 8;
export const RUSH_SECONDS = 40;
// During the rush, customers come in this much faster and tips are multiplied by RUSH_TIP_FACTOR.
export const RUSH_ARRIVAL_FACTOR = 0.4;
export const RUSH_TIP_FACTOR = 2;

const QUEST_LOG_SIZE = 30;

// When the restaurant opens: plans the rush and the group order. Mutates the service.
export const planEvening = (state: GameState, service: Service, customerCount: number): void => {
  // A match evening has its own rush, at half-time.
  const isBusy = levelForXp(state.xp) >= RUSH_LEVEL && customerCount >= RUSH_MIN_CUSTOMERS && state.event !== "match";
  service.rushAtServed = isBusy ? Math.floor(customerCount * randomBetween(0.3, 0.55)) : null;
  const { quest } = state;
  const isGroupOrderTonight = quest?.kind === "batch" && quest.deadlineDay === state.day;
  // The wedding banquet comes at its time on the evening's clock; a neighbourhood group order soon after opening.
  service.expectedSeconds = expectedEveningSeconds(customerCount);
  service.batchArrivesIn = !isGroupOrderTonight ? null : quest.giver === "wedding" ? secondsUntil(WEDDING_TIME, service.expectedSeconds) : BATCH_ARRIVES_AFTER;
  service.elapsed = 0;
};

// Every tick: the clock of the evening. Mutates state.
export const advanceEvening = (state: GameState, service: Service, seconds: number): void => {
  service.elapsed = (service.elapsed ?? 0) + seconds;
  service.ready.forEach((pizza) => (pizza.waitingSeconds = (pizza.waitingSeconds ?? 0) + seconds));

  if (service.rush) {
    service.rush.secondsLeft -= seconds;
    if (service.rush.secondsLeft <= 0) service.rush = null;
  }

  if (service.batchArrivesIn != null) {
    service.batchArrivesIn -= seconds;
    if (service.batchArrivesIn <= 0) {
      service.batchArrivesIn = null;
      service.batch = { elapsed: 0 };
      if (state.quest?.giver === "wedding") pushToast(state, { key: "weddingArrived", params: { count: state.quest.target } }, "gold");
      else if (state.quest) pushToast(state, { key: "batchArrived", params: { giver: state.quest.giver } }, "gold");
    }
  } else if (service.batch) {
    service.batch.elapsed += seconds;
  }

  if (state.event === "match") followMatch(state, service);

  if (state.event === "lateDelivery" && state.lateIngredient && !service.lateArrived && service.elapsed >= LATE_DELIVERY_SECONDS) {
    service.lateArrived = true;
    state.stock[state.lateIngredient] = (state.stock[state.lateIngredient] || 0) + LATE_DELIVERY_GIFT;
    pushToast(state, { key: "lateArrived", params: { ingredientId: state.lateIngredient, portions: LATE_DELIVERY_GIFT } }, "gold");
  }
};

// The match on TV: the kick-off empties the street a little, half-time brings everyone in at once. Mutates state.
const followMatch = (state: GameState, service: Service): void => {
  const minutes = eveningMinutes(service);
  if (!service.matchKickedOff && minutes >= MATCH_KICKOFF) {
    service.matchKickedOff = true;
    pushToast(state, { key: "kickoff" });
  }
  if (!service.halftimeCame && minutes >= MATCH_HALFTIME) {
    service.halftimeCame = true;
    service.rush = { secondsLeft: HALFTIME_SECONDS };
    // The first of them is at the door already.
    service.nextArrivalIn = Math.min(service.nextArrivalIn, 0.5);
    pushToast(state, { key: "halftime" }, "gold");
  }
};

// How much more slowly customers come right now: during the first half of the match, everyone is watching it.
export const arrivalPace = (state: GameState, service: Service): number =>
  state.event === "match" && service.matchKickedOff && !service.halftimeCame ? MATCH_FIRST_HALF_PACE : 1;

// Tonight's group order hasn't come in yet, or isn't complete: the evening isn't over without it. (Closing early is
// always there to give up on it.)
// One it can no longer be completed (a recipe of it deleted from the book meanwhile) holds nothing.
export const isGroupOrderPending = (state: GameState, service: Service): boolean => {
  const items = state.quest?.kind === "batch" ? state.quest.items : undefined;
  if (!items) return false;
  const canBeCompleted = items.every((item) => item.delivered >= item.count || state.recipes.some((recipe) => recipe.id === item.recipeId));
  return canBeCompleted && (service.batchArrivesIn != null || Boolean(service.batch));
};

// Nobody else left to serve before tonight's group order comes in: it comes in now rather than keeping the kitchen
// waiting. Mutates the service.
export const bringGroupOrderForward = (service: Service): void => {
  if (service.batchArrivesIn != null && service.customersToCome === 0 && service.customers.length === 0) service.batchArrivesIn = 0;
};

// The last customer of the evening came in: said once, so the end is in sight. Mutates state.
export const announceLastOrders = (state: GameState, service: Service): void => {
  if (service.lastOrdersSaid || service.customersToCome > 0 || service.challenge) return;
  service.lastOrdersSaid = true;
  pushToast(state, { key: "lastOrders" });
};

// After a pizza is served: starts the rush when its moment comes. Mutates the service.
export const maybeStartRush = (state: GameState, service: Service): void => {
  if (service.rushAtServed == null || service.stats.served < service.rushAtServed) return;
  service.rushAtServed = null;
  service.rush = { secondsLeft: RUSH_SECONDS };
  pushToast(state, { key: "rush" }, "gold");
};

// The ingredient is still on its way (late delivery day).
export const isStillComing = (state: GameState, service: Service, id: string): boolean =>
  state.event === "lateDelivery" && state.lateIngredient === id && !service.lateArrived && !service.challenge;

// Puts a baked pizza on the group order's ticket, and pays the order once it is complete. Mutates state.
export const deliverToBatch = (state: GameState, service: Service, pizza: ReadyPizza): void => {
  const item = batchItemFor(state, service, pizza.ingredients);
  const quest = openBatch(state, service);
  if (!item || !quest?.items || !service.batch) return;
  service.ready = service.ready.filter((candidate) => candidate.id !== pizza.id);
  item.delivered += 1;
  quest.progress = deliveredCount(quest.items);
  if (quest.progress < pizzaCount(quest.items)) return;

  const medal = medalFor(service.batch.elapsed, pizzaCount(quest.items));
  const reward = rewardFor(state, quest.items, medal, quest.rewardFactor);
  receivePayment(state, reward);
  pushPop(state, reward, "batch");
  state.xp += quest.xp + (medal === "gold" ? BATCH_GOLD_XP : 0);
  service.stats.questRewards = (service.stats.questRewards ?? 0) + reward;
  const { lifetime } = state;
  lifetime.questsDone += 1;
  lifetime.questRewards += reward;
  if (medal === "gold") {
    lifetime.batchGolds += 1;
    recordWeekly(state, "batchGold", 1);
  }
  logQuest(state, reward, medal);
  if (quest.giver === "wedding") pushToast(state, { key: "weddingDone", params: { medal, reward } }, "gold");
  else pushToast(state, { key: "batchDone", params: { giver: quest.giver, medal, reward } }, "gold");
  state.quest = null;
  service.batch = null;
  if (service.selectedCustomerId === "batch") service.selectedCustomerId = service.customers[0]?.id ?? null;
};

// At closing time: a group order that came in but isn't complete pays for what was delivered. Mutates state.
export const settleUnfinishedBatch = (state: GameState, service: Service): void => {
  const quest = state.quest;
  if (quest?.kind !== "batch" || quest.deadlineDay !== state.day || !quest.items) return;
  const pay = service.batch ? unfinishedPay(state, quest.items) : 0;
  if (pay) {
    receivePayment(state, pay);
    service.stats.questRewards = (service.stats.questRewards ?? 0) + pay;
    state.lifetime.questRewards += pay;
  }
  if (service.batch && quest.giver === "wedding") pushToast(state, { key: "weddingUnfinished", params: { reward: pay } });
  else if (service.batch) pushToast(state, { key: "batchUnfinished", params: { giver: quest.giver, reward: pay } });
  state.quest = null;
  service.batch = null;
  service.batchArrivesIn = null;
};

const logQuest = (state: GameState, reward: number, medal: "gold" | "silver" | "bronze"): void => {
  const quest = state.quest;
  if (!quest) return;
  const { kind, giver, target, items } = quest;
  state.questLog = [...state.questLog, { day: state.day, kind, giver, target, items, reward, medal }].slice(-QUEST_LOG_SIZE);
};
