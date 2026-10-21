// Good flavour pairings start hidden: they are discovered by serving a pizza that has them,
// then show by name in the recipe editor and fill the pairings book in the journal.
import type { IngredientId } from "../data/ingredients";
import { GOOD_PAIRINGS, type Pairing } from "../data/recipes";
import { findPairings } from "./pizza";
import type { GameState } from "./types";

// Stored in save files: "chevre+miel".
export const pairingKey = ([a, b]: Pairing): string => `${a}+${b}`;

export const isDiscovered = (state: GameState, pairing: Pairing): boolean => state.discoveredPairings.includes(pairingKey(pairing));

// Good pairings found in these ingredients, discovered or not.
export const goodPairingsIn = (ingredients: readonly IngredientId[]): Pairing[] => findPairings(ingredients).good;

// Records the good pairings of a served pizza. Returns the ones that are new. Mutates state.
export const discoverPairings = (state: GameState, ingredients: readonly IngredientId[]): Pairing[] => {
  const found = goodPairingsIn(ingredients).filter((pairing) => !isDiscovered(state, pairing));
  state.discoveredPairings.push(...found.map(pairingKey));
  return found;
};

// What the recipe editor shows: discovered pairings by name, the others only as a hint that one exists.
export const visiblePairings = (state: GameState, ingredients: readonly IngredientId[]): { known: Pairing[]; hasSecret: boolean } => {
  const good = goodPairingsIn(ingredients);
  return { known: good.filter((pairing) => isDiscovered(state, pairing)), hasSecret: good.some((pairing) => !isDiscovered(state, pairing)) };
};

export const ALL_PAIRINGS_COUNT = GOOD_PAIRINGS.length;
