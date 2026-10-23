// The neighbourhood gazette: on the first morning of each week, a front page about the week gone by (its best
// evening, the pizza everyone ordered, what happened in the street, a reader's letter). Kept for the journal.
import { COMPETITOR_DAYS } from "../data/competitor";
import { SEASON_DAYS } from "../data/seasons";
import type { DayEventId } from "../data/events";
import { pushToast } from "./toasts";
import { weekOf } from "./weekly";
import type { DayRecord, GameState, Gazette, GazetteHeadline, RecipeSales } from "./types";

// Issues kept for the journal.
const GAZETTES_KEPT = 12;
// A week of at least this many evenings, all with three stars, is a perfect one.
const PERFECT_WEEK_DAYS = 5;
// So many rainy days make a rainy week; fewer pizzas than this, a quiet one.
const RAINY_WEEK_DAYS = 3;
const QUIET_WEEK_SERVED = 10;

const firstDayOf = (week: number): number => week * SEASON_DAYS + 1;

// What made the week, the most remarkable first.
const headlineOf = (state: GameState, week: number, days: readonly DayRecord[], served: number, hasTop: boolean): GazetteHeadline => {
  const first = firstDayOf(week);
  const last = first + SEASON_DAYS - 1;
  const competitor = state.competitor;
  const competitorLastDay = competitor ? competitor.firstDay + COMPETITOR_DAYS - 1 : -1;
  const best = state.lifetime.bestDay;
  const had = (event: DayEventId) => days.some((day) => day.event === event);
  if (competitor?.outcome === "gaveUp" && competitorLastDay >= first && competitorLastDay <= last) return "competitorGone";
  if (days.length >= PERFECT_WEEK_DAYS && days.every((day) => day.stars === 3)) return "perfectWeek";
  if (best && best.day >= first && best.day <= last && best.net > 0 && state.history.length > days.length) return "record";
  if (had("wedding")) return "wedding";
  if (had("nonnaFamily")) return "family";
  if (had("festival")) return "festival";
  if (days.filter((day) => day.event === "rain").length >= RAINY_WEEK_DAYS) return "rainyWeek";
  if (served < QUIET_WEEK_SERVED || !hasTop) return "quietWeek";
  return "topPizza";
};

/** The front page of a week, from what the game remembers of it. Null for a week without an evening. */
export const gazetteFor = (state: GameState, week: number, sales: Record<string, RecipeSales> = {}): Gazette | null => {
  const first = firstDayOf(week);
  const last = first + SEASON_DAYS - 1;
  const days = state.history.filter((day) => day.day >= first && day.day <= last);
  if (!days.length) return null;
  const served = days.reduce((total, day) => total + day.served, 0);
  const counted = days.filter((day) => day.happyServed !== undefined);
  const countedServed = counted.reduce((total, day) => total + day.served, 0);
  const happy = counted.reduce((total, day) => total + (day.happyServed ?? 0), 0);
  const bestDay = days.reduce((best, day) => (day.net > best.net ? day : best), days[0]);
  const [topId, topSales] = Object.entries(sales).sort((a, b) => b[1].count - a[1].count)[0] ?? [];
  const review = state.reviews.filter((candidate) => candidate.day >= first && candidate.day <= last).sort((a, b) => b.stars - a.stars)[0] ?? null;
  return {
    week,
    firstDay: first,
    lastDay: Math.max(...days.map((day) => day.day)),
    publishedDay: state.day,
    evenings: days.length,
    served,
    net: Math.round(days.reduce((total, day) => total + day.net, 0) * 100) / 100,
    happyShare: countedServed ? Math.round((happy / countedServed) * 100) : null,
    stars: days.reduce((total, day) => total + (day.stars ?? 0), 0),
    bestDay: { day: bestDay.day, net: bestDay.net },
    top: topId && topSales ? { recipeId: topId, recipeName: topSales.name, count: topSales.count } : null,
    events: [...new Set(days.flatMap((day) => (day.event ? [day.event] : [])))],
    review,
    headline: headlineOf(state, week, days, served, Boolean(topId)),
  };
};

/** The first morning of a week (state.day is the new day): the week's missions are still last week's. */
export const isNewWeek = (state: GameState): boolean => state.weekly !== null && state.weekly.week < weekOf(state.day);

// On the first morning of a week (state.day is the new day), last week's issue comes out, before the week's missions
// are renewed (they hold the week's sales). Mutates state.
export const publishGazette = (state: GameState): void => {
  const weekly = state.weekly;
  if (!weekly || !isNewWeek(state)) return;
  if (state.gazettes.some((issue) => issue.week === weekly.week)) return;
  const issue = gazetteFor(state, weekly.week, weekly.sales);
  if (!issue) return;
  state.gazettes = [...state.gazettes, issue].slice(-GAZETTES_KEPT);
  pushToast(state, { key: "gazetteOut" }, "gold");
};

/** This morning's issue, if one came out today. */
export const todaysGazette = (state: GameState): Gazette | null => {
  const latest = state.gazettes.at(-1);
  return latest && latest.publishedDay === state.day ? latest : null;
};

// Each pizza served counts for the week's best seller. Mutates state.
export const countWeeklySale = (state: GameState, recipeId: string, recipeName: string | null): void => {
  if (!state.weekly) return;
  const sales = state.weekly.sales ?? {};
  sales[recipeId] = { name: recipeName, count: (sales[recipeId]?.count ?? 0) + 1 };
  state.weekly.sales = sales;
};
