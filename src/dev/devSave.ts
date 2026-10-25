// Dev only: builds a game at a chosen point of progress, to test how it plays later on without playing every day.
import { INGREDIENTS } from "../data/ingredients";
import { REPUTATION_THRESHOLDS, UPGRADES, UPGRADE_KEYS, type UpgradeKey } from "../data/progression";
import { discoverClassics } from "../game/menu";
import { MAX_LEVEL } from "../game/progression";
import { createInitialState } from "../game/state";
import { SEASON_DAYS } from "../data/seasons";
import { STORIES, type StoryId } from "../data/stories";
import { rollLooks } from "../game/looks";
import { fillOpenPosts } from "../game/staff";
import type { CustomerBookEntry, GameState, Gazette, GazetteHeadline } from "../game/types";

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
  /** Regulars living a story, at every stage (one due tonight, one halfway, one told to the end): the story album. */
  stories: boolean;
  /** Three issues of the neighbourhood gazette, the latest out this morning. */
  gazettes: boolean;
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
  stories: true,
  gazettes: true,
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
  fillOpenPosts(state, { silent: true });
  if (setup.stories) addStoryRegulars(state);
  if (setup.gazettes) addGazettes(state);
  state.toasts = [];
  return state;
};

// A regular of a while (their favourite the margherita), living this story so far: chapters lived on these days.
const storyRegular = (state: GameState, name: string, id: StoryId, days: number[], dueDay: number): CustomerBookEntry => ({
  ...rollLooks(name),
  visits: 8 + days.length,
  orders: { margherita: 6, [state.recipes[1]?.id ?? "margherita"]: 2 },
  choiceOrders: { margherita: 6 },
  regular: true,
  lastVisit: Math.max(1, state.day - 1),
  birthday: ((state.day + 9) % 28) + 1,
  story: { id, chapter: days.length, dueDay, days },
});

const addStoryRegulars = (state: GameState): void => {
  const day = state.day;
  const past = (ago: number) => Math.max(1, day - ago);
  state.customerBook = {
    ...state.customerBook,
    // The next chapter tonight: their tile in the morning's list, and they come in during service.
    Giulia: storyRegular(state, "Giulia", "sweethearts", [past(10), past(6)], day),
    // Halfway, the next chapter in a few days.
    Luca: storyRegular(state, "Luca", "student", [past(3)], day + STORIES.student[1].daysAfter),
    // Told to the end.
    Sofia: storyRegular(state, "Sofia", "oldChef", [past(20), past(16), past(11), past(5)], past(5)),
  };
};

// Three weeks of front pages, made up but plausible, the latest out this morning.
const addGazettes = (state: GameState): void => {
  const lastWeek = Math.max(0, Math.floor((state.day - 1) / SEASON_DAYS) - 1);
  const headlines: GazetteHeadline[] = ["topPizza", "rainyWeek", "record"];
  state.gazettes = [2, 1, 0]
    .map((weeksAgo, index): Gazette | null => {
      const week = lastWeek - weeksAgo;
      if (week < 0) return null;
      const firstDay = week * SEASON_DAYS + 1;
      return {
        week,
        firstDay,
        lastDay: firstDay + SEASON_DAYS - 1,
        publishedDay: weeksAgo === 0 ? state.day : firstDay + SEASON_DAYS,
        evenings: 7,
        served: 60 + 12 * index,
        net: 180 + 40 * index,
        happyShare: 70 + 5 * index,
        stars: 12 + index,
        bestDay: { day: firstDay + 4, net: 45 + 5 * index },
        top: { recipeId: "margherita", recipeName: null, count: 20 + 3 * index },
        events: index === 1 ? ["rain", "critic"] : ["festival", "sunny"],
        review: { day: firstDay + 2, name: "Giulia", stars: 5, reason: "perfect", line: index, recipeId: "margherita", recipeName: null },
        headline: headlines[index],
      };
    })
    .filter((issue): issue is Gazette => issue !== null);
};
