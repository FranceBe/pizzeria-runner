// A discreet hand on the evening's pace. After hard evenings (few customers leaving happy), customers come a little
// more slowly and wait more patiently; after easy ones (three stars and nearly everyone happy), a little faster.
// Never in challenges, where everyone must get the same evening.
import type { GameState, Pace } from "./types";

// The latest days looked at, and how many of them it takes.
const DAYS_LOOKED_AT = 3;
const HARD_HAPPY_SHARE = 0.5;
const EASY_HAPPY_SHARE = 0.9;

// Multiplies the time between arrivals, and how fast waiting counts.
export const PACE_ARRIVALS: Record<Pace, number> = { gentle: 1.2, normal: 1, brisk: 0.9 };
export const PACE_WAITING: Record<Pace, number> = { gentle: 0.85, normal: 1, brisk: 1 };

/** Tonight's pace, from how the latest evenings went. */
export const paceFor = (state: GameState): Pace => {
  const days = state.history.slice(-DAYS_LOOKED_AT).filter((day) => day.happyServed !== undefined && day.served > 0);
  if (days.length < DAYS_LOOKED_AT) return "normal";
  const served = days.reduce((total, day) => total + day.served, 0);
  const happy = days.reduce((total, day) => total + (day.happyServed ?? 0), 0);
  if (happy / served < HARD_HAPPY_SHARE) return "gentle";
  if (happy / served >= EASY_HAPPY_SHARE && days.every((day) => day.stars === 3)) return "brisk";
  return "normal";
};
