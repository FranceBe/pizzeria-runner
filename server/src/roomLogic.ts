// One multiplayer room, as plain data and functions: no Cloudflare in here, so it is tested like the game.
// The Durable Object (index.ts) keeps one of these per room code, saves it, and talks to the players.
import {
  COUNTDOWN_MS, MATCH_SECONDS, MIN_PLAYERS, cleanName, isSharedKitchen, maxPlayersIn,
  type PlayerView, type RoomError, type RoomMode, type RoomStatus, type RoomView,
} from "../../src/multiplayer/protocol";

// A room nobody uses closes after this long; a finished room keeps its code blocked this long, so a late player
// typing it finds "this match is over" rather than strangers' new room.
export const IDLE_MS = 10 * 60_000;
export const COOLDOWN_MS = 10 * 60_000;
// Players whose game never reports the end are counted out this long after the clock runs out.
export const END_GRACE_MS = 15_000;

export interface PlayerData {
  id: string;
  name: string;
  color: number;
  ready: boolean;
  score: number;
  served: number;
  done: boolean;
  connected: boolean;
}

export interface RoomData {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  players: PlayerData[];
  /** The first player in the list is the host. */
  lastActivity: number;
  seed?: string;
  startAt?: number;
  finishedAt?: number;
}

export const createRoom = (code: string, now: number, mode: RoomMode = "challenge"): RoomData => ({
  code,
  mode,
  status: "lobby",
  players: [],
  lastActivity: now,
});

// Why a new player can't come in, or null.
export const joinError = (room: RoomData | undefined): RoomError | null => {
  if (!room) return "notFound";
  if (room.status === "finished") return "over";
  if (room.status === "playing") return "started";
  if (room.players.length >= maxPlayersIn(room.mode)) return "full";
  return null;
};

const freeColor = (room: RoomData): number => [0, 1, 2, 3].find((color) => !room.players.some((player) => player.color === color)) ?? 0;

export const addPlayer = (room: RoomData, id: string, typedName: string, now: number): PlayerData => {
  const player: PlayerData = {
    id,
    name: cleanName(typedName, `Pizzaiolo ${room.players.length + 1}`),
    color: freeColor(room),
    ready: false,
    score: 0,
    served: 0,
    done: false,
    connected: true,
  };
  room.players.push(player);
  room.lastActivity = now;
  return player;
};

// Someone left or lost their connection. In the lobby they are gone (the next one becomes host); during a match they
// stay on the scoreboard with what they had.
export const removePlayer = (room: RoomData, id: string, now: number): void => {
  room.lastActivity = now;
  if (room.status === "lobby") {
    room.players = room.players.filter((player) => player.id !== id);
    return;
  }
  const player = room.players.find((candidate) => candidate.id === id);
  if (player) {
    player.connected = false;
    if (room.status === "playing") player.done = true;
  }
  if (room.status === "playing" && room.players.every((candidate) => candidate.done)) finish(room, now);
};

export const setReady = (room: RoomData, id: string, ready: boolean, now: number): void => {
  const player = room.players.find((candidate) => candidate.id === id);
  if (!player || room.status !== "lobby") return;
  player.ready = ready;
  room.lastActivity = now;
};

// The host starts the match for everyone, with a shared seed. Returns why not, or null.
export const startMatch = (room: RoomData, id: string, seed: string, now: number): RoomError | null => {
  if (room.status !== "lobby") return "started";
  if (room.players[0]?.id !== id) return "notHost";
  if (room.players.length < MIN_PLAYERS) return "tooFew";
  if (room.players.some((player) => !player.ready)) return "notReady";
  room.status = "playing";
  room.seed = seed;
  room.startAt = now + COUNTDOWN_MS;
  room.lastActivity = now;
  room.players.forEach((player) => Object.assign(player, { score: 0, served: 0, done: false }));
  return null;
};

export const recordScore = (room: RoomData, id: string, score: number, served: number, isDone: boolean, now: number): void => {
  const player = room.players.find((candidate) => candidate.id === id);
  if (!player || room.status !== "playing" || player.done) return;
  player.score = score;
  player.served = served;
  player.done = isDone;
  room.lastActivity = now;
  if (room.players.every((candidate) => candidate.done)) finish(room, now);
};

export const finish = (room: RoomData, now: number): void => {
  room.status = "finished";
  room.finishedAt = now;
  room.players.forEach((player) => (player.done = true));
};

// When the match should end at the latest, counting players whose game never said it was over. A duo pizzeria has no
// clock: it stays open while it is being played.
export const matchDeadline = (room: RoomData): number | null =>
  room.startAt === undefined || room.mode === "duo" ? null : room.startAt + MATCH_SECONDS * 1000 + END_GRACE_MS;

// What happens next on its own, and when: the match ends, the idle room closes, or the cooled-down code is freed.
export const nextDeadline = (room: RoomData): { at: number; then: "finish" | "close" | "forget" } => {
  if (room.status === "playing") return { at: matchDeadline(room) ?? room.lastActivity + IDLE_MS, then: "finish" };
  if (room.status === "finished") return { at: (room.finishedAt ?? room.lastActivity) + COOLDOWN_MS, then: "forget" };
  return { at: room.lastActivity + IDLE_MS, then: "close" };
};

export const viewOf = (room: RoomData, now: number): RoomView => ({
  code: room.code,
  mode: room.mode,
  status: room.status,
  players: room.players.map(
    (player, index): PlayerView => ({
      id: player.id,
      name: player.name,
      color: player.color,
      isHost: index === 0,
      ready: player.ready,
      score: player.score,
      served: player.served,
      done: player.done,
      connected: player.connected,
    }),
  ),
  ...(room.seed !== undefined && room.startAt !== undefined ? { seed: room.seed, startsInMs: room.startAt - now } : {}),
});

// Co-op relays: the host's kitchen goes to the other player, the other player's moves go to the host. Only during the
// match, and only in that direction.
export const isHost = (room: RoomData, id: string): boolean => room.players[0]?.id === id;
export const canSendKitchen = (room: RoomData, id: string): boolean =>
  isSharedKitchen(room.mode) && room.status === "playing" && isHost(room, id);
export const canSendMove = (room: RoomData, id: string): boolean =>
  isSharedKitchen(room.mode) && room.status === "playing" && !isHost(room, id) && room.players.some((player) => player.id === id);

// Relays aren't saved one by one (that would cost a write each): the room's activity is noted at most this often, so a
// pizzeria being played never closes for being idle.
export const ACTIVITY_NOTE_MS = 60_000;
export const noteActivity = (room: RoomData, now: number): boolean => {
  if (now - room.lastActivity < ACTIVITY_NOTE_MS) return false;
  room.lastActivity = now;
  return true;
};

// A simple flood guard: at most this many messages per second from one player (a co-op host sends its kitchen a few
// times a second, plus its score).
export const MAX_MESSAGES_PER_SECOND = 20;
export const allowMessage = (counter: { windowStart: number; count: number }, now: number): boolean => {
  if (now - counter.windowStart >= 1000) {
    counter.windowStart = now;
    counter.count = 0;
  }
  counter.count += 1;
  return counter.count <= MAX_MESSAGES_PER_SECOND;
};
