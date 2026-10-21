// What the game should sound like, worked out from the state alone (no audio here, so it can be tested):
// which one-shot effects to play between two states, and whether the oven sizzles.
import type { GameState } from "../game/types";

export interface SoundSnapshot {
  customerIds: readonly string[];
  hasBatch: boolean;
  served: number;
  drinks: number;
  questRewards: number;
}

export const snapshotOf = (state: GameState): SoundSnapshot => {
  const service = state.service;
  return {
    customerIds: service?.customers.map((customer) => customer.id) ?? [],
    hasBatch: Boolean(service?.batch),
    served: service?.stats.served ?? 0,
    drinks: service?.stats.drinks ?? 0,
    questRewards: service?.stats.questRewards ?? 0,
  };
};

// A new order: someone walked in, or the group order came in. A payment: a pizza or a drink was paid for,
// or a group order was delivered.
export const cuesBetween = (before: SoundSnapshot, after: SoundSnapshot): { newOrder: boolean; payment: boolean } => {
  const known = new Set(before.customerIds);
  return {
    newOrder: after.customerIds.some((id) => !known.has(id)) || (after.hasBatch && !before.hasBatch),
    payment: after.served > before.served || after.drinks > before.drinks || after.questRewards > before.questRewards,
  };
};

// The sizzle plays while a pizza bakes, and stops during a pause.
export const isSizzling = (state: GameState): boolean => Boolean(state.service?.oven.length) && !state.service?.paused;

// Music is softer during a pause, and off when muted.
const PAUSED_MUSIC = 0.3;
export const musicLevel = (state: GameState): number => {
  const { musicVolume, musicMuted } = state.settings;
  if (musicMuted) return 0;
  return musicVolume * (state.service?.paused ? PAUSED_MUSIC : 1);
};

export const effectsLevel = (state: GameState): number => (state.settings.effectsMuted ? 0 : state.settings.effectsVolume);
