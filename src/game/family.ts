// Nonna's family (a day event): a table of four comes in at a given time on the evening's clock, on top of the evening's
// customers, for Nonna's recipes. All served happy or patient, they leave a generous bonus.
import { FAMILY_TIME } from "../data/events";
import { eveningMinutes } from "./clock";
import { signatureLevel } from "./menu";
import { maxQueueLength } from "./service";
import type { GameState, Recipe, Service } from "./types";

// Their table needs a regular's level, like any table.
export const FAMILY_LEVEL = 3;

/** Tonight is their night, and they haven't come yet. */
export const isFamilyExpected = (state: GameState, service: Service): boolean =>
  state.event === "nonnaFamily" && !service.challenge && !service.familyCame;

// Their time has come, or nobody else is left to come (the evening waits for them); and there is room at the counter.
export const isFamilyDue = (state: GameState, service: Service): boolean => {
  if (!isFamilyExpected(state, service)) return false;
  const isTime = eveningMinutes(service) >= FAMILY_TIME || (service.customersToCome === 0 && service.customers.length === 0);
  return isTime && service.customers.length < maxQueueLength(state);
};

/** What they order from: Nonna's recipes on the menu, or else a margherita, or else anything. */
export const familyMenu = (menu: readonly Recipe[]): readonly Recipe[] => {
  const nonnas = menu.filter((recipe) => signatureLevel(recipe.id) !== undefined);
  if (nonnas.length) return nonnas;
  const margherita = menu.filter((recipe) => recipe.id === "margherita");
  return margherita.length ? margherita : menu;
};
