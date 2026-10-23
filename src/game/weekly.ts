import { SEASON_DAYS } from "../data/seasons";
import { WEEKLY_BONUS, WEEKLY_COUNT, WEEKLY_KINDS, WEEKLY_REWARD, WEEKLY_XP, type WeeklyKind } from "../data/weekly";
import { pickRandom } from "../utils/random";
import { payBonus } from "./economy";
import { activeMenu } from "./menu";
import { isDessert } from "./pizza";
import { levelForXp } from "./progression";
import { pushToast } from "./toasts";
import type { GameState, Weekly } from "./types";

export const weekOf = (day: number): number => Math.floor((day - 1) / SEASON_DAYS);

const TARGETS: Record<WeeklyKind, number> = { happy: 20, tables: 3, desserts: 6, drinks: 10, streak: 8, batchGold: 1, served: 40, tips: 30 };

// Missions that can be done with what the pizzeria has.
const possibleKinds = (state: GameState): WeeklyKind[] => {
  return WEEKLY_KINDS.filter((kind) => {
    if (kind === "tables") return levelForXp(state.xp) >= 3;
    if (kind === "desserts") return activeMenu(state).some((recipe) => isDessert(recipe.ingredients));
    if (kind === "drinks") return state.upgrades.bar > 0;
    if (kind === "batchGold") return state.day >= 4;
    return true;
  });
};

const newWeek = (state: GameState): Weekly => {
  const kinds = possibleKinds(state);
  const chosen: WeeklyKind[] = [];
  while (chosen.length < WEEKLY_COUNT && chosen.length < kinds.length) {
    const kind = pickRandom(kinds.filter((candidate) => !chosen.includes(candidate)));
    chosen.push(kind);
  }
  return { week: weekOf(state.day), missions: chosen.map((kind) => ({ kind, target: TARGETS[kind], progress: 0, done: false })), bonusPaid: false };
};

// A new set of missions when a new week starts. Mutates state.
export const ensureWeek = (state: GameState): void => {
  if (!state.weekly || state.weekly.week !== weekOf(state.day)) state.weekly = newWeek(state);
};

// Adds to a mission's progress ("max" for records, like the best streak), and pays it once done. Mutates state.
export const recordWeekly = (state: GameState, kind: WeeklyKind, amount: number, mode: "add" | "max" = "add"): void => {
  const weekly = state.weekly;
  const mission = weekly?.missions.find((candidate) => candidate.kind === kind && !candidate.done);
  if (!weekly || !mission) return;
  mission.progress = Math.min(mission.target, mode === "max" ? Math.max(mission.progress, amount) : mission.progress + amount);
  if (mission.progress < mission.target) return;
  mission.done = true;
  payBonus(state, WEEKLY_REWARD);
  state.xp += WEEKLY_XP;
  pushToast(state, { key: "weeklyDone", params: { reward: WEEKLY_REWARD } }, "gold");
  if (!weekly.bonusPaid && weekly.missions.every((candidate) => candidate.done)) {
    weekly.bonusPaid = true;
    payBonus(state, WEEKLY_BONUS);
    pushToast(state, { key: "weeklyAllDone", params: { reward: WEEKLY_BONUS } }, "gold");
  }
};
