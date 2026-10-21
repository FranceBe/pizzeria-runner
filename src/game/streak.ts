// The perfect streak: customers served while still happy, in a row, raise every tip.
// A patient customer keeps the streak as it is; a hungry one breaks it.
import type { Mood } from "./types";

const TIERS: readonly { from: number; multiplier: number }[] = [
  { from: 10, multiplier: 1.5 },
  { from: 6, multiplier: 1.25 },
  { from: 3, multiplier: 1.1 },
];

// The streak shows from this length on.
export const STREAK_SHOWN_FROM = TIERS[TIERS.length - 1].from;

export const streakMultiplier = (streak: number): number => TIERS.find((tier) => streak >= tier.from)?.multiplier ?? 1;

export const nextStreak = (streak: number, mood: Mood): number => {
  if (mood === 0) return streak + 1;
  if (mood === 1) return streak;
  return 0;
};

// A pizza cools on the pass: warm after a while, cold after longer, and the tip follows.
export const WARM_AFTER_SECONDS = 25;
export const COLD_AFTER_SECONDS = 50;
export type Warmth = "hot" | "warm" | "cold";

export const warmthOf = (waitingSeconds = 0): Warmth =>
  waitingSeconds >= COLD_AFTER_SECONDS ? "cold" : waitingSeconds >= WARM_AFTER_SECONDS ? "warm" : "hot";

const WARMTH_TIP: Record<Warmth, number> = { hot: 1, warm: 0.6, cold: 0.3 };
export const warmthTipFactor = (waitingSeconds?: number): number => WARMTH_TIP[warmthOf(waitingSeconds)];
