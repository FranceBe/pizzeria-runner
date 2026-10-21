import { describe, it, expect } from "vitest";
import {
  COUNTDOWN_MS, MATCH_SECONDS, MAX_PLAYERS, ROOM_CODE_LETTERS, cleanName, normalizeRoomCode, parseClientMessage, randomRoomCode,
} from "../../src/multiplayer/protocol";
import { CHALLENGE_SECONDS } from "../../src/game/challenge";
import {
  ACTIVITY_NOTE_MS, COOLDOWN_MS, END_GRACE_MS, IDLE_MS, MAX_MESSAGES_PER_SECOND, addPlayer, allowMessage, canSendKitchen, canSendMove,
  createRoom, joinError, nextDeadline, noteActivity, recordScore, removePlayer, setReady, startMatch, viewOf,
} from "./roomLogic";

const roomWith = (count: number) => {
  const room = createRoom("PZZA", 0);
  for (let index = 0; index < count; index++) addPlayer(room, `p${index}`, `Player ${index}`, 0);
  return room;
};

describe("room codes", () => {
  it("are four letters that can't be mixed up, never a rude word", () => {
    const codes = Array.from({ length: 2000 }, () => randomRoomCode());
    codes.forEach((code) => {
      expect(code).toMatch(/^[A-Z]{4}$/);
      expect([...code].every((letter) => ROOM_CODE_LETTERS.includes(letter))).toBe(true);
    });
    expect(codes.join("")).not.toMatch(/[ILO]/);
    // A generator stuck on a blocked word moves on to the next draw.
    const draws = [..."CACA"].map((letter) => ROOM_CODE_LETTERS.indexOf(letter) / ROOM_CODE_LETTERS.length);
    let call = 0;
    expect(randomRoomCode(() => (call < 4 ? draws[call++] : 0))).toBe("AAAA");
  });

  it("are read from what a player typed, or refused", () => {
    expect(normalizeRoomCode(" pz-za ")).toBe("PZZA");
    expect(normalizeRoomCode("PIZZ")).toBeNull();
    expect(normalizeRoomCode("ABC")).toBeNull();
  });
});

describe("a room", () => {
  it("lets players in up to four, the first one as host, each with their own colour", () => {
    const room = roomWith(MAX_PLAYERS);
    expect(joinError(room)).toBe("full");
    expect(new Set(room.players.map((player) => player.color)).size).toBe(MAX_PLAYERS);
    expect(viewOf(room, 0).players.map((player) => player.isHost)).toEqual([true, false, false, false]);
  });

  it("tells why nobody can come in: no such room, already playing, over", () => {
    expect(joinError(undefined)).toBe("notFound");
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    expect(joinError(room)).toBe("started");
    room.status = "finished";
    expect(joinError(room)).toBe("over");
  });

  it("cleans nicknames: no markup, no control characters, not too long", () => {
    expect(cleanName("  <b>Léa</b>\u0007  ", "?")).toBe("bLéa/b");
    expect(cleanName("   ", "Pizzaiolo 1")).toBe("Pizzaiolo 1");
    expect(cleanName("A very very long nickname indeed", "?")).toHaveLength(16);
  });

  it("hands the host role to the next player when the host leaves the lobby", () => {
    const room = roomWith(3);
    removePlayer(room, "p0", 1);
    expect(viewOf(room, 1).players.map((player) => [player.id, player.isHost])).toEqual([["p1", true], ["p2", false]]);
  });
});

describe("a match", () => {
  it("starts only by the host, with at least two players, all in their morning prep", () => {
    const room = roomWith(2);
    expect(startMatch(room, "p0", "seed", 0)).toBe("notReady");
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    expect(startMatch(room, "p1", "seed", 0)).toBe("notHost");
    expect(startMatch(roomWith(1), "p0", "seed", 0)).toBe("tooFew");
    expect(startMatch(room, "p0", "seed-42", 1000)).toBeNull();
    expect(viewOf(room, 1000)).toMatchObject({ status: "playing", seed: "seed-42", startsInMs: COUNTDOWN_MS });
  });

  it("lasts as long as the daily challenge", () => {
    expect(MATCH_SECONDS).toBe(CHALLENGE_SECONDS);
  });

  it("keeps everyone's score, and ends once every player is done", () => {
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    recordScore(room, "p0", 120, 6, false, 10_000);
    recordScore(room, "p1", 90, 5, true, 20_000);
    expect(room.status).toBe("playing");
    recordScore(room, "p0", 140, 7, true, 30_000);
    expect(room.status).toBe("finished");
    expect(viewOf(room, 30_000).players.map((player) => player.score)).toEqual([140, 90]);
    // Nothing changes once over.
    recordScore(room, "p1", 999, 99, true, 40_000);
    expect(room.players[1].score).toBe(90);
  });

  it("keeps a player who drops out on the scoreboard, with what they had", () => {
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    recordScore(room, "p1", 50, 3, false, 5000);
    removePlayer(room, "p1", 6000);
    expect(room.players[1]).toMatchObject({ score: 50, done: true, connected: false });
    expect(room.status).toBe("playing");
  });
});

