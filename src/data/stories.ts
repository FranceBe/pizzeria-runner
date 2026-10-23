// Regulars with a story: a few chapters over the weeks, each one a visit of its own. The ids are stored in save files:
// never rename them. Their words live in src/i18n (stories.<id>).
export const STORY_IDS = ["sweethearts", "student", "oldChef"] as const;
export type StoryId = (typeof STORY_IDS)[number];

export interface StoryChapter {
  /** Days after the previous chapter (the first one: as soon as the story starts). */
  daysAfter: number;
  /** People who come with the regular, as a table. */
  companions: number;
  /** What serving this chapter brings. */
  xp: number;
  money: number;
}

const chapter = (daysAfter: number, companions: number, xp = 15, money = 0): StoryChapter => ({ daysAfter, companions, xp, money });

export const STORIES: Record<StoryId, readonly StoryChapter[]> = {
  // A first date, the proposal, the engagement party, and back with the baby.
  sweethearts: [chapter(0, 1), chapter(4, 0), chapter(4, 1), chapter(6, 1, 50, 25)],
  // Revising for exams, waiting for the results, the whole class to celebrate the degree, the first pay slip.
  student: [chapter(0, 0), chapter(3, 0), chapter(3, 3), chapter(6, 0, 50, 30)],
  // Someone from the trade, grumpy, won over little by little, who brings their old brigade, then gives their peel away.
  oldChef: [chapter(0, 0), chapter(4, 0), chapter(5, 2), chapter(6, 0, 60, 20)],
};

// From this level, now and then in the morning, a regular without a story may start one; a few at a time.
export const STORY_LEVEL = 4;
export const STORY_CHANCE = 0.3;
export const MAX_STORIES_AT_ONCE = 2;
