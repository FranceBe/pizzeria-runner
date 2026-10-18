import type { StarGoals } from "./types";

// A day's stars: one per goal reached.
//   happy  everyone was served before getting hungry, and nobody was sent home early
//   waste  nothing binned (with a few pizzas served)
//   profit the day's profit reaches a target that grows with the evening charges
const WASTE_MIN_SERVED = 3;
const MIN_PROFIT_TARGET = 20;
const PROFIT_TARGET_PER_CHARGE = 1.5;

export const profitTarget = (charges: number): number => Math.max(MIN_PROFIT_TARGET, Math.round(charges * PROFIT_TARGET_PER_CHARGE));

export interface DayResults {
  served: number;
  hungryServed: number;
  closedEarly: boolean;
  waste: number;
  net: number;
  charges: number;
}

export function starGoals(day: DayResults): StarGoals {
  return {
    happy: day.served > 0 && day.hungryServed === 0 && !day.closedEarly,
    waste: day.served >= WASTE_MIN_SERVED && day.waste === 0,
    profit: day.net >= profitTarget(day.charges),
  };
}

export const starCount = (goals: StarGoals): number => [goals.happy, goals.waste, goals.profit].filter(Boolean).length;