describe("a room's own clock", () => {
  it("ends a match whose players went quiet, closes an idle room, and keeps a finished room's code blocked a while", () => {
    const lobby = roomWith(1);
    expect(nextDeadline(lobby)).toEqual({ at: IDLE_MS, then: "close" });
    const playing = roomWith(2);
    playing.players.forEach((player) => setReady(playing, player.id, true, 0));
    startMatch(playing, "p0", "seed", 0);
    expect(nextDeadline(playing)).toEqual({ at: COUNTDOWN_MS + MATCH_SECONDS * 1000 + END_GRACE_MS, then: "finish" });
    playing.status = "finished";
    playing.finishedAt = 200_000;
    expect(nextDeadline(playing)).toEqual({ at: 200_000 + COOLDOWN_MS, then: "forget" });
  });
});

describe("messages", () => {
  it("are read safely: unknown, malformed or huge ones are dropped, scores are whole and bounded", () => {
    expect(parseClientMessage('{"type":"score","score":12.6,"served":-3}')).toEqual({ type: "score", score: 13, served: 0 });
    expect(parseClientMessage('{"type":"score","score":"lots"}')).toEqual({ type: "score", score: 0, served: 0 });
    expect(parseClientMessage('{"type":"hack"}')).toBeNull();
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage(`{"type":"start","x":"${"a".repeat(600)}"}`)).toBeNull();
  });

  it("are limited per player and per second", () => {
    const counter = { windowStart: 0, count: 0 };
    const allowed = Array.from({ length: MAX_MESSAGES_PER_SECOND + 3 }, () => allowMessage(counter, 500)).filter(Boolean);
    expect(allowed).toHaveLength(MAX_MESSAGES_PER_SECOND);
    expect(allowMessage(counter, 1600)).toBe(true);
  });
});

describe("co-op rooms", () => {
  const coopRoom = () => {
    const room = createRoom("PZZA", 0, "coop");
    addPlayer(room, "host", "Léa", 0);
    addPlayer(room, "guest", "Tom", 0);
    return room;
  };

  it("hold two players", () => {
    expect(joinError(coopRoom())).toBe("full");
    expect(viewOf(coopRoom(), 0).mode).toBe("coop");
  });

  it("let the host send the kitchen and the other player send moves, only during the match", () => {
    const room = coopRoom();
    expect(canSendKitchen(room, "host")).toBe(false);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "host", "seed", 0);
    expect(canSendKitchen(room, "host")).toBe(true);
    expect(canSendKitchen(room, "guest")).toBe(false);
    expect(canSendMove(room, "guest")).toBe(true);
    expect(canSendMove(room, "host")).toBe(false);
    expect(canSendMove(room, "stranger")).toBe(false);
  });

  it("never relay in a challenge room", () => {
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    expect(canSendKitchen(room, "p0")).toBe(false);
    expect(canSendMove(room, "p1")).toBe(false);
  });

  it("read the kitchen and moves, with size limits", () => {
    expect(parseClientMessage(JSON.stringify({ type: "state", state: "{}" }))).toEqual({ type: "state", state: "{}" });
    expect(parseClientMessage(JSON.stringify({ type: "action", action: { type: "bake" } }))).toEqual({ type: "action", action: { type: "bake" } });
    expect(parseClientMessage(JSON.stringify({ type: "action", action: { type: "bake", junk: "x".repeat(3000) } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "action", action: "bake" }))).toBeNull();
  });
});

describe("duo rooms", () => {
  it("hold two players and stay open while played: no match clock, closed only when idle", () => {
    const room = createRoom("PZZA", 0, "duo");
    addPlayer(room, "host", "Léa", 0);
    addPlayer(room, "guest", "Tom", 0);
    expect(joinError(room)).toBe("full");
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "host", "seed", 0);
    expect(nextDeadline(room)).toEqual({ at: IDLE_MS, then: "finish" });
    expect(canSendKitchen(room, "host")).toBe(true);
    expect(canSendMove(room, "guest")).toBe(true);
  });

  it("note that relays are activity, at most once a minute (each note is a write)", () => {
    const room = createRoom("PZZA", 0, "duo");
    expect(noteActivity(room, 30_000)).toBe(false);
    expect(noteActivity(room, ACTIVITY_NOTE_MS)).toBe(true);
    expect(room.lastActivity).toBe(ACTIVITY_NOTE_MS);
    expect(nextDeadline(room).at).toBe(ACTIVITY_NOTE_MS + IDLE_MS);
  });
});

