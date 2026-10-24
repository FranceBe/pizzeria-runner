import { describe, it, expect, vi, afterEach } from "vitest";
import { makeBookEntry, makeState, play, serviceOf } from "../test/helpers";
import { STORIES } from "../data/stories";
import { maybeStartStory, storyGuestsToday } from "./stories";
import type { Customer, GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const LEVEL_4_XP = 1500;
const withRegulars = (...names: string[]): GameState => {
  const state = makeState({ day: 10, xp: LEVEL_4_XP });
  state.customerBook = Object.fromEntries(names.map((name) => [name, makeBookEntry({ visits: 6, orders: { margherita: 6 }, regular: true, lastVisit: 9 })]));
  return state;
};
// Tonight's story guest is at the counter: lets customers in until they come.
const untilStoryGuest = (state: GameState): GameState => {
  let next = play(state, { type: "openRestaurant" });
  // Everyone else is served straight away (the queue would fill up otherwise, and nobody more would come in).
  for (let step = 0; step < 400 && !serviceOf(next).customers.some((customer) => customer.story); step++) {
    next = play({ ...next, service: { ...serviceOf(next), customers: [] } }, { type: "tick", seconds: 0.5 });
  }
  return next;
};
const storyGuestOf = (state: GameState): Customer => {
  const guest = serviceOf(state).customers.find((customer) => customer.story);
  if (!guest) throw new Error("no story guest");
  return guest;
};
const serve = (state: GameState, customer: Customer): GameState => {
  const ready = { ...state, service: { ...serviceOf(state), ready: [{ id: "p", ingredients: [...customer.ingredients], waitingSeconds: 0 }] } };
  return play(ready, { type: "servePizza", pizzaId: "p" });
};

describe("regulars with a story", () => {
  it("start one now and then from level 4: a regular without one, a story nobody had, two at a time at most", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = withRegulars("Luca", "Giulia", "Paolo");
    maybeStartStory(state);
    const started = Object.values(state.customerBook).filter((entry) => entry.story);
    expect(started).toHaveLength(1);
    expect(started[0].story).toMatchObject({ chapter: 0, dueDay: 10 });
    maybeStartStory(state);
    maybeStartStory(state);
    const stories = Object.values(state.customerBook).flatMap((entry) => (entry.story ? [entry.story.id] : []));
    expect(stories).toHaveLength(2);
    expect(new Set(stories).size).toBe(2);
    // Not before level 4.
    const early = { ...withRegulars("Luca"), xp: 0 };
    maybeStartStory(early);
    expect(early.customerBook.Luca.story).toBeUndefined();
  });

  it("brings the regular in on the evening their chapter is due, with company when the chapter says so", () => {
    const state = withRegulars("Luca");
    state.customerBook.Luca.story = { id: "sweethearts", chapter: 0, dueDay: 10 };
    expect(storyGuestsToday(state)).toEqual(["Luca"]);
    // They come with the first customers (on the very last seat, there would be no room for their company).
    vi.spyOn(Math, "random").mockReturnValue(0);
    const evening = untilStoryGuest(state);
    vi.restoreAllMocks();
    const guest = storyGuestOf(evening);
    expect(guest).toMatchObject({ name: "Luca", story: { id: "sweethearts", chapter: 0 } });
    // A first date: a table for two.
    expect(guest.tableId).toBeTruthy();
    expect(serviceOf(evening).customers.filter((customer) => customer.tableId === guest.tableId)).toHaveLength(1 + STORIES.sweethearts[0].companions);
    // Not before its day, nor for someone who is no longer a regular.
    expect(storyGuestsToday({ ...state, day: 9 })).toEqual([]);
    state.customerBook.Luca.regular = false;
    expect(storyGuestsToday(state)).toEqual([]);
  });

  it("turns the page once served: the next chapter is due a few days later, and the last one ends it with a reward", () => {
    const state = withRegulars("Luca");
    state.customerBook.Luca.story = { id: "student", chapter: 0, dueDay: 10 };
    const evening = untilStoryGuest(state);
    const served = serve(evening, storyGuestOf(evening));
    expect(served.customerBook.Luca.story).toEqual({ id: "student", chapter: 1, dueDay: 10 + STORIES.student[1].daysAfter, days: [10] });
    expect(served.toasts.map((toast) => toast.key)).toContain("storyPage");
    // The last chapter.
    const last = withRegulars("Luca");
    last.customerBook.Luca.story = { id: "student", chapter: 3, dueDay: 10 };
    const lastEvening = untilStoryGuest(last);
    const before = lastEvening.money;
    const ended = serve(lastEvening, storyGuestOf(lastEvening));
    expect(ended.customerBook.Luca.story?.chapter).toBe(4);
    expect(ended.money - before).toBeGreaterThanOrEqual(STORIES.student[3].money);
    expect(storyGuestsToday({ ...ended, day: 30 })).toEqual([]);
  });

  it("keeps a chapter missed for later: closing before serving them turns no page", () => {
    const state = withRegulars("Luca");
    state.customerBook.Luca.story = { id: "oldChef", chapter: 1, dueDay: 10 };
    const closed = play(untilStoryGuest(state), { type: "closeEarly" });
    expect(closed.customerBook.Luca.story).toEqual({ id: "oldChef", chapter: 1, dueDay: 10 });
    expect(storyGuestsToday(play(closed, { type: "startNextDay" }))).toEqual(["Luca"]);
  });

  it("always come on their evening, with a birthday guest too, however the tables fill the end of it", () => {
    // Tables came in and took the last seats, so a regular expected that evening sometimes never came: their seats are
    // kept now. Many evenings, everyone else served at once.
    for (let run = 0; run < 100; run++) {
      const state = withRegulars("Luca", "Gio");
      state.xp = 3000;
      state.customerBook.Luca.birthday = 10;
      state.customerBook.Gio.story = { id: "student", chapter: 2, dueDay: 10 };
      let next = play(state, { type: "openRestaurant" });
      const seen = new Set<string>();
      for (let step = 0; step < 600 && next.service; step++) {
        serviceOf(next).customers.forEach((customer) => seen.add(customer.name));
        next = play({ ...next, service: { ...serviceOf(next), customers: [] } }, { type: "tick", seconds: 0.5 });
      }
      expect(seen.has("Gio"), `evening ${run}: the story guest`).toBe(true);
      expect(seen.has("Luca"), `evening ${run}: the birthday guest`).toBe(true);
    }
  });
});
