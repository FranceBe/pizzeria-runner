// How hard the game is, picked in Settings: five levels, normal by default. A level sets how often day events come and
// which ones, how many things out of the ordinary a day may hold (game/dayLoad.ts), and which features that add
// pressure are on. Changed in the morning, today's plans follow at once; during service, from the next day.
import { COMPETITOR_DAYS } from "../data/competitor";
import { DAY_EVENTS, EVENT_CATEGORIES, EVENT_CHANCE, type DayEventId, type EventCategory } from "../data/events";
import type { GameState } from "./types";

export const DIFFICULTIES = ["gentle", "easy", "normal", "hard", "hardcore"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DEFAULT_DIFFICULTY: Difficulty = "normal";
export const isDifficulty = (value: unknown): value is Difficulty => DIFFICULTIES.includes(value as Difficulty);

export type PlayFeature = "rush" | "groupOrders" | "asUsual" | "specialRequests" | "quests" | "competitor";

interface DifficultyRules {
  /** The chance a day has an event (from the first event day). */
  eventChance: number;
  /** Multiplies each family's events' weights (0: none of them). */
  weights: Record<EventCategory, number>;
  /** Only these events, when set. */
  only?: readonly DayEventId[];
  /** Things out of the ordinary a day may hold (see game/dayLoad.ts). */
  maxHappenings: number;
  /** Features switched off. */
  off: readonly PlayFeature[];
}

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  // Just pizzas: only the kindest events (a market, sunshine, rain bringing generous customers), nothing timed.
  gentle: {
    eventChance: 0.35,
    weights: { weather: 1, incidents: 0, evenings: 0 },
    only: ["market", "rain", "sunny"],
    maxHappenings: 2,
    off: ["rush", "groupOrders", "asUsual", "specialRequests", "competitor"],
  },
  // Fewer events, the trying ones rarer still.
  easy: { eventChance: 0.35, weights: { weather: 1, incidents: 0.35, evenings: 0.7 }, maxHappenings: 3, off: [] },
  normal: { eventChance: EVENT_CHANCE, weights: { weather: 1, incidents: 1, evenings: 1 }, maxHappenings: 3, off: [] },
  // An event most days, incidents twice as likely, a day may hold more.
  hard: { eventChance: 0.8, weights: { weather: 0.7, incidents: 2, evenings: 1.3 }, maxHappenings: 4, off: [] },
  // An event every day, incidents three times as likely, no limit to what a day holds.
  hardcore: { eventChance: 1, weights: { weather: 0.5, incidents: 3, evenings: 1.5 }, maxHappenings: Infinity, off: [] },
};

const CATEGORY_OF: Record<DayEventId, EventCategory> = Object.fromEntries(
  (Object.entries(EVENT_CATEGORIES) as [EventCategory, readonly DayEventId[]][]).flatMap(([category, ids]) => ids.map((id) => [id, category])),
) as Record<DayEventId, EventCategory>;

export const difficultyOf = (state: GameState): Difficulty => (isDifficulty(state.settings.difficulty) ? state.settings.difficulty : DEFAULT_DIFFICULTY);
const rulesOf = (state: GameState): DifficultyRules => DIFFICULTY_RULES[difficultyOf(state)];

/** An event this level may bring, and how likely, relative to the others. */
export const eventWeight = (state: GameState, id: DayEventId): number => {
  const rules = rulesOf(state);
  if (rules.only && !rules.only.includes(id)) return 0;
  return DAY_EVENTS[id].weight * rules.weights[CATEGORY_OF[id]];
};
export const isEventOn = (state: GameState, id: DayEventId): boolean => eventWeight(state, id) > 0;
export const eventChance = (state: GameState): number => rulesOf(state).eventChance;
export const maxHappenings = (state: GameState): number => rulesOf(state).maxHappenings;
export const isFeatureOn = (state: GameState, feature: PlayFeature): boolean => !rulesOf(state).off.includes(feature);

// The morning: what this level doesn't have leaves today's plans. Mutates state.
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
export const setDifficulty = (state: GameState, difficulty: Difficulty): void => {
  if (!isDifficulty(difficulty)) return;
  state.settings.difficulty = difficulty;
  applyToToday(state);
};
