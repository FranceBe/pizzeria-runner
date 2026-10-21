// Dev only: builds a game at a chosen point of progress, to test how it plays later on without playing every day.
import { INGREDIENTS } from "../data/ingredients";
import { REPUTATION_THRESHOLDS, UPGRADES, UPGRADE_KEYS, type UpgradeKey } from "../data/progression";
import { discoverClassics } from "../game/menu";
import { MAX_LEVEL } from "../game/progression";
import { createInitialState } from "../game/state";
import type { GameState } from "../game/types";

export interface DevSetup {
  /** Reputation level, from 1 to MAX_LEVEL. */
  level: number;
  money: number;
  day: number;
  /** Signs every supplier (festival ingredients still follow the calendar). */
  allIngredients: boolean;
  upgrades: Record<UpgradeKey, number>;
  /** Portions of each unlocked ingredient in the fridge. */
  stock: number;
  nonnaSecret: boolean;
  mammaSecret: boolean;
}

export const maxUpgrades = (): Record<UpgradeKey, number> =>
  Object.fromEntries(UPGRADE_KEYS.map((key) => [key, UPGRADES[key].costs.length])) as Record<UpgradeKey, number>;

export const noUpgrades = (): Record<UpgradeKey, number> =>
  Object.fromEntries(UPGRADE_KEYS.map((key) => [key, 0])) as Record<UpgradeKey, number>;

export const DEFAULT_DEV_SETUP: DevSetup = {
  level: 8,
  money: 500,
  day: 20,
  allIngredients: true,
  upgrades: maxUpgrades(),
  stock: 20,
  nonnaSecret: true,
  mammaSecret: true,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(value)));

// A fresh game set up as asked, keeping the player's settings (language, sound, theme). The classics the unlocked
// ingredients allow are already in the recipe book.
export const buildDevGame = (setup: DevSetup, current: GameState): GameState => {
  const state = createInitialState(current.settings.language);
  const level = clamp(setup.level, 1, MAX_LEVEL);
  state.settings = { ...current.settings, tutorialDone: true };
  state.name = current.name;
  state.xp = REPUTATION_THRESHOLDS[level - 1];
  state.money = Math.max(0, setup.money);
  state.day = clamp(setup.day, 1, 9999);
  if (setup.allIngredients) INGREDIENTS.filter((ingredient) => !ingredient.festival).forEach(({ id }) => (state.unlocked[id] = true));
  UPGRADE_KEYS.forEach((key) => (state.upgrades[key] = clamp(setup.upgrades[key] ?? 0, 0, UPGRADES[key].costs.length)));
  INGREDIENTS.filter(({ id }) => state.unlocked[id]).forEach(({ id }) => (state.stock[id] = Math.max(0, setup.stock)));
  state.secretIngredient = setup.nonnaSecret;
  state.secretStock = setup.nonnaSecret ? 8 : 0;
  state.mammaSecret = setup.mammaSecret;
  state.mammaStock = setup.mammaSecret ? 6 : 0;
  discoverClassics(state);
  state.toasts = [];
  return state;
};
