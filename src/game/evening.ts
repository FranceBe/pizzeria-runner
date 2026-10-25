// What happens over the evening, besides customers: the rush hour, tonight's group order, a late delivery.
import { WEDDING_TIME, HALFTIME_SECONDS, LATE_DELIVERY_GIFT, LATE_DELIVERY_SECONDS, MATCH_FIRST_HALF_PACE, MATCH_HALFTIME, MATCH_KICKOFF } from "../data/events";
import {
  BATCH_ARRIVES_AFTER, BATCH_GOLD_XP, deliveredCount, medalFor, openBatch, pizzaCount, rewardFor, unfinishedPay,
  batchItemFor,
} from "./batch";
import { eveningMinutes, expectedEveningSeconds, secondsUntil } from "./clock";
import { receivePayment } from "./economy";
import { planMysteryGuest } from "./mystery";
import { sendPostcard } from "./postcards";
import { levelForXp } from "./progression";
import { pushPop, pushToast } from "./toasts";
import { isFeatureOn } from "./playOptions";
import { commisProfile } from "./staff";
import { recordWeekly } from "./weekly";
import type { GameState, ReadyPizza, Service } from "./types";

// Rush hour: from this level, once in a busy evening, at a time drawn in the morning (so it can be announced), the
// kitchen warned a little before.
export const RUSH_LEVEL = 3;
export const RUSH_MIN_CUSTOMERS = 8;
export const RUSH_EARLIEST = 20 * 60 + 15;
export const RUSH_LATEST = 21 * 60 + 15;
export const RUSH_WARNING_MINUTES = 15;
// The shape of an evening: customers come a little more slowly while it opens and as it winds down, a little faster
// in between (on the whole, an evening lasts about as long).
export const CALM_UNTIL = 19 * 60 + 40;
export const WIND_DOWN_FROM = 22 * 60 + 15;
export const CALM_PACE = 1.3;
export const BUSY_PACE = 0.85;
export const RUSH_SECONDS = 40;
// During the rush, customers come in this much faster and tips are multiplied by RUSH_TIP_FACTOR.
export const RUSH_ARRIVAL_FACTOR = 0.4;
export const RUSH_TIP_FACTOR = 2;

const QUEST_LOG_SIZE = 30;

// A rush tonight: a pizzeria big enough, an evening busy enough, and not a match (it has its own, at half-time).
export const isRushEvening = (state: GameState, customerCount: number): boolean =>
  levelForXp(state.xp) >= RUSH_LEVEL && customerCount >= RUSH_MIN_CUSTOMERS && state.event !== "match" && isFeatureOn(state, "rush");

// Each morning, from the level of rushes: when tonight's would come (whether it comes depends on the evening being
// busy enough, at opening). Mutates state.
export const ensureRushPlan = (state: GameState): void => {
  if (state.rushPlan?.day === state.day) return;
  const steps = (RUSH_LATEST - RUSH_EARLIEST) / 5;
  state.rushPlan = levelForXp(state.xp) >= RUSH_LEVEL && isFeatureOn(state, "rush") ? { day: state.day, at: RUSH_EARLIEST + 5 * Math.floor(Math.random() * (steps + 1)) } : null;
};

// Tonight's rush, as announced in the morning: its time, or null.
export const tonightsRush = (state: GameState, customerCount: number): number | null =>
  state.rushPlan?.day === state.day && isRushEvening(state, customerCount) ? state.rushPlan.at : null;

// When the restaurant opens: plans the rush and the group order. Mutates the service.
export const planEvening = (state: GameState, service: Service, customerCount: number): void => {
  service.rushAtMinutes = tonightsRush(state, customerCount);
  service.rushWarned = false;
  const { quest } = state;
  const isGroupOrderTonight = quest?.kind === "batch" && quest.deadlineDay === state.day;
  // The wedding banquet comes at its time on the evening's clock; a neighbourhood group order soon after opening.
  service.expectedSeconds = expectedEveningSeconds(customerCount);
  service.batchArrivesIn = !isGroupOrderTonight ? null : quest.giver === "wedding" ? secondsUntil(WEDDING_TIME, service.expectedSeconds) : BATCH_ARRIVES_AFTER;
  service.elapsed = 0;
  planMysteryGuest(state, service, customerCount);
};

// Every tick: the clock of the evening. Mutates state.
export const advanceEvening = (state: GameState, service: Service, seconds: number): void => {
  service.elapsed = (service.elapsed ?? 0) + seconds;
  // A careful commis keeps the pizzas on the pass warm longer (data/staff.ts).
  const cooling = seconds * (commisProfile(state)?.warmth ?? 1);
  service.ready.forEach((pizza) => (pizza.waitingSeconds = (pizza.waitingSeconds ?? 0) + cooling));

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
  followRush(state, service);

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
    sendPostcard(state, "matchNight");
  }
};

// Tonight's rush: the kitchen warned a little before, then customers in quick succession. Mutates state.
const followRush = (state: GameState, service: Service): void => {
  const at = service.rushAtMinutes;
  if (at == null) return;
  const minutes = eveningMinutes(service);
  if (!service.rushWarned && minutes >= at - RUSH_WARNING_MINUTES) {
    service.rushWarned = true;
    pushToast(state, { key: "rushSoon", params: { minutes: RUSH_WARNING_MINUTES } }, "warn");
  }
  if (minutes < at) return;
  service.rushAtMinutes = null;
  service.rush = { secondsLeft: RUSH_SECONDS };
  pushToast(state, { key: "rush" }, "gold");
  sendPostcard(state, "rush");
};

// The evening's shape on its clock: calmer while it opens and as it winds down, busier in between.
export const curvePace = (minutes: number): number => (minutes < CALM_UNTIL || minutes >= WIND_DOWN_FROM ? CALM_PACE : BUSY_PACE);

// How much more slowly customers come right now: the evening's shape, and during the first half of a match, everyone
// is watching it.
export const arrivalPace = (state: GameState, service: Service): number =>
  curvePace(eveningMinutes(service)) * (state.event === "match" && service.matchKickedOff && !service.halftimeCame ? MATCH_FIRST_HALF_PACE : 1);

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
  if (quest.giver === "wedding") {
    pushToast(state, { key: "weddingDone", params: { medal, reward } }, "gold");
    sendPostcard(state, "wedding");
  }
  if (quest.giver !== "wedding") pushToast(state, { key: "batchDone", params: { giver: quest.giver, medal, reward } }, "gold");
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
