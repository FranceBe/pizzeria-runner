// Tonight's goal (data/tonight.ts): drawn each morning, followed through the evening, settled at closing.
import {
  ALL_HOT_MIN_SERVED, LIGHTNING_SECONDS, LIGHTNING_TARGET, ON_TIME_MINUTES, TONIGHT_FROM_DAY, TONIGHT_KINDS, TONIGHT_REWARD, TONIGHT_XP,
  VARIETY_MAX, VARIETY_MIN_MENU, type TonightKind,
} from "../data/tonight";
import { pickRandom } from "../utils/random";
import { eveningMinutes } from "./clock";
import { payBonus } from "./economy";
import { activeMenu } from "./menu";
import { warmthOf } from "./streak";
import { pushToast } from "./toasts";
import type { Customer, GameState, ReadyPizza, Service, TonightGoal } from "./types";

const targetFor = (state: GameState, kind: TonightKind): number => {
  if (kind === "variety") return Math.min(VARIETY_MAX, activeMenu(state).length);
  if (kind === "lightning") return LIGHTNING_TARGET;
  if (kind === "allHot") return ALL_HOT_MIN_SERVED;
  return 1;
};

// Goals the pizzeria can reach tonight.
const possibleKinds = (state: GameState): TonightKind[] =>
  TONIGHT_KINDS.filter((kind) => kind !== "variety" || activeMenu(state).length >= VARIETY_MIN_MENU);

// A new goal for today, from the second day. Mutates state.
export const ensureTonightGoal = (state: GameState): void => {
  if (state.tonightGoal?.day === state.day) return;
  const kinds = possibleKinds(state);
  if (state.day < TONIGHT_FROM_DAY || !kinds.length) {
    state.tonightGoal = null;
    return;
  }
  const kind = pickRandom(kinds);
  state.tonightGoal = { day: state.day, kind, target: targetFor(state, kind), progress: 0, status: "open" };
};

// Today's goal, while it can still be reached (never during a challenge).
const openGoal = (state: GameState, service: Service): TonightGoal | null => {
  const goal = state.tonightGoal;
  return goal && goal.day === state.day && goal.status === "open" && !service.challenge ? goal : null;
};

const reach = (state: GameState, goal: TonightGoal): void => {
  goal.status = "done";
  payBonus(state, TONIGHT_REWARD);
  state.xp += TONIGHT_XP;
  if (state.service) state.service.stats.xp += TONIGHT_XP;
  pushToast(state, { key: "tonightDone", params: { reward: TONIGHT_REWARD } }, "gold");
};

const miss = (state: GameState, goal: TonightGoal): void => {
  goal.status = "missed";
  pushToast(state, { key: "tonightMissed" });
};

// After a pizza is served to a customer (the day's stats already count it). Mutates state.
export const trackTonightServe = (state: GameState, service: Service, customer: Customer, pizza: ReadyPizza): void => {
  const goal = openGoal(state, service);
  if (!goal) return;
  switch (goal.kind) {
    case "allHot":
      if (warmthOf(pizza.waitingSeconds) !== "hot") return miss(state, goal);
      goal.progress = Math.min(goal.target, goal.progress + 1);
      return;
    case "lightning":
      if (customer.waitedSeconds > LIGHTNING_SECONDS) return;
      goal.progress += 1;
      if (goal.progress >= goal.target) reach(state, goal);
      return;
    case "variety":
      goal.progress = Math.min(goal.target, Object.keys(service.stats.byRecipe).length);
      if (goal.progress >= goal.target) reach(state, goal);
      return;
    case "onTime":
      return;
  }
};

// Every tick of the evening: past 23:00 with customers still to serve, the last one won't be served on time.
export const trackTonightClock = (state: GameState, service: Service): void => {
  const goal = openGoal(state, service);
  if (goal?.kind === "onTime" && eveningMinutes(service) > ON_TIME_MINUTES) miss(state, goal);
};

// At closing: the goals that hold all evening are reached if they held; closing early reaches none.
export const settleTonightGoal = (state: GameState, service: Service): void => {
  const goal = openGoal(state, service);
  if (!goal) return;
  const held = !service.closedEarly && ((goal.kind === "allHot" && goal.progress >= goal.target) || (goal.kind === "onTime" && service.stats.served > 0));
  if (held) reach(state, goal);
  else miss(state, goal);
};
