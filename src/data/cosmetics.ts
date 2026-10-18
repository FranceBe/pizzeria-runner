// Looks for the pizzeria, bought in the Upgrades tab once there is money to spare. Purely visual.
// The ids are stored in save files: never rename them. Names live in src/i18n.
export const AWNING_IDS = ["red", "green", "blue", "sun", "rose", "golden"] as const;
export const SIGN_IDS = ["classic", "neon", "gold", "star"] as const;
export const WALL_IDS = ["mint", "terracotta", "azulejo", "checker", "night"] as const;
export type AwningId = (typeof AWNING_IDS)[number];
export type SignId = (typeof SIGN_IDS)[number];
export type WallId = (typeof WALL_IDS)[number];

/** The ids each slot accepts. */
export interface LookIds {
  awning: AwningId;
  sign: SignId;
  wall: WallId;
}
export type CosmeticSlot = keyof LookIds;
export type CosmeticId = `${CosmeticSlot}:${string}`;

export const COSMETIC_SLOTS: { [Slot in CosmeticSlot]: readonly LookIds[Slot][] } = { awning: AWNING_IDS, sign: SIGN_IDS, wall: WALL_IDS };

// The first of each list is free and owned from the start.
export const COSMETIC_PRICES: { [Slot in CosmeticSlot]: Record<LookIds[Slot], number> } = {
  awning: { red: 0, green: 120, blue: 120, sun: 160, rose: 160, golden: 0 },
  sign: { classic: 0, neon: 300, gold: 450, star: 0 },
  wall: { mint: 0, terracotta: 200, azulejo: 350, checker: 250, night: 0 },
};

// Looks earned with the stars of the days (see game/stars.ts) rather than bought.
export const STAR_LOOKS: Partial<Record<CosmeticId, number>> = { "awning:golden": 15, "sign:star": 40, "wall:night": 75 };

// Narrows an id coming from an action (or a save) to one the slot really offers.
export const isLookOf = <Slot extends CosmeticSlot>(slot: Slot, id: string): id is LookIds[Slot] =>
  (COSMETIC_SLOTS[slot] as readonly string[]).includes(id);
