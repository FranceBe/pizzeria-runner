import { describe, it, expect } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { REPUTATION_THRESHOLDS, UPGRADES } from "../data/progression";
import { levelForXp } from "../game/progression";
import { hydrateState } from "../game/state";
import { makeState, play, toJson } from "../test/helpers";
import { buildDevGame, DEFAULT_DEV_SETUP, noUpgrades } from "./devSave";
import { isStoryOver, storyGuestsToday } from "../game/stories";
import { todaysGazette } from "../game/gazette";

describe("the dev test game", () => {
  it("is set up as asked, keeping the player's settings, with the classics already found", () => {
    const current = makeState({ name: "Chez Fran" });
    current.settings.musicVolume = 0.5;
    const game = buildDevGame({ ...DEFAULT_DEV_SETUP, level: 10, money: 1234, day: 42 }, current);
    expect(levelForXp(game.xp)).toBe(10);
    expect(game).toMatchObject({ money: 1234, day: 42, name: "Chez Fran", secretIngredient: true, mammaSecret: true });
    expect(game.settings).toMatchObject({ musicVolume: 0.5, tutorialDone: true });
    INGREDIENTS.filter((ingredient) => !ingredient.festival).forEach(({ id }) => {
      expect(game.unlocked[id]).toBe(true);
      expect(game.stock[id]).toBe(20);
    });
    expect(game.upgrades.oven2).toBe(UPGRADES.oven2.costs.length);
    expect(game.recipes.length).toBeGreaterThan(makeState().recipes.length);
    expect(game.toasts).toEqual([]);
  });

  it("keeps values in range, and starts from scratch when asked for nothing", () => {
    const game = buildDevGame(
      { ...DEFAULT_DEV_SETUP, level: 99, money: -5, allIngredients: false, upgrades: { ...noUpgrades(), commis: 9 }, nonnaSecret: false, mammaSecret: false },
      makeState(),
    );
    expect(game.xp).toBe(REPUTATION_THRESHOLDS.at(-1));
    expect(game.money).toBe(0);
    expect(game.upgrades.commis).toBe(UPGRADES.commis.costs.length);
    expect(game.unlocked.anchois).toBeFalsy();
    expect(game.secretIngredient).toBe(false);
  });

  it("loads like any save, and plays", () => {
    const loaded = play(makeState(), { type: "importSave", saveData: toJson(buildDevGame(DEFAULT_DEV_SETUP, makeState())) });
    expect(hydrateState(toJson(loaded)).money).toBe(DEFAULT_DEV_SETUP.money);
    expect(play(loaded, { type: "openRestaurant" }).phase).toBe("service");
  });

  it("can bring regulars with stories at every stage, and three issues of the gazette, the latest out this morning", () => {
    const game = buildDevGame({ ...DEFAULT_DEV_SETUP, day: 30 }, makeState());
    expect(game.customerBook.Giulia.story).toMatchObject({ id: "sweethearts", chapter: 2, dueDay: 30 });
    expect(storyGuestsToday(game)).toEqual(["Giulia"]);
    expect(isStoryOver(game.customerBook.Sofia.story!)).toBe(true);
    Object.values(game.customerBook).forEach((entry) => expect(entry.story?.days).toHaveLength(entry.story?.chapter ?? 0));
    expect(game.gazettes).toHaveLength(3);
    expect(todaysGazette(game)?.week).toBe(3);
    expect(game.gazettes.every((issue) => issue.lastDay < 30)).toBe(true);
    const plain = buildDevGame({ ...DEFAULT_DEV_SETUP, stories: false, gazettes: false }, makeState());
    expect(Object.keys(plain.customerBook)).toHaveLength(0);
    expect(plain.gazettes).toEqual([]);
    // Early on, only the weeks that were.
    expect(buildDevGame({ ...DEFAULT_DEV_SETUP, day: 9 }, makeState()).gazettes).toHaveLength(1);
  });
});

