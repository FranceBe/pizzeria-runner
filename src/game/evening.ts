// What happens over the evening, besides customers: the rush hour, tonight's group order, a late delivery.
import { LATE_DELIVERY_GIFT, LATE_DELIVERY_SECONDS } from "../data/events";
import { randomBetween } from "../utils/random";
import {
  BATCH_ARRIVES_AFTER, BATCH_GOLD_XP, deliveredCount, medalFor, openBatch, pizzaCount, rewardFor, unfinishedPay,
  batchItemFor,
} from "./batch";
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
export function planEvening(state: GameState, service: Service, customerCount: number): void {
  const isBusy = levelForXp(state.xp) >= RUSH_LEVEL && customerCount >= RUSH_MIN_CUSTOMERS;
  service.rushAtServed = isBusy ? Math.floor(customerCount * randomBetween(0.3, 0.55)) : null;
  const { quest } = state;
  service.batchArrivesIn = quest?.kind === "batch" && quest.deadlineDay === state.day ? BATCH_ARRIVES_AFTER : null;
  service.elapsed = 0;
}

// Every tick: the clock of the evening. Mutates state.
export function advanceEvening(state: GameState, service: Service, seconds: number): void {
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
      if (state.quest) pushToast(state, { key: "batchArrived", params: { giver: state.quest.giver } }, "gold");
    }
  } else if (service.batch) {
    service.batch.elapsed += seconds;
  }

  if (state.event === "lateDelivery" && state.lateIngredient && !service.lateArrived && service.elapsed >= LATE_DELIVERY_SECONDS) {
    service.lateArrived = true;
    state.stock[state.lateIngredient] = (state.stock[state.lateIngredient] || 0) + LATE_DELIVERY_GIFT;
    pushToast(state, { key: "lateArrived", params: { ingredientId: state.lateIngredient, portions: LATE_DELIVERY_GIFT } }, "gold");
  }
}

// After a pizza is served: starts the rush when its moment comes. Mutates the service.
export function maybeStartRush(state: GameState, service: Service): void {
  if (service.rushAtServed == null || service.stats.served < service.rushAtServed) return;
  service.rushAtServed = null;
  service.rush = { secondsLeft: RUSH_SECONDS };
  pushToast(state, { key: "rush" }, "gold");
}

// The ingredient is still on its way (late delivery day).
export const isStillComing = (state: GameState, service: Service, id: string): boolean =>
  state.event === "lateDelivery" && state.lateIngredient === id && !service.lateArrived && !service.challenge;

// Puts a baked pizza on the group order's ticket, and pays the order once it is complete. Mutates state.
export function deliverToBatch(state: GameState, service: Service, pizza: ReadyPizza): void {
  const item = batchItemFor(state, service, pizza.ingredients);
  const quest = openBatch(state, service);
  if (!item || !quest?.items || !service.batch) return;
  service.ready = service.ready.filter((candidate) => candidate.id !== pizza.id);
  item.delivered += 1;
  quest.progress = deliveredCount(quest.items);
  if (quest.progress < pizzaCount(quest.items)) return;

  const medal = medalFor(service.batch.elapsed, pizzaCount(quest.items));
  const reward = rewardFor(state, quest.items, medal);
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
  pushToast(state, { key: "batchDone", params: { giver: quest.giver, medal, reward } }, "gold");
  state.quest = null;
  service.batch = null;
  if (service.selectedCustomerId === "batch") service.selectedCustomerId = service.customers[0]?.id ?? null;
}

// At closing time: a group order that came in but isn't complete pays for what was delivered. Mutates state.
export function settleUnfinishedBatch(state: GameState, service: Service): void {
  const quest = state.quest;
  if (quest?.kind !== "batch" || quest.deadlineDay !== state.day || !quest.items) return;
  const pay = service.batch ? unfinishedPay(state, quest.items) : 0;
  if (pay) {
    receivePayment(state, pay);
    service.stats.questRewards = (service.stats.questRewards ?? 0) + pay;
    state.lifetime.questRewards += pay;
  }
  if (service.batch) pushToast(state, { key: "batchUnfinished", params: { giver: quest.giver, reward: pay } });
  state.quest = null;
  service.batch = null;
  service.batchArrivesIn = null;
}

function logQuest(state: GameState, reward: number, medal: "gold" | "silver" | "bronze"): void {
  const quest = state.quest;
  if (!quest) return;
  const { kind, giver, target, items } = quest;
  state.questLog = [...state.questLog, { day: state.day, kind, giver, target, items, reward, medal }].slice(-QUEST_LOG_SIZE);
}
