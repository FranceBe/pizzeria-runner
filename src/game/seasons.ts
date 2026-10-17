import { IN_SEASON_DISCOUNT, SEASONS, SEASON_DAYS, SEASON_IDS, type SeasonId } from "../data/seasons";
import type { IngredientId } from "../data/ingredients";
import { activeMenu } from "./menu";
import type { GameState, Recipe } from "./types";

// The season follows from the day: 7 days each, starting with spring.
export const seasonOf = (day: number): SeasonId => SEASON_IDS[Math.floor((day - 1) / SEASON_DAYS) % SEASON_IDS.length];

export const daysLeftInSeason = (day: number): number => SEASON_DAYS - ((day - 1) % SEASON_DAYS);

export const isInSeason = (state: GameState, id: IngredientId): boolean => SEASONS[seasonOf(state.day)].inSeason.includes(id);

export const seasonalPriceFactor = (state: GameState, id: IngredientId): number => (isInSeason(state, id) ? 1 - IN_SEASON_DISCOUNT : 1);

// The recipe of the season, if one of the season's recipes is on tonight's menu.
export function seasonalRecipe(state: GameState): Recipe | undefined {
  const menu = activeMenu(state);
  for (const id of SEASONS[seasonOf(state.day)].recipes) {
    const recipe = menu.find((candidate) => candidate.id === id);
    if (recipe) return recipe;
  }
  return undefined;
}
