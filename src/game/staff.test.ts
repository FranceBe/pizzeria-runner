import { describe, it, expect, vi, afterEach } from "vitest";
import { makeState, play, stateInService, makeCustomer, serviceOf, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { APPRENTICE_DAYS, CANDIDATES_PER_ROLE, GREEDY_TIP_SHARE, STAFF_NAMES, STAFF_ROLES, WAITER_SECONDS, tipShareOf, wageOf, type StaffRole } from "../data/staff";
import { UPGRADES } from "../data/progression";
import { candidatesFor, ensureCandidates, maybeResign, vacantPosts, waiterSeconds } from "./staff";
import { commisLevel } from "./commis";
import { dailyCharges } from "./economy";
import { hydrateState } from "./state";
import type { GameState } from "./types";
import type { Difficulty } from "./playOptions";
import { seededRandom } from "../utils/random";

afterEach(() => vi.restoreAllMocks());

const XP_LEVEL_10 = 30000;
// Every post open, these people at work.
const staffed = (overrides: Partial<GameState> = {}): GameState => {
  const state = makeState({ day: 10, xp: XP_LEVEL_10, money: 5000, upgrades: { ...makeState().upgrades, commis: 2, bar: 3, waiter: 1 }, ...overrides });
  state.commis ??= { name: "Charlie", fatigue: 0, hiredDay: 1 };
  state.barman ??= { name: "Lior", hiredDay: 1 };
  state.waiter ??= { name: "Ari", hiredDay: 1 };
  ensureCandidates(state);
  return state;
};

describe("the staff", () => {
  it("fills a post as soon as its upgrade opens it: the commis, the barman at bar level 3, the waiter", () => {
    let state = makeState({ money: 5000, xp: XP_LEVEL_10 });
    state = play(state, { type: "buyUpgrade", upgradeKey: "commis" });
    expect(STAFF_NAMES.commis).toContain(state.commis?.name);
    state = play(state, { type: "buyUpgrade", upgradeKey: "bar" }, { type: "buyUpgrade", upgradeKey: "bar" });
    expect(state.barman).toBeUndefined();
    state = play(state, { type: "buyUpgrade", upgradeKey: "bar" });
    expect(STAFF_NAMES.barman).toContain(state.barman?.name);
    state = play(state, { type: "buyUpgrade", upgradeKey: "waiter" });
    expect(STAFF_NAMES.waiter).toContain(state.waiter?.name);
    expect(state.toasts.map((toast) => toast.key)).toContain("staffHired");
  });

  it("brings three new candidates for each post every week, never whoever works there, who stays", () => {
    const state = staffed();
    STAFF_ROLES.forEach((role) => {
      expect(candidatesFor(state, role)).toHaveLength(CANDIDATES_PER_ROLE);
      expect(candidatesFor(state, role)).not.toContain(state[role]?.name);
    });
    const monday = state.staffCandidates;
    let next = state;
    for (let day = 10; day < 14; day++) next = play(next, { type: "startNextDay" });
    expect(next.day).toBe(14);
    expect(next.staffCandidates).toEqual(monday);
    next = play(next, { type: "startNextDay" });
    expect(next.staffCandidates?.week).toBe(2);
    expect(next.commis?.name).toBe("Charlie");
    expect(next.barman?.name).toBe("Lior");
  });

  it("hires one of the candidates in the morning; whoever was there goes back among them", () => {
    const state = staffed();
    const [name] = candidatesFor(state, "barman");
    const hired = play(state, { type: "hireStaff", role: "barman", name });
    expect(hired.barman).toEqual({ name, hiredDay: 10 });
    expect(candidatesFor(hired, "barman")).toContain("Lior");
    expect(candidatesFor(hired, "barman")).not.toContain(name);
    // Not someone who isn't a candidate, nor during service.
    expect(play(state, { type: "hireStaff", role: "barman", name: "Nobody" }).barman?.name).toBe("Lior");
    const inService = stateInService([makeCustomer()], staffed());
    expect(play(inService, { type: "hireStaff", role: "barman", name }).barman?.name).toBe("Lior");
  });

  it("lets someone go in the morning: the post waits, they stay among the candidates", () => {
    const state = play(staffed(), { type: "fireStaff", role: "commis" });
    expect(state.commis).toBeUndefined();
    expect(vacantPosts(state)).toEqual(["commis"]);
    expect(candidatesFor(state, "commis")).toContain("Charlie");
    expect(commisLevel(state)).toBe(0);
    expect(play(state, { type: "hireStaff", role: "commis", name: "Charlie" }).commis?.name).toBe("Charlie");
  });

  it("keeps a post left vacant empty after reloading the save", () => {
    const state = play(staffed(), { type: "fireStaff", role: "commis" }, { type: "fireStaff", role: "barman" });
    const loaded = hydrateState(toJson(state));
    expect(loaded.commis).toBeUndefined();
    expect(loaded.barman).toBeUndefined();
    expect(vacantPosts(loaded)).toEqual(["commis", "barman"]);
  });

  it("changes the evening's charges by exactly what each one costs, in every post", () => {
    const empty = (role: StaffRole) => {
      const state = staffed();
      state[role] = undefined;
      return dailyCharges(state);
    };
    STAFF_ROLES.forEach((role) => {
      const without = empty(role);
      STAFF_NAMES[role].forEach((name) => {
        const state = staffed();
        if (role === "commis") state.commis = { name, fatigue: 0, hiredDay: 1 };
        else state[role] = { name, hiredDay: 1 };
        expect(dailyCharges(state) - without, `${role} ${name}`).toBe(wageOf(role, name));
        expect(wageOf(role, name), `${role} ${name}`).toBeGreaterThanOrEqual(0);
      });
    });
    // The commis's evening off: neither the post's upkeep nor the wage.
    const withNoa = staffed({ commis: { name: "Noa", fatigue: 0, hiredDay: 1 } });
    const off = play(withNoa, { type: "toggleCommisOff" });
    expect(dailyCharges(withNoa) - dailyCharges(off)).toBe(UPGRADES.commis.dailyCharge * 2 + wageOf("commis", "Noa"));
  });

  it("changes the charges when the player hires someone else, and only then", () => {
    const state = staffed();
    const before = dailyCharges(state);
    const name = candidatesFor(state, "commis")[0];
    const hired = play(state, { type: "hireStaff", role: "commis", name });
    expect(dailyCharges(hired) - before).toBe(wageOf("commis", name) - wageOf("commis", "Charlie"));
    // A new week: new candidates, the same person, the same charges.
    let later = hired;
    for (let day = 0; day < 7; day++) later = play(later, { type: "startNextDay" });
    expect(later.commis?.name).toBe(name);
    expect(dailyCharges(later)).toBe(dailyCharges({ ...hired, day: later.day }));
  });

  it("has one flawless person in each post, free in charges, who keeps a quarter of the evening's tips at closing", () => {
    const greedy = { commis: "Ezra", barman: "Rio", waiter: "Lumi" } as const;
    STAFF_ROLES.forEach((role) => {
      expect(wageOf(role, greedy[role])).toBe(0);
      expect(tipShareOf(role, greedy[role])).toBe(GREEDY_TIP_SHARE);
      expect(STAFF_NAMES[role].filter((name) => tipShareOf(role, name) > 0)).toEqual([greedy[role]]);
    });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const evening = (overrides: Partial<GameState>) => {
      const open = play(staffed(overrides), { type: "openRestaurant" });
      serviceOf(open).stats.tips = 40;
      return play(open, { type: "closeEarly" }).summary;
    };
    const steady = evening({});
    expect(steady?.tipCut).toBeUndefined();
    const one = evening({ commis: { name: "Ezra", fatigue: 0, hiredDay: 1 } });
    expect(one?.tipCut).toBe(10);
    expect(one?.charges).toBe((steady?.charges ?? 0) - wageOf("commis", "Charlie") + 10);
    const all = evening({ commis: { name: "Ezra", fatigue: 0, hiredDay: 1 }, barman: { name: "Rio" }, waiter: { name: "Lumi" } });
    expect(all?.tipCut).toBe(30);
    // On their evening off, Ezra keeps nothing.
    const offDay = staffed({ commis: { name: "Ezra", fatigue: 0, hiredDay: 1 } });
    const rested = play(play(offDay, { type: "toggleCommisOff" }), { type: "openRestaurant" });
    serviceOf(rested).stats.tips = 40;
    expect(play(rested, { type: "closeEarly" }).summary?.tipCut).toBeUndefined();
  });

  it("can see someone hand in their notice, in hardcore only", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const normal = staffed();
    maybeResign(normal);
    expect(normal.commis?.name).toBe("Charlie");
    const hardcore = play(staffed(), { type: "setDifficulty", difficulty: "hardcore" });
    maybeResign(hardcore);
    expect(vacantPosts(hardcore)).toEqual(["commis", "barman", "waiter"]);
    expect(hardcore.toasts.filter((toast) => toast.key === "staffQuit")).toHaveLength(3);
  });

  it("loses someone now and then over a long hardcore game (never in the other levels), the post empty until rehired", () => {
    const mornings = (difficulty: Difficulty) => {
      vi.spyOn(Math, "random").mockImplementation(seededRandom(42));
      let state = play(staffed(), { type: "setDifficulty", difficulty });
      const seen = new Set(state.toasts.map((toast) => toast.id));
      let quits = 0;
      for (let day = 0; day < 150; day++) {
        state = play(state, { type: "startNextDay" });
        const fresh = state.toasts.filter((toast) => !seen.has(toast.id));
        fresh.forEach((toast) => seen.add(toast.id));
        const quitting = fresh.filter((toast) => toast.key === "staffQuit");
        quits += quitting.length;
        quitting.forEach((toast) => {
          const role = (toast.params as { role: StaffRole }).role;
          expect(state[role], "gone").toBeUndefined();
          expect(vacantPosts(state)).toContain(role);
        });
        // Whoever left is replaced in the morning, by one of the week's candidates.
        vacantPosts(state).forEach((role) => {
          const [name] = candidatesFor(state, role);
          state = play(state, { type: "hireStaff", role, name });
          expect(state[role]?.name).toBe(name);
        });
        expect(vacantPosts(state)).toEqual([]);
      }
      vi.restoreAllMocks();
      return quits;
    };
    const hardcore = mornings("hardcore");
    // Three people, 3% a morning each, 150 mornings: about 13 notices.
    expect(hardcore).toBeGreaterThanOrEqual(4);
    expect(hardcore).toBeLessThanOrEqual(30);
    (["gentle", "easy", "normal", "hard"] as const).forEach((level) => expect(mornings(level), level).toBe(0));
  });

  it("keeps the barman of older saves, the steady one", () => {
    const old = toJson({ ...makeState({ upgrades: { ...makeState().upgrades, bar: 3 } }), barman: undefined });
    expect(hydrateState(old).barman?.name).toBe("Lior");
    expect(hydrateState(toJson(makeState())).barman).toBeUndefined();
  });
});

