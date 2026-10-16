import type { Language } from "../i18n/languages";

const roundToCents = (amount: number): number => Math.round(amount * 100) / 100;

// fr: "7,50 €" · en: "€7.50"
export function formatMoney(amount: number, language: Language): string {
  const rounded = roundToCents(amount);
  if (language === "fr") return rounded.toFixed(2).replace(".", ",") + " €";
  return `${rounded < 0 ? "-" : ""}€${Math.abs(rounded).toFixed(2)}`;
}

// fr: "4,5" · en: "4.5"
export const formatNumber = (value: number, language: Language): string =>
  language === "fr" ? String(value).replace(".", ",") : String(value);

export const plural = (count: number, singular: string, pluralForm = singular + "s"): string =>
  count > 1 ? pluralForm : singular;
