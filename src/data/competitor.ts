// The competitor across the street: a made-up chain opens for a few days. The names are invented.
export const COMPETITOR_NAMES: readonly string[] = ["Pizza Fusée", "Mégapizza 3000", "La Pizza Minute", "Pizzazoum"];

// From this level and day, now and then in the morning, never sooner than COMPETITOR_GAP_DAYS after the last one.
export const COMPETITOR_LEVEL = 5;
export const COMPETITOR_FIRST_DAY = 12;
export const COMPETITOR_CHANCE = 0.07;
export const COMPETITOR_GAP_DAYS = 20;
// It stays this many days; this many of the day's stars over them, and it gives up.
export const COMPETITOR_DAYS = 3;
export const COMPETITOR_STARS_TO_WIN = 6;
// Customers while it is open, by the pizzeria's rating on Gustoscope: loyal from GOOD_RATING, a few fewer from FAIR_RATING,
// more fewer below (or without reviews).
export const GOOD_RATING = 4.3;
export const FAIR_RATING = 3.5;
export const FAIR_FACTOR = 0.9;
export const POOR_FACTOR = 0.8;
// When it gives up: reputation, and its customers come to try the pizzeria for a couple of days.
export const COMPETITOR_WIN_XP = 50;
export const COMPETITOR_WIN_FACTOR = 1.1;
export const COMPETITOR_BOOST_DAYS = 2;
