import { REPUTATION_THRESHOLDS } from "../data/progression.js";

export const MAX_LEVEL = REPUTATION_THRESHOLDS.length;

export function levelForXp(xp) {
  let level = 1;
  for (let i = 1; i < REPUTATION_THRESHOLDS.length; i++) if (xp >= REPUTATION_THRESHOLDS[i]) level = i + 1;
  return level;
}

// 0 to 100: how far the player is into the current level.
export function levelProgressPercent(xp) {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 100;
  const start = REPUTATION_THRESHOLDS[level - 1];
  const end = REPUTATION_THRESHOLDS[level];
  return ((xp - start) / (end - start)) * 100;
}

export const xpForNextLevel = (xp) => REPUTATION_THRESHOLDS[levelForXp(xp)] ?? REPUTATION_THRESHOLDS[MAX_LEVEL - 1];

// How many pizzas fit on the menu at a given level.
export const menuCapacity = (level) => Math.min(12, 3 + level);
