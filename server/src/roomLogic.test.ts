import { describe, it, expect } from "vitest";
import {
  AWAY_GRACE_MS, COUNTDOWN_MS, MATCH_SECONDS, MAX_PLAYERS, MAX_TRAPS, ROOM_CODE_LETTERS, TRAP_COOLDOWN_MS, TRAP_EVERY_SERVED, trapsEarned, cleanName, maxPlayersIn, normalizeRoomCode, parseClientMessage, randomRoomCode, roomModeOf,
} from "../../src/multiplayer/protocol";
import { CHALLENGE_SECONDS } from "../../src/game/challenge";
import {
  ACTIVITY_NOTE_MS, COOLDOWN_MS, END_GRACE_MS, IDLE_MS, MAX_MESSAGES_PER_SECOND, addPlayer, allowMessage, canSendKitchen, canSendMove,
  createRoom, dropAway, joinError, markAway, nextDeadline, noteActivity, recordScore, rejoinPlayer, removePlayer, sendTrap, setLength, setReady, setRoles, startMatch,
  viewOf,
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

  it("are made for the mode asked for, a challenge for anything else", () => {
    expect(roomModeOf({ mode: "royale" })).toBe("royale");
    expect(roomModeOf({ mode: "duo" })).toBe("duo");
    expect(roomModeOf({ mode: "battle" })).toBe("challenge");
    expect(roomModeOf({ mode: ["coop"] })).toBe("challenge");
    expect(roomModeOf(null)).toBe("challenge");
    expect(roomModeOf("coop")).toBe("challenge");
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

  it("lasts as long as the daily challenge, or as long as the host picked", () => {
    expect(MATCH_SECONDS).toBe(CHALLENGE_SECONDS);
    const room = roomWith(2);
    expect(viewOf(room, 0).seconds).toBe(MATCH_SECONDS);
    setLength(room, "p1", 60, 0);
    expect(viewOf(room, 0).seconds).toBe(MATCH_SECONDS);
    setLength(room, "p0", 300, 0);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    expect(nextDeadline(room)).toEqual({ at: COUNTDOWN_MS + 300_000 + END_GRACE_MS, then: "finish" });
    setLength(room, "p0", 60, 0);
    expect(viewOf(room, 0).seconds).toBe(300);
    expect(parseClientMessage('{"type":"length","seconds":61}')).toBeNull();
    expect(parseClientMessage('{"type":"length","seconds":60}')).toEqual({ type: "length", seconds: 60 });
  });

  it("keeps everyone's score, and ends once every player is done", () => {
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    recordScore(room, "p0", 120, 6, "score", 20_000);
    recordScore(room, "p1", 90, 5, "done", 30_000);
    expect(room.status).toBe("playing");
    recordScore(room, "p0", 140, 7, "done", 40_000);
    expect(room.status).toBe("finished");
    expect(viewOf(room, 40_000).players.map((player) => player.score)).toEqual([140, 90]);
    // Nothing changes once over.
    recordScore(room, "p1", 999, 99, "done", 50_000);
    expect(room.players[1].score).toBe(90);
  });

  it("keeps a player who drops out on the scoreboard, with what they had", () => {
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    recordScore(room, "p1", 50, 3, "score", 5000);
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


describe("a player whose phone switched apps", () => {
  const started = (mode: "challenge" | "coop") => {
    const room = createRoom("PZZA", 0, mode);
    addPlayer(room, "host", "Léa", 0, "secret-host", "c1");
    addPlayer(room, "guest", "Tom", 0, "secret-guest", "c2");
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "host", "seed", 0);
    return room;
  };

  it("is away, not gone: the match goes on and nobody else sees their secret", () => {
    const room = started("coop");
    markAway(room, "guest", "c2", 10_000);
    expect(viewOf(room, 10_000).players[1]).toMatchObject({ connected: true, away: true, done: false });
    expect(room.status).toBe("playing");
    expect(JSON.stringify(viewOf(room, 10_000))).not.toContain("secret");
  });

  it("comes back into a started match with their secret, and only with it", () => {
    const room = started("coop");
    markAway(room, "guest", "c2", 10_000);
    expect(joinError(room)).toBe("started");
    expect(rejoinPlayer(room, "guest", "guessed", "c3", 20_000)).toBe(false);
    expect(rejoinPlayer(room, "guest", "secret-guest", "c3", 20_000)).toBe(true);
    expect(viewOf(room, 20_000).players[1].away).toBe(false);
    // The old connection closing late doesn't mark them away again.
    markAway(room, "guest", "c2", 21_000);
    expect(viewOf(room, 21_000).players[1].away).toBe(false);
  });

  it("is dropped once away too long, as if they had left", () => {
    const room = started("challenge");
    markAway(room, "guest", "c2", 10_000);
    dropAway(room, 10_000 + AWAY_GRACE_MS - 1);
    expect(room.players[1].connected).toBe(true);
    dropAway(room, 10_000 + AWAY_GRACE_MS);
    expect(room.players[1]).toMatchObject({ connected: false, done: true });
    expect(rejoinPlayer(room, "guest", "secret-guest", "c3", 10_000 + AWAY_GRACE_MS)).toBe(false);
  });

  it("keeps their place in the lobby, as host too, and the match waits for them", () => {
    const room = createRoom("PZZA", 0);
    addPlayer(room, "host", "Léa", 0, "secret-host", "c1");
    addPlayer(room, "guest", "Tom", 0, "secret-guest", "c2");
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    markAway(room, "host", "c1", 5000);
    expect(viewOf(room, 5000).players[0]).toMatchObject({ isHost: true, away: true });
    expect(nextDeadline(room)).toEqual({ at: 5000 + AWAY_GRACE_MS, then: "drop" });
    expect(startMatch(room, "host", "seed", 6000)).toBe("notReady");
    rejoinPlayer(room, "host", "secret-host", "c3", 7000);
    expect(startMatch(room, "host", "seed", 8000)).toBeNull();
  });
});

describe("scores", () => {
  const playing = () => {
    const room = roomWith(2);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    return room;
  };
  const secondsIn = (seconds: number) => COUNTDOWN_MS + seconds * 1000;

  it("are taken when they could be true", () => {
    const room = playing();
    recordScore(room, "p0", 60, 2, "score", secondsIn(10));
    expect(room.players[0]).toMatchObject({ score: 60, served: 2 });
  });

  it("are refused when they can't be: too many pizzas, too many points, going down, before the start", () => {
    const room = playing();
    recordScore(room, "p0", 100_000, 99, "score", secondsIn(10));
    recordScore(room, "p0", 500, 2, "score", secondsIn(10));
    recordScore(room, "p0", 10, 1, "score", secondsIn(-1));
    expect(room.players[0]).toMatchObject({ score: 0, served: 0 });
    recordScore(room, "p0", 60, 2, "score", secondsIn(10));
    recordScore(room, "p0", 30, 2, "score", secondsIn(12));
    expect(room.players[0]).toMatchObject({ score: 60, served: 2 });
    // A false final score still ends their match, with the last true one.
    recordScore(room, "p0", 99_999, 3, "done", secondsIn(20));
    expect(room.players[0]).toMatchObject({ score: 60, done: true });
  });

  it("count no one out outside a Pizza Royale", () => {
    const room = playing();
    recordScore(room, "p0", 0, 0, "out", secondsIn(5));
    expect(room.players[0].out).toBeUndefined();
    expect(room.players[0].done).toBe(false);
  });
});

describe("a Pizza Royale", () => {
  const royale = (count: number) => {
    const room = createRoom("PZZA", 0, "royale");
    for (let index = 0; index < count; index++) addPlayer(room, `p${index}`, `Player ${index}`, 0);
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "p0", "seed", 0);
    return room;
  };
  const secondsIn = (seconds: number) => COUNTDOWN_MS + seconds * 1000;

  it("lasts five minutes at most, whatever the host picks", () => {
    const room = createRoom("PZZA", 0, "royale");
    addPlayer(room, "p0", "Léa", 0);
    setLength(room, "p0", 60, 0);
    expect(viewOf(room, 0).seconds).toBe(300);
    expect(maxPlayersIn("royale")).toBe(4);
  });

  it("puts players out for good, in order, and ends when one is left", () => {
    const room = royale(3);
    recordScore(room, "p1", 30, 1, "out", secondsIn(10));
    expect(viewOf(room, secondsIn(10)).players[1]).toMatchObject({ out: 1, done: true });
    // Out is final: nothing more counts.
    recordScore(room, "p1", 60, 2, "score", secondsIn(12));
    expect(room.players[1].score).toBe(30);
    expect(room.status).toBe("playing");
    recordScore(room, "p2", 40, 1, "out", secondsIn(20));
    expect(room.status).toBe("finished");
    expect(room.players.map((player) => player.out)).toEqual([undefined, 1, 2]);
  });

  it("counts leaving, or staying away too long, as going out", () => {
    const room = royale(3);
    removePlayer(room, "p2", secondsIn(5));
    expect(room.players[2].out).toBe(1);
    markAway(room, "p1", "", secondsIn(6));
    dropAway(room, secondsIn(6) + AWAY_GRACE_MS);
    expect(room.players[1].out).toBe(2);
    expect(room.status).toBe("finished");
  });

  it("ends on the clock when several are still in", () => {
    const room = royale(2);
    expect(nextDeadline(room)).toEqual({ at: COUNTDOWN_MS + 300_000 + END_GRACE_MS, then: "finish" });
    recordScore(room, "p0", 100, 5, "done", secondsIn(300));
    recordScore(room, "p1", 80, 4, "done", secondsIn(300));
    expect(room.status).toBe("finished");
    expect(room.players.every((player) => player.out === undefined)).toBe(true);
  });
});

describe("Pizza Royale traps", () => {
  // A royale under way, three players in, the first having served enough for `earned` traps by now.
  const royale = (served: number) => {
    const room = createRoom("TRAP", 0, "royale");
    ["a", "b", "c"].forEach((id) => addPlayer(room, id, id.toUpperCase(), 0));
    room.players.forEach((player) => setReady(room, player.id, true, 0));
    startMatch(room, "a", "seed", 0);
    const now = COUNTDOWN_MS + 60_000;
    recordScore(room, "a", served * 20, served, "score", now);
    return { room, now };
  };

  it("are earned by pizzas served, as the server took them, and capped for the match", () => {
    const { room, now } = royale(TRAP_EVERY_SERVED * 2);
    expect(sendTrap(room, "a", "b", now)).toBe("b");
    expect(sendTrap(room, "a", "c", now)).toBe("c");
    expect(sendTrap(room, "a", "b", now + TRAP_COOLDOWN_MS)).toBeNull();
    expect(viewOf(room, now).players[0].traps).toBe(2);
    expect(trapsEarned(1000)).toBe(MAX_TRAPS);
  });

  it("are refused when not earned, to oneself, to or from a player out, or before the start", () => {
    const { room, now } = royale(TRAP_EVERY_SERVED - 1);
    expect(sendTrap(room, "a", "b", now)).toBeNull();
    const ready = royale(TRAP_EVERY_SERVED * 3);
    expect(sendTrap(ready.room, "a", "a", ready.now)).toBeNull();
    expect(sendTrap(ready.room, "a", "nobody", ready.now)).toBeNull();
    recordScore(ready.room, "b", 0, 0, "out", ready.now);
    expect(sendTrap(ready.room, "a", "b", ready.now)).toBeNull();
    expect(sendTrap(ready.room, "b", "c", ready.now)).toBeNull();
    expect(sendTrap(ready.room, "a", "c", COUNTDOWN_MS - 1)).toBeNull();
  });

  it("aren't sent to a player away from the game (they couldn't get it)", () => {
    const { room, now } = royale(TRAP_EVERY_SERVED);
    markAway(room, "b", "", now);
    expect(sendTrap(room, "a", "b", now)).toBeNull();
    expect(room.players[0].traps).toBeUndefined();
  });

  it("give a player a breather between two, and only exist in a Pizza Royale", () => {
    const { room, now } = royale(TRAP_EVERY_SERVED * 3);
    addPlayer(room, "d", "D", 0);
    expect(sendTrap(room, "a", "c", now)).toBe("c");
    expect(sendTrap(room, "b", "c", now + 1000)).toBeNull();
    const challenge = roomWith(2);
    challenge.players.forEach((player) => setReady(challenge, player.id, true, 0));
    startMatch(challenge, "p0", "seed", 0);
    recordScore(challenge, "p0", 200, 10, "score", COUNTDOWN_MS + 60_000);
    expect(sendTrap(challenge, "p0", "p1", COUNTDOWN_MS + 60_000)).toBeNull();
  });

  it("are read from a phone as a player's id, and nothing else", () => {
    expect(parseClientMessage(JSON.stringify({ type: "trap", to: "b" }))).toEqual({ type: "trap", to: "b" });
    expect(parseClientMessage(JSON.stringify({ type: "trap", to: 3 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "trap", to: "x".repeat(65) }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "trap" }))).toBeNull();
  });

  it("start again from nothing with each match", () => {
    const { room, now } = royale(TRAP_EVERY_SERVED);
    sendTrap(room, "a", "b", now);
    room.status = "lobby";
    room.players.forEach((player) => setReady(room, player.id, true, now));
    startMatch(room, "a", "seed2", now);
    expect(room.players[0].traps).toBeUndefined();
    expect(room.players[1].trappedAt).toBeUndefined();
  });
});

describe("roles in a shared kitchen", () => {
  it("are the host's to pick, in the lobby, for co-op and duo rooms only", () => {
    const coop = createRoom("COOP", 0, "coop");
    addPlayer(coop, "h", "H", 0);
    addPlayer(coop, "g", "G", 0);
    expect(viewOf(coop, 0).roles).toBe("free");
    setRoles(coop, "g", "hostServes", 1);
    expect(viewOf(coop, 1).roles).toBe("free");
    setRoles(coop, "h", "hostCooks", 1);
    expect(viewOf(coop, 1).roles).toBe("hostCooks");
    coop.players.forEach((player) => setReady(coop, player.id, true, 2));
    startMatch(coop, "h", "seed", 2);
    setRoles(coop, "h", "free", 3);
    expect(viewOf(coop, 3).roles).toBe("hostCooks");
    const challenge = roomWith(2);
    setRoles(challenge, "p0", "hostCooks", 1);
    expect(viewOf(challenge, 1).roles).toBe("free");
  });

  it("are read from a phone as one of the three choices only", () => {
    expect(parseClientMessage(JSON.stringify({ type: "roles", roles: "hostServes" }))).toEqual({ type: "roles", roles: "hostServes" });
    expect(parseClientMessage(JSON.stringify({ type: "roles", roles: "everyone" }))).toBeNull();
  });
});
