// Pizzerias ready to play, for the robots' long tests.
import { INGREDIENTS } from "../data/ingredients";
import { UPGRADES, UPGRADE_KEYS } from "../data/progression";
import type { GameState } from "../game/types";
import { makeState } from "./helpers";

// Halloween, Christmas Eve, Valentine's Day and an ordinary day: festivals come and go.
export const DATES = ["2026-10-25", "2026-12-24", "2027-02-14", "2027-05-01"];

// Everything unlocked and upgraded, plenty of money.
export const lateGame = (): GameState => {
  const state = makeState({ money: 20000, xp: 30000, day: 3 });
  INGREDIENTS.filter((ingredient) => !ingredient.festival).forEach(({ id }) => (state.unlocked[id] = true));
  UPGRADE_KEYS.forEach((key) => (state.upgrades[key] = UPGRADES[key].costs.length));
  state.settings.tutorialDone = true;
  state.secretIngredient = true;
  state.secretStock = 5;
  return state;
};

// Halfway there: a few suppliers and upgrades, money to count.
export const middling = (): GameState => {
  const state = makeState({ day: 6, money: 900, xp: 5000 });
  INGREDIENTS.filter((ingredient) => !ingredient.festival && ingredient.requiredLevel <= 4).forEach(({ id }) => (state.unlocked[id] = true));
  state.upgrades = { ...state.upgrades, oven: 2, salle: 2, bar: 1, commis: 1, livraison: 1, oven2: 1 };
  state.settings.tutorialDone = true;
  return state;
};
