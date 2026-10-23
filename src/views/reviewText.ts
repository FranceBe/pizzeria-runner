import { reasonOf, REVIEW_LINES, toneOf } from "../game/reviews";
import type { Review } from "../game/types";
import type { Translator } from "../i18n";

// What a review says: praise, or a complaint in the tone of its stars.
export const reviewText = (t: Translator, review: Review): string => {
  const reason = reasonOf(review);
  const line = (review.line % REVIEW_LINES) as 0 | 1 | 2;
  if (reason === "perfect" || reason === "woodFired") return t(`reviewPraise.${reason}.${line}`);
  return t(`reviewComplaints.${reason}.${toneOf(review.stars)}.${line}`);
};
