// Neighbourhood quests: a small goal over a few days, with a reward. No penalty when they run out.
// The ids are stored in save files: never rename them. Texts live in src/i18n.
// serveRecipe is no longer offered (group orders replaced it) but stays readable in older journals.
export const QUEST_KINDS = ["serveRecipe", "serveTotal", "happy", "pairing", "sweet", "batch"] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export const QUEST_GIVERS = ["football", "bakery", "school", "townHall", "neighbour"] as const;
// The wedding banquet's group order (a day event, see data/events.ts) comes from the newlyweds, never from the lot above.
export type QuestGiver = (typeof QUEST_GIVERS)[number] | "wedding";

export const FIRST_QUEST_DAY = 4;
export const QUEST_CHANCE = 0.6;
export const QUEST_DAYS = 3;
