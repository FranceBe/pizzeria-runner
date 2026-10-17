import type { IngredientId } from "./ingredients";
import type { ClassicRecipeId } from "./recipes";

// The year turns every SEASON_DAYS days. The ids are stored nowhere: the season follows from the day.
export const SEASON_IDS = ["spring", "summer", "autumn", "winter"] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

export const SEASON_DAYS = 7;
// Ingredients in season cost this much less at the market.
export const IN_SEASON_DISCOUNT = 0.25;
// The season's recipe, when on the menu, is ordered this much more often.
export const SEASONAL_RECIPE_BOOST = 1.4;

export interface Season {
  inSeason: readonly IngredientId[];
  /** The first of these on the menu is the recipe of the season. */
  recipes: readonly ClassicRecipeId[];
}

export const SEASONS: Record<SeasonId, Season> = {
  spring: { inSeason: ["roquette", "artichaut", "oeuf", "fraise"], recipes: ["parma", "fraisemasca", "bismarck", "capri", "margherita"] },
  summer: { inSeason: ["tomate", "basilic", "poivron", "burrata"], recipes: ["burrata", "ortolana", "margherita"] },
  autumn: { inSeason: ["champi", "truffe", "patate", "noisette"], recipes: ["tartufo", "regina", "chocobanane", "margherita"] },
  winter: { inSeason: ["reblochon", "lardons", "oignon", "chocolat"], recipes: ["savoyarde", "quattro", "chocobanane", "margherita"] },
};
