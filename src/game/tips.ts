// The morning's tips, behind a little bubble on the prep screen: gentle advice from how the pizzeria stands, never
// orders. Each tip is a message key with its params (see i18n "prep.tips").
import { UPGRADES, UPGRADE_KEYS } from "../data/progression";
import type { IngredientId } from "../data/ingredients";
import { forecastCustomers } from "./economy";
import { activeMenu, isNewRecipe, menuCapacityOf } from "./menu";
import { fairPrice } from "./pizza";
import { levelForXp } from "./progression";
import type { MessageInput, TipKey } from "../i18n";
import type { GameState, Recipe } from "./types";

/** A tip, as a message to translate (see i18n "prep.tips"). */
export type Tip = MessageInput<"prep.tips", TipKey>;

// Above or below the suggested price by this much, a price is worth a word.
const OVERPRICED = 1.3;
const UNDERPRICED = 0.8;
// A recipe never ordered after this many days of service is worth a word.
const NEVER_ORDERED_DAYS = 3;
// An upgrade is worth suggesting when it costs at most this share of the till.
const AFFORDABLE_SHARE = 0.6;
// Below this, an ingredient of the menu shows in the morning's "low stock" list (so it needs no tip as well).
export const LOW_STOCK_THRESHOLD = 5;
// At most this many tips about the fridge, and in all.
const MAX_STOCK_TIPS = 2;
const MAX_TIPS = 5;

// Roughly what tonight's customers will use of each ingredient: their number, shared out between the menu's recipes.
const tonightsNeeds = (state: GameState): Map<IngredientId, number> => {
  const menu = activeMenu(state);
  const customers = forecastCustomers(state);
  const needs = new Map<IngredientId, number>();
  menu.forEach((recipe) => recipe.ingredients.forEach((id) => needs.set(id, (needs.get(id) ?? 0) + customers / menu.length)));
  return new Map([...needs].map(([id, need]) => [id, Math.ceil(need)]));
};

const stockTips = (state: GameState): Tip[] =>
  [...tonightsNeeds(state)]
    .map(([id, need]) => ({ id, need, have: state.stock[id] ?? 0 }))
    .filter(({ need, have }) => have < need && have >= LOW_STOCK_THRESHOLD)
    .sort((a, b) => b.need - b.have - (a.need - a.have))
    .slice(0, MAX_STOCK_TIPS)
    .map((params): Tip => ({ key: "stockForTonight", params }));

const priceTips = (state: GameState): Tip[] =>
  activeMenu(state).flatMap((recipe): Tip[] => {
    const fair = fairPrice(recipe.ingredients);
    const params = { recipeId: recipe.id, recipeName: recipe.name, fair };
    if (recipe.price > fair * OVERPRICED) return [{ key: "overpriced", params }];
    if (recipe.price < fair * UNDERPRICED) return [{ key: "underpriced", params }];
    return [];
  });

// Sales are kept by recipe id, or by name for those migrated from old saves.
const soldCount = (state: GameState, recipe: Recipe): number =>
  (state.lifetime.byRecipe[recipe.id]?.count ?? 0) + (recipe.name ? (state.lifetime.byRecipe[recipe.name]?.count ?? 0) : 0);

const neverOrderedTips = (state: GameState): Tip[] => {
  if (state.history.length < NEVER_ORDERED_DAYS) return [];
  return activeMenu(state)
    .filter((recipe) => !isNewRecipe(state, recipe) && !soldCount(state, recipe))
    .map((recipe): Tip => ({ key: "neverOrdered", params: { recipeId: recipe.id, recipeName: recipe.name } }));
};

const menuRoomTips = (state: GameState): Tip[] => {
  const room = menuCapacityOf(state) - activeMenu(state).length;
  const offMenu = state.recipes.filter((recipe) => !recipe.onMenu).length;
  return room > 0 && offMenu > 0 ? [{ key: "menuRoom", params: { count: Math.min(room, offMenu) } }] : [];
};

// Not while Nonna is still owed money.
const upgradeTips = (state: GameState): Tip[] => {
  if (state.debt > 0) return [];
  const level = levelForXp(state.xp);
  const affordable = UPGRADE_KEYS.map((upgradeKey) => ({ upgradeKey, step: state.upgrades[upgradeKey] }))
    .filter(({ upgradeKey, step }) => {
      const cost = UPGRADES[upgradeKey].costs[step];
      return cost !== undefined && UPGRADES[upgradeKey].requiredLevel[step] <= level && cost <= state.money * AFFORDABLE_SHARE;
    })
    .sort((a, b) => UPGRADES[a.upgradeKey].costs[a.step] - UPGRADES[b.upgradeKey].costs[b.step]);
  return affordable.length ? [{ key: "upgrade", params: { upgradeKey: affordable[0].upgradeKey } }] : [];
};

/** This morning's tips, the most pressing first. None before the tutorial is over. */
export const morningTips = (state: GameState): Tip[] => {
  if (!state.settings.tutorialDone || !activeMenu(state).length) return [];
  return [...stockTips(state), ...priceTips(state), ...neverOrderedTips(state), ...menuRoomTips(state), ...upgradeTips(state)].slice(0, MAX_TIPS);
};
