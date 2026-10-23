export const LANGUAGES = ["fr", "en", "zh"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

// Each language is labelled in its own language, so it can be found whatever the current one is.
export const LANGUAGE_NAMES: Record<Language, string> = { fr: "Français", en: "English", zh: "简体中文" };

// How items of a list are separated, and words put side by side (Chinese writes without spaces).
export const LIST_SEPARATORS: Record<Language, string> = { fr: ", ", en: ", ", zh: "、" };
export const WORD_GAPS: Record<Language, string> = { fr: " ", en: " ", zh: "" };

export const detectLanguage = (): Language => {
  try {
    const browser = navigator.language.toLowerCase();
    return LANGUAGES.find((language) => browser.startsWith(language)) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};
