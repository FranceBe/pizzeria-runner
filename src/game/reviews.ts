// Online reviews: after each day, a few customers rate the pizzeria. Only for show: nothing in the game depends on them.
// Unhappy customers write more often than happy ones, so the rating drops faster than it climbs back.
// Food critics don't write online: they write in the papers (see writePressReview).
import { PRESS_PAPERS } from "../data/press";
import { randomIndex } from "../utils/random";
import { moodForWait } from "./customers";
import { warmthOf, type Warmth } from "./streak";
import type { Customer, GameState, OrderRecord, PressReview, ReadyPizza, Review, ReviewReason } from "./types";

// Lines per reason and tone (the lines themselves live in src/i18n).
export const REVIEW_LINES = 3;
// The latest reviews and articles kept for the journal; the overall rating counts every review ever written.
export const REVIEWS_KEPT = 30;
export const PRESS_KEPT = 10;
// At most this many reviews a day.
const MAX_REVIEWS_A_DAY = 5;
// Chance that a customer writes a review, by the stars they give (index 1 to 5).
const WRITE_CHANCE: readonly number[] = [0, 0.6, 0.5, 0.35, 0.3, 0.25];

// What went wrong, in stars it would cost a customer of normal temper.
const STARS_LOST_TO_WAIT: readonly number[] = [0, 1, 2, 3];
const STARS_LOST_TO_COLD: Record<Warmth, number> = { hot: 0, warm: 1, cold: 2 };
// Customers don't all judge alike: a quarter are easy-going, a quarter are harsh.
const TEMPERS: readonly { share: number; severity: number }[] = [
  { share: 0.25, severity: 0.4 },
  { share: 0.5, severity: 1 },
  { share: 0.25, severity: 1.6 },
];

const severityOf = (roll: number): number => {
  let threshold = 0;
  for (const temper of TEMPERS) {
    threshold += temper.share;
    if (roll < threshold) return temper.severity;
  }
  return 1;
};

// How a served order went, from 1 to 5 stars depending on the customer's temper, and what they would write about:
// the worst thing that happened. An easy-going customer may give 5 stars and still mention the wait.
export const rateOrder = (customer: Customer, pizza: ReadyPizza, random: () => number = Math.random): { stars: number; reason: ReviewReason } => {
  const mood = moodForWait(customer.waitedSeconds);
  const warmth = warmthOf(pizza.waitingSeconds);
  const lost = STARS_LOST_TO_WAIT[mood] + STARS_LOST_TO_COLD[warmth];
  const stars = Math.min(5, Math.max(1, Math.round(5 - lost * severityOf(random()))));
  const reason: ReviewReason =
    warmth === "cold" ? "cold"
    : mood >= 2 ? "wait"
    : warmth === "warm" ? "lukewarm"
    : mood === 1 ? "wait"
    : pizza.woodFired ? "woodFired"
    : "perfect";
  return { stars, reason };
};

export type ReviewTone = "kind" | "mixed" | "harsh";

// The tone of a review follows its stars, whatever it talks about.
export const toneOf = (stars: number): ReviewTone => (stars >= 4 ? "kind" : stars === 3 ? "mixed" : "harsh");

// Reviews saved before reasons were merged: what they are now.
export const reasonOf = (review: Review): ReviewReason => {
  const reason = review.reason as string;
  return reason === "good" || reason === "longWait" ? "wait" : review.reason;
};

// At closing time: some of tonight's customers write a review. Mutates state; returns tonight's reviews.
export const writeReviews = (state: GameState, orders: readonly OrderRecord[]): Review[] => {
  const written = orders
    .filter((order) => order.stars !== undefined && order.reason !== undefined && Math.random() < WRITE_CHANCE[order.stars])
    .slice(0, MAX_REVIEWS_A_DAY)
    .map(
      (order): Review => ({
        day: state.day,
        name: order.customerName,
        stars: order.stars ?? 5,
        reason: order.reason ?? "perfect",
        line: randomIndex(REVIEW_LINES),
        recipeId: order.recipeId,
        recipeName: order.recipeName,
      }),
    );
  if (!written.length) return written;
  state.reviews = [...state.reviews, ...written].slice(-REVIEWS_KEPT);
  state.reviewScore = {
    count: state.reviewScore.count + written.length,
    total: state.reviewScore.total + written.reduce((total, review) => total + review.stars, 0),
  };
  return written;
};

// The overall rating, rounded to one decimal, or null before the first review.
export const averageRating = (score: { count: number; total: number }): number | null =>
  score.count ? Math.round((score.total / score.count) * 10) / 10 : null;

// A food critic served: their article comes out in one of the papers. Mutates state.
export const writePressReview = (
  state: GameState,
  critic: Pick<Customer, "name" | "recipeId" | "recipeName">,
  stars: number,
  { mystery = false }: { mystery?: boolean } = {},
): void => {
  const article: PressReview = {
    day: state.day,
    ...(mystery ? { mystery } : {}),
    paper: randomIndex(PRESS_PAPERS.length),
    critic: critic.name,
    stars,
    line: randomIndex(REVIEW_LINES),
    recipeId: critic.recipeId,
    recipeName: critic.recipeName,
  };
  state.press = [...state.press, article].slice(-PRESS_KEPT);
};
