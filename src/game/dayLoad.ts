// How much is going on today. Besides tonight's goal and rush (most evenings have them) and a real-calendar festival,
// a day holds at most MAX_HAPPENINGS things out of the ordinary: the day's event, the competitor across the street, a
// regular's story chapter, a birthday, a running quest. Once it is full, nothing new starts that day.
import { competitorDay } from "./competitor";
import { birthdaysToday } from "./regulars";
import { storyGuestsToday } from "./stories";
import type { GameState } from "./types";

export const MAX_HAPPENINGS = 3;

export const happeningsToday = (state: GameState): number =>
  [
    state.event !== null,
    competitorDay(state) !== null,
    storyGuestsToday(state).length > 0,
    birthdaysToday(state).length > 0,
    // The wedding banquet is the wedding's own order: one thing, not two.
    state.quest !== null && state.quest.giver !== "wedding",
  ].filter(Boolean).length;

export const isDayFull = (state: GameState): boolean => happeningsToday(state) >= MAX_HAPPENINGS;
