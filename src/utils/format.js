export const formatEuro = (amount) => (Math.round(amount * 100) / 100).toFixed(2).replace(".", ",") + " €";

export const plural = (count, word) => `${word}${count > 1 ? "s" : ""}`;
