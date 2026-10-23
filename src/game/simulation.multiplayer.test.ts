// Robots playing together: friends' challenges of every length and Pizza Royale (each in their own game), a quick
// co-op (two robots in one kitchen, as the host's phone runs it), and a duo pizzeria over several days. All along,
// an honest robot's score must always pass the server's checks (isPlausibleScore): they would stop a cheat, never a
// good player.
import { describe, it, expect, vi, afterEach } from "vitest";
import { seededRandom } from "../utils/random";
import { makeState } from "../test/helpers";
import { lateGame } from "../test/fixtures";
import { checkInvariants, nextMove, runMorning, type RobotStyle } from "../test/robot";
import { createCoopGame, createDuoKitchen, coopViewFor, decodeCoop, encodeCoop, isCoopMove, isPartnerDuoMove, playCoopMove, tickCoop, type CoopGame } from "../multiplayer/coop";
import { MATCH_LENGTHS, ROYALE_SECONDS, isPlausibleScore, type RoomMode } from "../multiplayer/protocol";
import { gameReducer } from "./reducer";
import type { GameState } from "./types";

afterEach(() => vi.restoreAllMocks());

const ready = (): GameState => {
  const state = makeState({ day: 5 });
  state.settings.tutorialDone = true;
  return state;
};

// Plays one player's match to its end, checking the score against the server's rule at every step.
const playMatch = (start: GameState, mode: RoomMode, seconds: number, style: RobotStyle, random: () => number): GameState => {
  let state = start;
  let reported = { score: 0, served: 0 };
  let steps = 0;
  while (state.service && steps < 20_000) {
    state = gameReducer(state, nextMove(state, style, random));
    state = gameReducer(state, { type: "tick", seconds: 0.25 });
    steps += 1;
    const challenge = state.service?.challenge;
    if (challenge) {
      const report = { score: challenge.score, served: state.service?.stats.served ?? 0 };
      expect(isPlausibleScore(report, reported, seconds - challenge.secondsLeft, mode), `an honest score at ${seconds - challenge.secondsLeft}s`).toBe(true);
      reported = report;
      checkInvariants(state);
    }
  }
  expect(state.challengeResult?.multiplayer).toBe(true);
  return state;
};

describe("friends' challenges", () => {
  it.each(MATCH_LENGTHS)("last %i seconds, and an honest score always passes the server's checks", (seconds) => {
    const random = seededRandom(seconds);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = gameReducer(ready(), { type: "startChallenge", date: `seed-${seconds}`, multiplayer: true, seconds });
    const end = playMatch(start, "challenge", seconds, "careful", random);
    expect(end.challengeResult?.score).toBeGreaterThan(0);
    // A friends' match never counts as the daily challenge.
    expect(end.dailyChallenge).toBeNull();
  }, 120_000);
});

describe("Pizza Royale", () => {
  it("a careful robot plays it out; a sloppy one is soon out, for a reason", () => {
    const random = seededRandom(1234);
    vi.spyOn(Math, "random").mockImplementation(random);
    const royale = (state: GameState) => gameReducer(state, { type: "startChallenge", date: "royale-seed", multiplayer: true, seconds: ROYALE_SECONDS, royale: true });
    const careful = playMatch(royale(ready()), "royale", ROYALE_SECONDS, "careful", random);
    expect(careful.challengeResult?.royale).toBe(true);
    const sloppy = playMatch(royale(ready()), "royale", ROYALE_SECONDS, "sloppy", random);
    expect(["waste", "unwantedPizza"]).toContain(sloppy.challengeResult?.out);
    // Nothing is left of the match in the player's own game.
    expect(sloppy.service).toBeNull();
    expect(sloppy.phase).toBe("prep");
  }, 120_000);
});

