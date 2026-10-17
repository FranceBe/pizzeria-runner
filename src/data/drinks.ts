// Drinks, served from the bar (an upgrade) straight from the fridge: no stock, no oven.
// The ids are stored in save files: never rename them. Names live in src/i18n.
export const DRINK_IDS = ["limonade", "eau", "chinotto", "vin"] as const;
export type DrinkId = (typeof DRINK_IDS)[number];

export interface Drink {
  price: number;
  /** Bar upgrade level that puts it on offer. */
  barLevel: number;
  color: string;
}

export const DRINKS: Record<DrinkId, Drink> = {
  limonade: { price: 2.5, barLevel: 1, color: "#f4e27a" },
  eau: { price: 2, barLevel: 1, color: "#bfe3f2" },
  chinotto: { price: 3, barLevel: 2, color: "#5a2a1a" },
  vin: { price: 4.5, barLevel: 2, color: "#8e1f35" },
};

// Chance that a customer at the counter orders a drink, once the bar is open.
export const DRINK_CHANCE = 0.4;
