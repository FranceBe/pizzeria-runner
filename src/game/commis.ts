// The kitchen help (the commis upgrade) is a person: a name from the day they are hired, and a fatigue that grows with
// busy evenings (more with the rush) and eases a little every night. Tired, they help as if a level lower; exhausted,
// not at all. An evening off, given in the morning, rests them fully: no help that evening, and no wage either.
// Who they are, and how they work, is in game/staff.ts.
import { STAFF_NAMES } from "../data/staff";
import { hashString } from "../utils/random";
import { commisProfile, isLearning } from "./staff";
import type { GameState, Service } from "./types";

export const COMMIS_NAMES = STAFF_NAMES.commis;
// Fatigue, from 0 to MAX_FATIGUE: each pizza served adds this much (twice during a rush), each night takes this off.
export const MAX_FATIGUE = 100;
const FATIGUE_PER_PIZZA = 1;
export const NIGHTLY_REST = 12;
// From these, tired (a level lower) and exhausted (no help). Below MAX_FATIGUE: the night's rest comes before the morning.
export const TIRED_FROM = 60;
export const EXHAUSTED_FROM = 85;

type CommisMood = "fresh" | "tired" | "exhausted" | "off";

/** How the commis is tonight (null without one). */
export const commisMood = (state: GameState): CommisMood | null => {
  if (!state.upgrades.commis || !state.commis) return null;
  if (state.commis.offDay === state.day) return "off";
  if (state.commis.fatigue >= EXHAUSTED_FROM) return "exhausted";
  if (state.commis.fatigue >= TIRED_FROM) return "tired";
  return "fresh";
};

/** The help the commis gives tonight: their upgrade's level, one less when tired or still learning, none when
 * exhausted or off. */
export const commisLevel = (state: GameState): number => {
  const mood = commisMood(state);
  // Nobody at the post (let go, gone in hardcore), off, or exhausted: no help.
  if (mood === null || mood === "off" || mood === "exhausted") return 0;
  return Math.max(0, state.upgrades.commis - (mood === "tired" ? 1 : 0) - (isLearning(state) ? 1 : 0));
};

/** Off tonight: their share of the evening's charges isn't paid. */
export const isCommisOff = (state: GameState): boolean => commisMood(state) === "off";

// One already there in an older save: named after the pizzeria (so loading it twice names them the same). Mutates state.
export const nameOldCommis = (state: GameState): void => {
  if (!state.upgrades.commis || state.commis) return;
  state.commis = { name: COMMIS_NAMES[hashString(state.name) % COMMIS_NAMES.length], fatigue: 0 };
};

// The morning: an evening off for them, or back to work (only before opening). Mutates state.
export const toggleCommisOff = (state: GameState): void => {
  if (!state.commis || !state.upgrades.commis || state.phase !== "prep") return;
  state.commis.offDay = state.commis.offDay === state.day ? undefined : state.day;
};

// At closing: the evening's work weighs on them, or the evening off rested them fully. Mutates state.
export const tireCommis = (state: GameState, service: Service): void => {
  if (!state.commis || !state.upgrades.commis || service.challenge) return;
  if (state.commis.offDay === state.day) {
    state.commis.fatigue = 0;
    return;
  }
  // Some tire faster than others (data/staff.ts).
  const work = (service.stats.served + (service.stats.rushServed ?? 0)) * FATIGUE_PER_PIZZA * (commisProfile(state)?.fatigue ?? 1);
  state.commis.fatigue = Math.min(MAX_FATIGUE, state.commis.fatigue + work);
};

// Each night, a little rest. Mutates state.
export const restCommisOvernight = (state: GameState): void => {
  if (state.commis) state.commis.fatigue = Math.max(0, state.commis.fatigue - NIGHTLY_REST);
};
