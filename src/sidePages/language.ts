// The pages next to the game (the solitaire, the factory) speak the game's language: Forno Lento's on this device,
// when the player has a pizzeria here, otherwise the browser's (French, Chinese, otherwise English).

export type PageLanguage = "fr" | "en" | "zh";

const GAME_SAVE_KEY = "forno-lento-save-v1";

const isLanguage = (value: unknown): value is PageLanguage => value === "fr" || value === "en" || value === "zh";

export const pickLanguage = (gameSave: string | null, browserLanguage: string): PageLanguage => {
  try {
    const language = (JSON.parse(gameSave ?? "null") as { settings?: { language?: unknown } } | null)?.settings?.language;
    if (isLanguage(language)) return language;
  } catch {
    // Not a save we can read: the browser decides.
  }
  const browser = browserLanguage.slice(0, 2).toLowerCase();
  return isLanguage(browser) ? browser : "en";
};

// The game's save is only read, for its language; never written.
export const pageLanguage = (): PageLanguage => {
  let gameSave: string | null = null;
  try {
    gameSave = localStorage.getItem(GAME_SAVE_KEY);
  } catch {
    // Storage blocked: the browser decides.
  }
  return pickLanguage(gameSave, typeof navigator === "undefined" ? "en" : navigator.language);
};
