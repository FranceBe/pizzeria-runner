// Regulars with a story (data/stories.ts): a regular is given one in the morning; when a chapter is due, they come
// that evening (with company, for some chapters); serving them turns the page. A chapter missed comes again later.
import { MAX_STORIES_AT_ONCE, STORIES, STORY_CHANCE, STORY_IDS, STORY_LEVEL, type StoryId } from "../data/stories";
import { pickRandom } from "../utils/random";
import { payBonus } from "./economy";
import { levelForXp } from "./progression";
import { isRegular } from "./regulars";
import { pushToast } from "./toasts";
import { sendPostcard, storyPostcard } from "./postcards";
import type { Customer, CustomerBookEntry, GameState } from "./types";

export interface StoryProgress {
  id: StoryId;
  /** The next chapter to live (its index); the story is over once it reaches the last chapter's. */
  chapter: number;
  /** From which day it is due. */
  dueDay: number;
}

export const isStoryOver = (progress: StoryProgress): boolean => progress.chapter >= STORIES[progress.id].length;

export const storiesOf = (state: GameState): [string, CustomerBookEntry][] => Object.entries(state.customerBook).filter(([, entry]) => entry.story);

// In the morning: maybe a regular without a story starts one (one they haven't all had yet). Mutates state.
export const maybeStartStory = (state: GameState): void => {
  if (levelForXp(state.xp) < STORY_LEVEL || Math.random() >= STORY_CHANCE) return;
  const told = storiesOf(state);
  if (told.filter(([, entry]) => entry.story && !isStoryOver(entry.story)).length >= MAX_STORIES_AT_ONCE) return;
  const untold = STORY_IDS.filter((id) => !told.some(([, entry]) => entry.story?.id === id));
  const candidates = Object.values(state.customerBook).filter((entry) => isRegular(entry) && !entry.story);
  if (!untold.length || !candidates.length) return;
  pickRandom(candidates).story = { id: pickRandom(untold), chapter: 0, dueDay: state.day };
};

// The regulars whose next chapter is due tonight: they will come.
export const storyGuestsToday = (state: GameState): string[] =>
  storiesOf(state)
    .filter(([, entry]) => isRegular(entry) && entry.story && !isStoryOver(entry.story) && entry.story.dueDay <= state.day)
    .map(([name]) => name);

// How many come with a story guest tonight.
export const companionsOf = (state: GameState, name: string): number => {
  const story = state.customerBook[name]?.story;
  return story && !isStoryOver(story) ? STORIES[story.id][story.chapter].companions : 0;
};

// A story guest was served: the page turns, with what the chapter brings. Mutates state.
export const turnStoryPage = (state: GameState, customer: Customer): void => {
  const story = customer.story ? state.customerBook[customer.name]?.story : undefined;
  if (!story || isStoryOver(story) || story.chapter !== customer.story?.chapter) return;
  const chapters = STORIES[story.id];
  const { xp, money } = chapters[story.chapter];
  story.chapter += 1;
  story.days = [...(story.days ?? []), state.day];
  story.dueDay = state.day + (chapters[story.chapter]?.daysAfter ?? 0);
  state.xp += xp;
  if (state.service) state.service.stats.xp += xp;
  if (money) payBonus(state, money);
  pushToast(state, { key: "storyPage", params: { name: customer.name, story: story.id, chapter: story.chapter, total: chapters.length } }, "gold");
  if (isStoryOver(story)) sendPostcard(state, storyPostcard(story.id));
};
