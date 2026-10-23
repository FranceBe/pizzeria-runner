// What the game should sound like, worked out from the state alone (no audio here, so it can be tested):
// which one-shot effects to play between two states, and whether the oven sizzles.
import { levelForXp } from "../game/progression";
import type { GameState } from "../game/types";
import type { EffectId } from "./synth";

export interface SoundSnapshot {
  day: number;
  customerIds: readonly string[];
  hasBatch: boolean;
  served: number;
  drinks: number;
  questRewards: number;
  level: number;
  achievements: number;
  questsDone: number;
  weeklyDone: number;
  tonightReached: boolean;
  /** A daily challenge just ended on a new best score. */
  challengeBest: boolean;
}

export const snapshotOf = (state: GameState): SoundSnapshot => {
  const service = state.service;
  return {
    day: state.day,
    customerIds: service?.customers.map((customer) => customer.id) ?? [],
    hasBatch: Boolean(service?.batch),
    served: service?.stats.served ?? 0,
    drinks: service?.stats.drinks ?? 0,
    questRewards: service?.stats.questRewards ?? 0,
    level: levelForXp(state.xp),
    achievements: Object.keys(state.achievements).length,
    questsDone: state.lifetime.questsDone,
    weeklyDone: state.weekly?.missions.filter((mission) => mission.done).length ?? 0,
    tonightReached: state.tonightGoal?.day === state.day && state.tonightGoal.status === "done",
    challengeBest: Boolean(state.challengeResult && !state.challengeResult.multiplayer && state.challengeResult.isNewBest),
  };
};

export type FanfareSize = "fanfareSmall" | "fanfareMedium" | "fanfareBig";

export interface Cues {
  newOrder: boolean;
  payment: boolean;
  /** The biggest celebration the moment calls for, if any (only one plays). */
  fanfare: FanfareSize | null;
}

// A new order: someone walked in, or the group order came in. A payment: a pizza or a drink was paid for, or a group
// order was delivered. The fanfares, for wins: small for a quest completed, a weekly mission or tonight's goal
// reached; medium for a new reputation level or an achievement; big for a new best in the daily challenge (a win
// against friends plays it from the podium, see ChallengeResult.tsx). Progress only counts within the same day of the
// same game: loading another save, or a new morning, celebrates nothing.
export const cuesBetween = (before: SoundSnapshot, after: SoundSnapshot): Cues => {
  const known = new Set(before.customerIds);
  const isSameDay = after.day === before.day;
  const isBig = after.challengeBest && !before.challengeBest;
  const isMedium = isSameDay && (after.level > before.level || after.achievements > before.achievements);
  const isSmall =
    isSameDay && (after.questsDone > before.questsDone || after.weeklyDone > before.weeklyDone || (after.tonightReached && !before.tonightReached));
  return {
    newOrder: after.customerIds.some((id) => !known.has(id)) || (after.hasBatch && !before.hasBatch),
    payment: after.served > before.served || after.drinks > before.drinks || after.questRewards > before.questRewards,
    fanfare: isBig ? "fanfareBig" : isMedium ? "fanfareMedium" : isSmall ? "fanfareSmall" : null,
  };
};

// Every effect a cue may ask for, so tests can check each one exists.
export const CUE_EFFECTS: readonly EffectId[] = ["newOrder", "payment", "fanfareSmall", "fanfareMedium", "fanfareBig"];

// The sizzle plays while any pizza bakes, and stops during a pause.
export const isSizzling = (state: GameState): boolean => Boolean(state.service?.oven.length) && !state.service?.paused;

// Music is softer during a pause, and off when muted.
const PAUSED_MUSIC = 0.3;
export const musicLevel = (state: GameState): number => {
  const { musicVolume, musicMuted } = state.settings;
  if (musicMuted) return 0;
  return musicVolume * (state.service?.paused ? PAUSED_MUSIC : 1);
};

export const effectsLevel = (state: GameState): number => (state.settings.effectsMuted ? 0 : state.settings.effectsVolume);
