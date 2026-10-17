// Neighbourhood quests: a small goal over a few days, with a reward. No penalty when they run out.
// The ids are stored in save files: never rename them. Texts live in src/i18n.
export const QUEST_KINDS = ["serveRecipe", "serveTotal", "happy", "pairing", "sweet"] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export const QUEST_GIVERS = ["football", "bakery", "school", "townHall", "neighbour"] as const;
export type QuestGiver = (typeof QUEST_GIVERS)[number];

export const FIRST_QUEST_DAY = 4;
export const QUEST_CHANCE = 0.6;
export const QUEST_DAYS = 3;
