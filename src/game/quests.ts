import { QUEST_CHANCE, QUEST_DAYS, QUEST_GIVERS, FIRST_QUEST_DAY } from "../data/quests";
import { WEDDING_MAX_PIZZAS, WEDDING_MIN_PIZZAS, WEDDING_REWARD_FACTOR } from "../data/events";
import { levelForXp } from "./progression";
import { GOOD_PAIRINGS } from "../data/recipes";
import { pickRandom, randomIndex } from "../utils/random";
import { forecastCustomers, receivePayment } from "./economy";
import { activeMenu } from "./menu";
import { isDiscovered } from "./pairings";
import { isDessert } from "./pizza";
import { pushToast } from "./toasts";
import { BATCH_XP_PER_PIZZA } from "./batch";
import type { BatchItem, Customer, GameState, Quest, Recipe } from "./types";

// How many completed quests the journal remembers.
const QUEST_LOG_SIZE = 30;

type QuestDraft = Omit<Quest, "giver" | "progress" | "deadlineDay">;

// A group order: 4 to 6 pizzas of one to three recipes from the menu. The reward is set when it is delivered.
const groupOrder = (recipes: readonly Recipe[]): QuestDraft => {
  const total = 4 + randomIndex(3);
  const kinds = Math.min(recipes.length, 1 + randomIndex(3));
  const picked = [...recipes].sort(() => Math.random() - 0.5).slice(0, kinds);
  const items: BatchItem[] = picked.map((recipe) => ({ recipeId: recipe.id, recipeName: recipe.name, count: 0, delivered: 0 }));
  for (let pizza = 0; pizza < total; pizza++) items[pizza % items.length].count += 1;
  return { kind: "batch", target: total, items, reward: 0, xp: BATCH_XP_PER_PIZZA * total };
};

// The wedding banquet (a day event): a big group order from the newlyweds, for tonight at 21:00. Null when the menu
// has nothing savoury to offer them.
export const weddingOrder = (state: GameState): Quest | null => {
  const savoury = activeMenu(state).filter((recipe) => !isDessert(recipe.ingredients));
  if (!savoury.length) return null;
  const total = Math.min(WEDDING_MAX_PIZZAS, WEDDING_MIN_PIZZAS + Math.floor(levelForXp(state.xp) / 3) + randomIndex(2));
  const kinds = Math.min(savoury.length, 3);
  const picked = [...savoury].sort(() => Math.random() - 0.5).slice(0, kinds);
  const items: BatchItem[] = picked.map((recipe) => ({ recipeId: recipe.id, recipeName: recipe.name, count: 0, delivered: 0 }));
  for (let pizza = 0; pizza < total; pizza++) items[pizza % items.length].count += 1;
  return {
    kind: "batch",
    giver: "wedding",
    target: total,
    items,
    progress: 0,
    deadlineDay: state.day,
    reward: 0,
    xp: BATCH_XP_PER_PIZZA * total,
    rewardFactor: WEDDING_REWARD_FACTOR,
  };
};

// A wedding day: the banquet becomes tonight's group order. Without one to offer (a quest running, nothing savoury on
// the menu), there is no wedding after all. Mutates state.
export const prepareWedding = (state: GameState): void => {
  if (state.event !== "wedding") return;
  const banquet = state.quest ? null : weddingOrder(state);
  if (banquet) state.quest = banquet;
  else state.event = null;
};

// The quests that make sense right now, given the menu and what is left to discover.
const possibleQuests = (state: GameState): QuestDraft[] => {
  const menu = activeMenu(state);
  const expected = forecastCustomers(state);
  const drafts: QuestDraft[] = [];
  const savoury = menu.filter((recipe) => !isDessert(recipe.ingredients));
  if (savoury.length) drafts.push(groupOrder(savoury));
  if (expected) drafts.push({ kind: "serveTotal", target: Math.round(expected * 2.2), reward: 45, xp: 50 });
  drafts.push({ kind: "happy", target: 8 + randomIndex(5), reward: 30, xp: 40 });
  const canDiscover = GOOD_PAIRINGS.some((pairing) => !isDiscovered(state, pairing) && pairing.every((id) => state.unlocked[id]));
  if (canDiscover) drafts.push({ kind: "pairing", target: 1, reward: 25, xp: 30 });
  if (menu.some((recipe) => isDessert(recipe.ingredients))) drafts.push({ kind: "sweet", target: 5, reward: 40, xp: 45 });
  return drafts;
};

// At the start of a day: maybe a new quest, if none is running. Mutates state.
export const maybeOfferQuest = (state: GameState): void => {
  if (state.quest || state.day < FIRST_QUEST_DAY || Math.random() >= QUEST_CHANCE) return;
  const drafts = possibleQuests(state);
  if (!drafts.length) return;
  const draft = pickRandom(drafts);
  // A group order is for tonight; other quests last a few days.
  const days = draft.kind === "batch" ? 1 : QUEST_DAYS;
  state.quest = { ...draft, giver: pickRandom(QUEST_GIVERS), progress: 0, deadlineDay: state.day + days - 1 };
};

// At the start of a day: a quest past its deadline is simply dropped. Mutates state.
export const expireQuest = (state: GameState): void => {
  if (state.quest && state.day > state.quest.deadlineDay) {
    pushToast(state, { key: "questExpired", params: { giver: state.quest.giver } });
    state.quest = null;
  }
};

const questGain = (quest: Quest, customer: Customer, isHappy: boolean, newPairings: number): number => {
  switch (quest.kind) {
    case "serveRecipe":
      return customer.recipeId === quest.recipeId ? 1 : 0;
    case "serveTotal":
      return 1;
    case "happy":
      return isHappy ? 1 : 0;
    case "pairing":
      return newPairings;
    case "sweet":
      return isDessert(customer.ingredients) ? 1 : 0;
    case "batch":
      // Delivered through its own ticket (see game/batch.ts), not by serving customers.
      return 0;
  }
};

// After a pizza is served. Pays the reward when the quest is complete. Mutates state.
export const advanceQuest = (state: GameState, customer: Customer, isHappy: boolean, newPairings: number): void => {
  const { quest } = state;
  if (!quest) return;
  quest.progress = Math.min(quest.target, quest.progress + questGain(quest, customer, isHappy, newPairings));
  if (quest.progress < quest.target) return;
  receivePayment(state, quest.reward);
  state.xp += quest.xp;
  state.lifetime.questsDone += 1;
  state.lifetime.questRewards += quest.reward;
  if (state.service) state.service.stats.questRewards = (state.service.stats.questRewards ?? 0) + quest.reward;
  const { kind, giver, target, recipeId, recipeName, reward } = quest;
  state.questLog = [...state.questLog, { day: state.day, kind, giver, target, recipeId, recipeName, reward }].slice(-QUEST_LOG_SIZE);
  pushToast(state, { key: "questDone", params: { giver: quest.giver, reward: quest.reward } }, "gold");
  state.quest = null;
};