// Both players' moves, in turn, as their phones would send them; the host's clock runs the kitchen.
const playTogether = (start: CoopGame, players: readonly [string, string], random: () => number, isDone: (coop: CoopGame) => boolean, maxSteps = 8000): CoopGame => {
  let coop = start;
  const [host, partner] = players;
  let steps = 0;
  while (!isDone(coop) && steps < maxSteps) {
    for (const player of players) {
      const other = player === host ? partner : host;
      const view = coopViewFor(coop, player, { id: other, color: 0, name: other });
      const action = nextMove(view, "careful", random);
      const isAllowed = player === host || (coop.duo ? isPartnerDuoMove(action) : isCoopMove(action));
      if (isAllowed) coop = playCoopMove(coop, player, action);
    }
    coop = tickCoop(coop, 0.25);
    steps += 1;
    // Each player's order still exists, and they never stand on the same one by the game's own choice.
    const customers = coop.game.service?.customers.map((customer) => customer.id) ?? [];
    Object.values(coop.boards).forEach((board) => {
      if (board.selectedCustomerId && board.selectedCustomerId !== "batch") expect(customers).toContain(board.selectedCustomerId);
    });
    if (steps % 500 === 0) {
      checkInvariants(coop.game);
      // The kitchen travels to the other phone and back whole.
      expect(decodeCoop(encodeCoop(coop))).toEqual(coop);
    }
  }
  return coop;
};

describe("a quick co-op", () => {
  it("two robots share one kitchen to the end, with a team score", () => {
    const random = seededRandom(55);
    vi.spyOn(Math, "random").mockImplementation(random);
    let reported = { score: 0, served: 0 };
    const end = playTogether(createCoopGame("coop-seed", ["host", "guest"], "fr", 120), ["host", "guest"], random, (coop) => {
      const challenge = coop.game.service?.challenge;
      if (challenge) {
        const report = { score: challenge.score, served: coop.game.service?.stats.served ?? 0 };
        expect(isPlausibleScore(report, reported, 120 - challenge.secondsLeft, "coop")).toBe(true);
        reported = report;
      }
      return Boolean(coop.game.challengeResult);
    });
    expect(end.game.challengeResult).toMatchObject({ multiplayer: true, coop: true });
    expect(end.game.challengeResult?.score).toBeGreaterThan(0);
  }, 120_000);

  it("two robots with roles still get through it: one at the board, one at the pass, each move on its own side", () => {
    const random = seededRandom(56);
    vi.spyOn(Math, "random").mockImplementation(random);
    const start = createCoopGame("coop-seed", ["host", "guest"], "fr", 120, "hostCooks");
    expect(start.roles).toEqual({ host: "cook", guest: "pass" });
    const end = playTogether(start, ["host", "guest"], random, (coop) => Boolean(coop.game.challengeResult));
    expect(end.game.challengeResult?.score).toBeGreaterThan(0);
  }, 120_000);
});

describe("a duo pizzeria", () => {
  it("two robots run it for several days: the host's mornings, both cooking, the receipt, the next day", () => {
    const random = seededRandom(66);
    vi.spyOn(Math, "random").mockImplementation(random);
    const info = { id: "duo-1", name: "Chez Léa & Tom", members: ["Léa", "Tom"] };
    let coop = createDuoKitchen(lateGame(), ["host", "partner"], info);
    const days = 5;
    for (let day = 0; day < days; day++) {
      // The morning is the host's: straight on the game, as the host's phone does.
      coop = { ...coop, game: runMorning(coop.game, random) };
      coop = playCoopMove(coop, "host", { type: "openRestaurant" });
      expect(coop.game.phase).toBe("service");
      coop = playTogether(coop, ["host", "partner"], random, (kitchen) => kitchen.game.phase !== "service");
      if (coop.game.phase === "service") coop = playCoopMove(coop, "host", { type: "closeEarly" });
      expect(coop.game.phase).toBe("summary");
      checkInvariants(coop.game);
      expect(coop.duo).toEqual(info);
      coop = playCoopMove(coop, "host", { type: "startNextDay" });
    }
    expect(coop.game.history).toHaveLength(days);
    expect(coop.game.lifetime.served).toBeGreaterThan(days * 5);
    // Only the host decides the big things; the partner cooks, serves and restocks.
    (["openRestaurant", "startNextDay", "closeEarly", "restartDay"] as const).forEach((type) => expect(isPartnerDuoMove({ type })).toBe(false));
    expect(isPartnerDuoMove({ type: "bake" })).toBe(true);
  }, 120_000);
});
