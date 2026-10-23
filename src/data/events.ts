// Daily events, announced in the morning briefing. The ids are stored in save files: never rename them.
// Names and descriptions live in src/i18n.
export const DAY_EVENT_IDS = [
  "market", "rain", "festival", "critic", "sunny",
  // Incidents: a twist in how the day plays, always with something in return.
  "powerCut", "lateDelivery", "inspection", "scooterStrike",
  // Evenings with a time: something happens at a given hour on the evening's clock (game/clock.ts).
  "match", "wedding",
] as const;
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
  /** Not before this day. */
  firstDay?: number;
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
  // Only one oven slot all evening, but understanding customers tip more.
  powerCut: { weight: 1, customerFactor: 0.9, tipChanceBonus: 0.2, marketPriceFactor: 1, firstDay: 6 },
  // One ingredient arrives late (see LATE_DELIVERY_SECONDS), with a few free portions to make up for it.
  lateDelivery: { weight: 1, customerFactor: 1, tipChanceBonus: 0, marketPriceFactor: 1, firstDay: 5 },
  // A day without binning anything earns a lot of reputation.
  inspection: { weight: 1, customerFactor: 1, tipChanceBonus: 0, marketPriceFactor: 1, firstDay: 5 },
  // No deliveries today (only happens with the delivery upgrade), but more people eat in.
  scooterStrike: { weight: 1, customerFactor: 1.2, tipChanceBonus: 0, marketPriceFactor: 1, firstDay: 5 },
  // The match on TV: quiet once it kicks off, then everyone at once at half-time (see MATCH_KICKOFF, MATCH_HALFTIME).
  match: { weight: 2, customerFactor: 1, tipChanceBonus: 0, marketPriceFactor: 1, firstDay: 4 },
  // A wedding banquet: a big group order at 21:00 (see WEDDING_*), and a few fewer customers besides.
  wedding: { weight: 1, customerFactor: 0.85, tipChanceBonus: 0, marketPriceFactor: 1, firstDay: 6 },
};

// The wedding banquet: this many pizzas (more for a bigger pizzeria), of up to three recipes on the menu, delivered all
// together from this time on the evening's clock, paid this much more than a neighbourhood group order.
export const WEDDING_TIME = 21 * 60;
export const WEDDING_MIN_PIZZAS = 8;
export const WEDDING_MAX_PIZZAS = 12;
export const WEDDING_REWARD_FACTOR = 1.5;

// The match, on the evening's clock (minutes since midnight): customers come this much more slowly once it kicks off,
// then rush in at half-time for this long (as the rush hour: quick succession, tips doubled), instead of the evening's
// usual rush.
export const MATCH_KICKOFF = 21 * 60;
export const MATCH_HALFTIME = 21 * 60 + 45;
export const MATCH_FIRST_HALF_PACE = 1.8;
export const HALFTIME_SECONDS = 30;

// Late delivery: the ingredient comes this many seconds into the service, with this many free portions.
export const LATE_DELIVERY_SECONDS = 60;
export const LATE_DELIVERY_GIFT = 3;
// Inspection: reputation for a spotless day (nothing binned, at least a few pizzas served).
export const INSPECTION_XP = 40;
export const INSPECTION_MIN_SERVED = 3;

// No events on the first days, so the basics come first.
export const FIRST_EVENT_DAY = 3;
export const EVENT_CHANCE = 0.5;

// Celebrities (made up): rare, from CELEBRITY_LEVEL, at most once a day. Their signed photo goes up on the front.
export const CELEBRITY_NAMES: readonly string[] = ["Luna Star", "Rocco Bomba", "Mira Vox", "Tito Gol", "Dolce Vita"];
export const CELEBRITY_LEVEL = 5;
export const CELEBRITY_CHANCE = 0.04;
export const CELEBRITY_TIP = 10;
export const CELEBRITY_XP = 50;

// Critics aren't regulars: they don't go in the customer book.
export const CRITIC_NAMES: readonly string[] = ["Mme Bellini", "M. Fontaine", "Mme Moreau", "M. Okafor", "Mme Sato"];
