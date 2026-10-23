// Tonight's goal: one a day, optional, about how the evening is played. The day's stars already count hungry customers,
// waste and profit, and the week's missions count how much is done: these ask for something else.
// The ids are stored in save files: never rename them. Texts live in src/i18n.
export const TONIGHT_KINDS = ["allHot", "onTime", "variety", "lightning"] as const;
export type TonightKind = (typeof TONIGHT_KINDS)[number];

// From the second day: the first one is for learning the kitchen.
export const TONIGHT_FROM_DAY = 2;
export const TONIGHT_REWARD = 12;
export const TONIGHT_XP = 15;

// Every pizza served hot off the pass, at least this many of them.
export const ALL_HOT_MIN_SERVED = 5;
// The last customer served before this time on the evening's clock (game/clock.ts): 23:00.
export const ON_TIME_MINUTES = 23 * 60;
// This many different recipes served, at most (fewer if the menu is shorter, from 3).
export const VARIETY_MAX = 5;
export const VARIETY_MIN_MENU = 3;
// This many customers served at most this many seconds after they came in.
export const LIGHTNING_TARGET = 3;
export const LIGHTNING_SECONDS = 15;
