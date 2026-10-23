// Themed nights (day events): the neighbourhood fancies one kind of pizza tonight. Those are ordered much more often
// and pay a little more; with enough of them on the menu, more people come.
import type { DayEventId } from "../data/events";
import type { IngredientId } from "../data/ingredients";
import { dietAllows } from "./diets";
import { activeMenu } from "./menu";
import { isDessert } from "./pizza";
import type { GameState } from "./types";

export type ThemeNightId = Extract<DayEventId, "veggieNight" | "biancaNight">;

const FITS: Record<ThemeNightId, (ingredients: readonly IngredientId[]) => boolean> = {
  veggieNight: (ingredients) => !isDessert(ingredients) && dietAllows("veggie", ingredients),
  biancaNight: (ingredients) => !isDessert(ingredients) && !ingredients.includes("tomate"),
};

export const THEME_ORDER_BOOST = 2.5;
// Of the pizza's price, paid on top for a pizza of the theme.
export const THEME_BONUS_SHARE = 0.15;
// With this many pizzas of the theme on the menu, more people come; with none, fewer.
export const THEME_MENU_TARGET = 2;
export const THEME_CROWD_FACTOR = 1.2;
export const THEME_EMPTY_FACTOR = 0.9;

export const isThemeNight = (id: DayEventId | null | undefined): id is ThemeNightId => id === "veggieNight" || id === "biancaNight";

export const fitsTheme = (id: ThemeNightId, ingredients: readonly IngredientId[]): boolean => FITS[id](ingredients);

/** Whether this pizza fits tonight's theme (false on any other night). */
export const fitsTonight = (state: GameState, ingredients: readonly IngredientId[]): boolean =>
  isThemeNight(state.event) && fitsTheme(state.event, ingredients);

export const themeOnMenu = (state: GameState): number => activeMenu(state).filter((recipe) => fitsTonight(state, recipe.ingredients)).length;

// A themed night only comes when the recipe book has something for it (it may be off the menu: time to put it on).
export const canHaveTheme = (state: GameState, id: ThemeNightId): boolean => state.recipes.some((recipe) => fitsTheme(id, recipe.ingredients));

/** Multiplies tonight's expected customers. */
export const themeCrowdFactor = (state: GameState): number => {
  if (!isThemeNight(state.event)) return 1;
  const count = themeOnMenu(state);
  return count >= THEME_MENU_TARGET ? THEME_CROWD_FACTOR : count === 0 ? THEME_EMPTY_FACTOR : 1;
};