describe("the commis's ways", () => {
  const bakeFor = (commis: string): string[] => {
    const state = stateInService([makeCustomer()], staffed({ commis: { name: commis, fatigue: 0, hiredDay: 1 } }));
    return serviceOf(play(state, ...toggle(...MARGHERITA), { type: "bake" })).board;
  };

  it("sometimes forget the dough", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    expect(bakeFor("Alex")).toEqual([]);
    expect(bakeFor("Charlie")).toEqual(["pate"]);
  });

  it("chat with the queue (the wait counts slower), keep pizzas warm on the pass", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const wait = (commis: string) => {
      const state = stateInService([makeCustomer()], staffed({ commis: { name: commis, fatigue: 0, hiredDay: 1 } }));
      serviceOf(state).nextArrivalIn = 999;
      serviceOf(state).ready = [{ id: "p", ingredients: ["pate"], waitingSeconds: 0 }];
      const after = serviceOf(play(state, { type: "tick", seconds: 10 }));
      return { waited: after.customers[0].waitedSeconds, onThePass: after.ready.find((pizza) => pizza.id === "p")?.waitingSeconds };
    };
    expect(wait("Sam").waited).toBeCloseTo(wait("Charlie").waited * 0.9);
    expect(wait("Noa").onThePass).toBeCloseTo(6);
    expect(wait("Charlie").onThePass).toBeCloseTo(10);
  });

  it("learn first, when they are apprentices: a level lower for their first days", () => {
    const eden = (hiredDay: number) => staffed({ commis: { name: "Eden", fatigue: 0, hiredDay } });
    expect(commisLevel(eden(10))).toBe(1);
    expect(commisLevel(eden(10 - APPRENTICE_DAYS))).toBe(2);
    // Hired in an older save: long ago.
    expect(commisLevel(staffed({ commis: { name: "Eden", fatigue: 0 } }))).toBe(2);
  });

  it("tire at their own pace", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const evening = (commis: string) => {
      const open = play(staffed({ commis: { name: commis, fatigue: 0, hiredDay: 1 } }), { type: "openRestaurant" });
      serviceOf(open).stats.served = 20;
      return play(open, { type: "closeEarly" }).commis?.fatigue;
    };
    expect(evening("Charlie")).toBe(20);
    expect(evening("Lou")).toBeCloseTo(32);
    expect(evening("Andrea")).toBeCloseTo(9);
  });
});

