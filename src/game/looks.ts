import {
  ACCESSORY_CHANCE, ACCESSORY_IDS, BOLD_HAIR_CHANCE, BOLD_HAIR_COLORS, HAIR_COLORS, HAIR_STYLE_COUNT, SKIN_TONES,
} from "../data/customers";
import type { Looks } from "./types";

// A new face. `random` is Math.random, or the daily challenge's seeded generator.
export function rollLooks(random: () => number = Math.random): Looks {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  return {
    skin: pick(SKIN_TONES),
    hair: random() < BOLD_HAIR_CHANCE ? pick(BOLD_HAIR_COLORS) : pick(HAIR_COLORS),
    hairStyle: Math.floor(random() * HAIR_STYLE_COUNT),
    accessory: random() < ACCESSORY_CHANCE ? pick(ACCESSORY_IDS) : null,
  };
}
