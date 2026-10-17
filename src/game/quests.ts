import { QUEST_CHANCE, QUEST_DAYS, QUEST_GIVERS, FIRST_QUEST_DAY } from "../data/quests";
import { GOOD_PAIRINGS } from "../data/recipes";
import { pickRandom, randomIndex } from "../utils/random";
import { forecastCustomers, receivePayment } from "./economy";
import { activeMenu } from "./menu";
import { isDiscovered } from "./pairings";
import { isDessert } from "./pizza";
import { pushToast } from "./toasts";
import type { Customer, GameState, Quest } from "./types";

type QuestDraft = Omit<Quest, "giver" | "progress" | "deadlineDay">;

// The quests that make sense right now, given the menu and what is left to discover.
function possibleQuests(state: GameState): QuestDraft[] {
  const menu = activeMenu(state);
  const expected = forecastCustomers(state);
  const drafts: QuestDraft[] = [];
  const savoury = menu.filter((recipe) => !isDessert(recipe.ingredients));
  if (savoury.length) {
    const recipe = pickRandom(savoury);
    drafts.push({ kind: "serveRecipe", target: 4 + randomIndex(3), recipeId: recipe.id, recipeName: recipe.name, reward: 35, xp: 40 });
  }
  if (expected) drafts.push({ kind: "serveTotal", target: Math.round(expected * 2.2), reward: 45, xp: 50 });
  drafts.push({ kind: "happy", target: 8 + randomIndex(5), reward: 30, xp: 40 });
  const canDiscover = GOOD_PAIRINGS.some((pairing) => !isDiscovered(state, pairing) && pairing.every((id) => state.unlocked[id]));
  if (canDiscover) drafts.push({ kind: "pairing", target: 1, reward: 25, xp: 30 });
  if (menu.some((recipe) => isDessert(recipe.ingredients))) drafts.push({ kind: "sweet", target: 5, reward: 40, xp: 45 });
  return drafts;
}

// At the start of a day: maybe a new quest, if none is running. Mutates state.
export function maybeOfferQuest(state: GameState): void {
  if (state.quest || state.day < FIRST_QUEST_DAY || Math.random() >= QUEST_CHANCE) return;
  const drafts = possibleQuests(state);
  if (!drafts.length) return;
  state.quest = { ...pickRandom(drafts), giver: pickRandom(QUEST_GIVERS), progress: 0, deadlineDay: state.day + QUEST_DAYS - 1 };
}

// At the start of a day: a quest past its deadline is simply dropped. Mutates state.
export function expireQuest(state: GameState): void {
  if (state.quest && state.day > state.quest.deadlineDay) {
    pushToast(state, { key: "questExpired", params: { giver: state.quest.giver } });
    state.quest = null;
  }
}

function questGain(quest: Quest, customer: Customer, isHappy: boolean, newPairings: number): number {
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
  }
}

// After a pizza is served. Pays the reward when the quest is complete. Mutates state.
export function advanceQuest(state: GameState, customer: Customer, isHappy: boolean, newPairings: number): void {
  const { quest } = state;
  if (!quest) return;
  quest.progress = Math.min(quest.target, quest.progress + questGain(quest, customer, isHappy, newPairings));
  if (quest.progress < quest.target) return;
  receivePayment(state, quest.reward);
  state.xp += quest.xp;
  state.lifetime.questsDone += 1;
  pushToast(state, { key: "questDone", params: { giver: quest.giver, reward: quest.reward } }, "gold");
  state.quest = null;
}
