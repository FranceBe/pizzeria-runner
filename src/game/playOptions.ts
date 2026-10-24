// A calmer game, for those who want it: the player may switch off day events (each, or a whole family) and other
// features that add pressure (Settings, "Your way of playing"). Everything is on by default. Switched off in the
// morning, what was planned for today goes too; during service, from the next day.
import { DAY_EVENT_IDS, type DayEventId } from "../data/events";
import { COMPETITOR_DAYS } from "../data/competitor";
import type { GameState } from "./types";

export const PLAY_FEATURES = ["rush", "groupOrders", "asUsual", "specialRequests", "quests", "competitor"] as const;
export type PlayFeature = (typeof PLAY_FEATURES)[number];

export const isEventOn = (state: GameState, id: DayEventId): boolean => !state.settings.offEvents?.includes(id);
export const isFeatureOn = (state: GameState, feature: PlayFeature): boolean => !state.settings.offFeatures?.includes(feature);

/** Everything switched off: the calm mode. */
export const isAllOff = (state: GameState): boolean =>
  DAY_EVENT_IDS.every((id) => !isEventOn(state, id)) && PLAY_FEATURES.every((feature) => !isFeatureOn(state, feature));

const withOrWithout = <T>(list: readonly T[], items: readonly T[], off: boolean): T[] =>
  off ? [...new Set([...list, ...items])] : list.filter((item) => !items.includes(item));

// The morning: what was just switched off leaves today's plans. Mutates state.
const applyToToday = (state: GameState): void => {
  if (state.phase !== "prep") return;
  if (state.event && !isEventOn(state, state.event)) {
    // The wedding's banquet goes with it.
    if (state.event === "wedding" && state.quest?.giver === "wedding") state.quest = null;
    state.event = null;
    state.lateIngredient = null;
    state.spoilingIngredient = null;
  }
  const { quest } = state;
  if (quest && quest.giver !== "wedding" && (!isFeatureOn(state, "quests") || (quest.kind === "batch" && !isFeatureOn(state, "groupOrders")))) {
    state.quest = null;
  }
  if (!isFeatureOn(state, "rush")) state.rushPlan = null;
  // The competitor across the street settles in quietly: no more effect on customers, no stars to count.
  const competitor = state.competitor;
  const isRunning = competitor && !competitor.outcome && state.day <= competitor.firstDay + COMPETITOR_DAYS - 1;
  if (!isFeatureOn(state, "competitor") && competitor && isRunning) competitor.outcome = "stayed";
};

// Mutates state.
export const setEventsOff = (state: GameState, events: readonly DayEventId[], off: boolean): void => {
  state.settings.offEvents = withOrWithout(state.settings.offEvents ?? [], events, off);
  applyToToday(state);
};

// Mutates state.
export const setFeaturesOff = (state: GameState, features: readonly PlayFeature[], off: boolean): void => {
  state.settings.offFeatures = withOrWithout(state.settings.offFeatures ?? [], features, off);
  applyToToday(state);
};
