const roundToCents = (amount) => Math.round(amount * 100) / 100;

// fr: "7,50 €" · en: "€7.50"
export function formatMoney(amount, language) {
  const rounded = roundToCents(amount);
  if (language === "fr") return rounded.toFixed(2).replace(".", ",") + " €";
  return `${rounded < 0 ? "-" : ""}€${Math.abs(rounded).toFixed(2)}`;
}

// fr: "4,5" · en: "4.5"
export const formatNumber = (value, language) => (language === "fr" ? String(value).replace(".", ",") : String(value));

export const plural = (count, singular, pluralForm = singular + "s") => (count > 1 ? pluralForm : singular);
