// The evening's clock, shown during service: the doors open at 19:00 and a usual evening ends around 23:00. It runs
// with the service's own time, at the pace that brings tonight's expected length to 23:00; an evening that drags on
// goes past it. Only a time of day: the game never shows a calendar date (real festivals follow the real one).
import type { Service } from "./types";

export const OPENING_MINUTES = 19 * 60;
export const EVENING_MINUTES = 4 * 60;
// Customers come every 3.5 to 6.5 seconds (serviceActions.ts), 5 on average; the last ones still need their pizza.
export const AVERAGE_ARRIVAL_SECONDS = 5;
const LAST_ORDERS_SECONDS = 30;

// How long tonight should last, in the service's seconds, for so many customers.
export const expectedEveningSeconds = (customerCount: number): number => Math.max(1, customerCount) * AVERAGE_ARRIVAL_SECONDS + LAST_ORDERS_SECONDS;

// Minutes since midnight on the evening's clock (may pass 24:00 on a very long night).
export const eveningMinutes = (service: Service): number => {
  const expected = service.expectedSeconds ?? expectedEveningSeconds(service.stats.served + service.customers.length + service.customersToCome);
  return OPENING_MINUTES + Math.floor(((service.elapsed ?? 0) / expected) * EVENING_MINUTES);
};

// "20:15" (or "0:30" after midnight), in 5-minute steps: a kitchen clock, not a stopwatch.
export const formatEveningTime = (minutes: number): string => {
  const rounded = Math.floor(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60) % 24;
  return `${hours}:${String(rounded % 60).padStart(2, "0")}`;
};
