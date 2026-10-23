// Postcards (data/postcards.ts): the first time a rare moment happens, its postcard comes, dated, for the journal.
import type { PostcardId } from "../data/postcards";
import type { StoryId } from "../data/stories";
import { pushToast } from "./toasts";
import type { GameState } from "./types";

// Sends the postcard of this moment, the first time only. Mutates state.
export const sendPostcard = (state: GameState, id: PostcardId): void => {
  if (state.postcards[id] !== undefined) return;
  state.postcards = { ...state.postcards, [id]: state.day };
  pushToast(state, { key: "postcard", params: { id } }, "gold");
};

const STORY_POSTCARDS: Record<StoryId, PostcardId> = { sweethearts: "storySweethearts", student: "storyStudent", oldChef: "storyOldChef" };
export const storyPostcard = (id: StoryId): PostcardId => STORY_POSTCARDS[id];
