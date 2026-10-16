export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

// Each language is labelled in its own language, so it can be found whatever the current one is.
export const LANGUAGE_NAMES: Record<Language, string> = { fr: "Français", en: "English" };

export function detectLanguage(): Language {
  try {
    return navigator.language.toLowerCase().startsWith("fr") ? "fr" : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