describe("the barman's and the waiter's ways", () => {
  const thirsty = (barman: string) => {
    const state = stateInService([makeCustomer({ drink: "vin" })], staffed({ barman: { name: barman, hiredDay: 1 } }));
    serviceOf(state).nextArrivalIn = 999;
    return state;
  };

  it("pour at their own pace, now and then the wrong drink, and some charm a tip out of each drink", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(serviceOf(play(thirsty("Marin"), { type: "tick", seconds: 4 })).customers[0]?.drinkServed ?? true).toBe(true);
    expect(serviceOf(play(thirsty("Lior"), { type: "tick", seconds: 4 })).customers[0].drinkServed).toBeFalsy();
    const charmed = play(thirsty("Swann"), { type: "tick", seconds: 6 });
    expect(charmed.pops.map((pop) => pop.kind)).toContain("tip");
    vi.spyOn(Math, "random").mockReturnValue(0);
    const wrong = play(thirsty("Maé"), { type: "tick", seconds: 4 });
    expect(serviceOf(wrong).tray?.length).toBe(1);
    expect(serviceOf(wrong).customers[0].drinkServed).toBeFalsy();
  });

  it("take a ready pizza to its table every so often, never in a challenge", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = stateInService([makeCustomer(), makeCustomer({ id: "b", name: "Giulia" })], staffed());
    const service = serviceOf(state);
    service.nextArrivalIn = 999;
    service.ready = [{ id: "p", ingredients: [...MARGHERITA], waitingSeconds: 0 }];
    expect(waiterSeconds(state)).toBe(WAITER_SECONDS[1]);
    const before = play(state, { type: "tick", seconds: WAITER_SECONDS[1] - 1 });
    expect(serviceOf(before).ready).toHaveLength(1);
    const served = play(before, { type: "tick", seconds: 1 });
    expect(serviceOf(served).ready).toHaveLength(0);
    expect(serviceOf(served).stats.served).toBe(1);
    // Tao is quicker, Dani slower.
    expect(waiterSeconds(staffed({ waiter: { name: "Tao" } }))).toBeLessThan(WAITER_SECONDS[1]);
    expect(waiterSeconds(staffed({ waiter: { name: "Dani" } }))).toBeGreaterThan(WAITER_SECONDS[1]);
    const challenge = staffed();
    challenge.settings.tutorialDone = true;
    const match = play(challenge, { type: "startChallenge", date: "2026-10-25" });
    serviceOf(match).ready = [{ id: "p", ingredients: [...MARGHERITA], waitingSeconds: 0 }];
    serviceOf(match).customers = [makeCustomer()];
    expect(serviceOf(play(match, { type: "tick", seconds: 20 })).ready).toHaveLength(1);
  });
});
