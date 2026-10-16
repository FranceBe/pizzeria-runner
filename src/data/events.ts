// Daily events, announced in the morning briefing. The ids are stored in save files: never rename them.
// Names and descriptions live in src/i18n.
export const DAY_EVENT_IDS = ["market", "rain", "festival", "critic", "sunny"] as const;
export type DayEventId = (typeof DAY_EVENT_IDS)[number];

export interface DayEvent {
  /** Relative chance of being picked on an event day. */
  weight: number;
  /** Multiplies the number of customers expected. */
  customerFactor: number;
  /** Multiplies market prices (not the suggested menu prices). */
  marketPriceFactor: number;
  /** Added to every customer's tip chance. */
  tipChanceBonus: number;
}

export const DAY_EVENTS: Record<DayEventId, DayEvent> = {
  // Ingredients are 20 % off all day.
  market: { weight: 3, customerFactor: 1, marketPriceFactor: 0.8, tipChanceBonus: 0 },
  // Fewer people out, but the ones who come in are grateful.
  rain: { weight: 2, customerFactor: 0.75, tipChanceBonus: 0.15, marketPriceFactor: 1 },
  // The neighbourhood party: lots of hungry people.
  festival: { weight: 2, customerFactor: 1.4, tipChanceBonus: 0, marketPriceFactor: 1 },
  // A food critic comes in at some point in the evening.
  critic: { weight: 2, customerFactor: 1, tipChanceBonus: 0, marketPriceFactor: 1 },
  // A few more customers, many more with a terrace (see TERRACE_SUNNY_CUSTOMERS).
  sunny: { weight: 3, customerFactor: 1.1, tipChanceBonus: 0.05, marketPriceFactor: 1 },
};

// No events on the first days, so the basics come first.
export const FIRST_EVENT_DAY = 3;
export const EVENT_CHANCE = 0.5;

// Critics aren't regulars: they don't go in the customer book.
export const CRITIC_NAMES: readonly string[] = ["Mme Bellini", "M. Fontaine", "Mme Moreau", "M. Okafor", "Mme Sato"];
