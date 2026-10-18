// Weekly missions: three goals each week (a week is a season's 7 days), with a gift from Nonna.
// The ids are stored in save files: never rename them. Texts live in src/i18n.
export const WEEKLY_KINDS = ["happy", "tables", "desserts", "drinks", "streak", "batchGold", "served", "tips"] as const;
export type WeeklyKind = (typeof WEEKLY_KINDS)[number];

export const WEEKLY_COUNT = 3;
export const WEEKLY_REWARD = 25;
export const WEEKLY_XP = 30;
// When all three are done.
export const WEEKLY_BONUS = 50;
