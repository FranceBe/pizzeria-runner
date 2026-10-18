import {
  ACCESSORY_CHANCE, ACCESSORY_IDS, BOLD_HAIR_CHANCE, BOLD_HAIR_COLORS, FACIAL_HAIR, HAIR_COLORS, HAIR_STYLE_COUNT,
  LONGER_HAIR_STYLES, SHORTER_HAIR_STYLES, SKIN_TONES, UNUSUAL_HAIR_CHANCE, nameKind, type AccessoryId,
} from "../data/customers";
import type { Looks } from "./types";

// A new face for this name. `random` is Math.random, or the daily challenge's seeded generator.
// Feminine names: no moustache or beard, mostly longer hair. Masculine names: mostly shorter hair.
export function rollLooks(name: string, random: () => number = Math.random): Looks {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  const kind = nameKind(name);
  const usual = kind === "feminine" ? LONGER_HAIR_STYLES : SHORTER_HAIR_STYLES;
  const hairStyle = kind === "unisex" || random() < UNUSUAL_HAIR_CHANCE ? Math.floor(random() * HAIR_STYLE_COUNT) : pick(usual);
  const accessories = kind === "feminine" ? ACCESSORY_IDS.filter((id) => !FACIAL_HAIR.has(id)) : ACCESSORY_IDS;
  return {
    skin: pick(SKIN_TONES),
    hair: random() < BOLD_HAIR_CHANCE ? pick(BOLD_HAIR_COLORS) : pick(HAIR_COLORS),
    hairStyle,
    accessory: random() < ACCESSORY_CHANCE ? pick(accessories) : null,
  };
}

// For faces met before names mattered: drops facial hair from feminine names.
export function fitAccessory(name: string, accessory: AccessoryId | null | undefined): AccessoryId | null {
  if (!accessory) return null;
  return nameKind(name) === "feminine" && FACIAL_HAIR.has(accessory) ? null : accessory;
}
