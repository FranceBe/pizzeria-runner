// The competitor across the street (data/competitor.ts): it opens one morning and stays a few days, taking customers
// unless the pizzeria's online rating is good; enough of the day's stars meanwhile, and it gives up, its customers
// coming to try the pizzeria for a couple of days. It never weighs on the game past its days.
import {
  COMPETITOR_BOOST_DAYS, COMPETITOR_CHANCE, COMPETITOR_DAYS, COMPETITOR_FIRST_DAY, COMPETITOR_GAP_DAYS, COMPETITOR_LEVEL,
  COMPETITOR_NAMES, COMPETITOR_STARS_TO_WIN, COMPETITOR_WIN_FACTOR, COMPETITOR_WIN_XP, FAIR_FACTOR, FAIR_RATING, GOOD_RATING, POOR_FACTOR,
} from "../data/competitor";
import { pickRandom } from "../utils/random";
import { levelForXp } from "./progression";
import { averageRating } from "./reviews";
import { pushToast } from "./toasts";
import { sendPostcard } from "./postcards";
import type { GameState } from "./types";

// Which of its days it is (1 to COMPETITOR_DAYS), while it is open; null otherwise.
export const competitorDay = (state: GameState): number | null => {
  const competitor = state.competitor;
  if (!competitor || competitor.outcome) return null;
  const day = state.day - competitor.firstDay + 1;
  return day >= 1 && day <= COMPETITOR_DAYS ? day : null;
};

// Customers lost to it, by the rating: what share still comes.
export const ratingFactor = (rating: number | null): number =>
  rating !== null && rating >= GOOD_RATING ? 1 : rating !== null && rating >= FAIR_RATING ? FAIR_FACTOR : POOR_FACTOR;

// What it does to tonight's customers at the counter: fewer while it is open (by the rating), a few more for a
// couple of days once it gave up.
export const competitorFactor = (state: GameState): number => {
  if (competitorDay(state) !== null) return ratingFactor(averageRating(state.reviewScore));
  const competitor = state.competitor;
  return competitor?.outcome === "gaveUp" && state.day <= (competitor.boostUntil ?? 0) ? COMPETITOR_WIN_FACTOR : 1;
};

// A new morning (state.day is the new day): once its days are over, it gives up or stays; maybe a new one opens.
// Mutates state.
export const followCompetitor = (state: GameState): void => {
  if (!endCompetitorRun(state)) maybeOpenCompetitor(state);
};

// Once its days are over, it gives up or stays. Returns whether that happened this morning. Mutates state.
export const endCompetitorRun = (state: GameState): boolean => {
  const competitor = state.competitor;
  if (!competitor || competitor.outcome || state.day <= competitor.firstDay + COMPETITOR_DAYS - 1) return false;
  if (competitor.stars >= COMPETITOR_STARS_TO_WIN) {
    competitor.outcome = "gaveUp";
    competitor.boostUntil = state.day + COMPETITOR_BOOST_DAYS - 1;
    state.xp += COMPETITOR_WIN_XP;
    pushToast(state, { key: "competitorGaveUp", params: { name: competitor.name, xp: COMPETITOR_WIN_XP } }, "gold");
    sendPostcard(state, "competitorGone");
  } else {
    competitor.outcome = "stayed";
    pushToast(state, { key: "competitorStayed", params: { name: competitor.name } });
  }
  return true;
};

// Maybe a new one opens across the street, long enough after the last one. Mutates state.
export const maybeOpenCompetitor = (state: GameState): void => {
  const competitor = state.competitor;
  const isDue = !competitor || state.day >= competitor.firstDay + COMPETITOR_GAP_DAYS;
  if (!isDue || competitorDay(state) !== null || levelForXp(state.xp) < COMPETITOR_LEVEL || state.day < COMPETITOR_FIRST_DAY) return;
  if (Math.random() >= COMPETITOR_CHANCE) return;
  state.competitor = { name: pickRandom(COMPETITOR_NAMES), firstDay: state.day, stars: 0 };
  pushToast(state, { key: "competitorOpens", params: { name: state.competitor.name } }, "warn");
};

// At closing, while it is open: the day's stars count against it. Mutates state.
export const countStarsAgainstCompetitor = (state: GameState, stars: number): void => {
  if (competitorDay(state) !== null && state.competitor) state.competitor.stars += stars;
};
