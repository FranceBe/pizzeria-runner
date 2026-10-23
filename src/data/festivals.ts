import type { IngredientId } from "./ingredients";

// Calendar festivals, following the real date: for a few days, a special ingredient and recipe.
// The ids are stored in save files: never rename them. Names live in src/i18n.
export const FESTIVAL_IDS = ["halloween", "christmas", "valentine"] as const;
export type FestivalId = (typeof FESTIVAL_IDS)[number];

export interface Festival {
  /** Month (1–12) and day, inclusive. A window can cross the new year. */
  from: [number, number];
  to: [number, number];
  ingredient: IngredientId;
  /** Shown with everything the festival brings, so it reads as the real calendar's, not the game's season. */
  emoji: string;
}

export const FESTIVALS: Record<FestivalId, Festival> = {
  halloween: { from: [10, 20], to: [11, 3], ingredient: "potiron", emoji: "🎃" },
  christmas: { from: [12, 15], to: [1, 2], ingredient: "marron", emoji: "🎄" },
  valentine: { from: [2, 9], to: [2, 16], ingredient: "framboise", emoji: "💝" },
};

// Portions offered when a festival starts.
export const FESTIVAL_GIFT = 6;
