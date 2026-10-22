// One multiplayer room, as plain data and functions: no Cloudflare in here, so it is tested like the game.
// The Durable Object (index.ts) keeps one of these per room code, saves it, and talks to the players.
import {
  AWAY_GRACE_MS, COUNTDOWN_MS, MATCH_SECONDS, MIN_PLAYERS, ROYALE_SECONDS, cleanName, isPlausibleScore, isSharedKitchen, maxPlayersIn,
  type MatchSeconds, type PlayerView, type RoomError, type RoomMode, type RoomStatus, type RoomView,
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
  /** Still in the room (false once they left for good). */
  connected: boolean;
  /** The secret their phone uses to come back after losing its connection; never shown to the others. */
  token: string;
  /** Their connection now: an older one closing must not mark them away. */
  connection: string;
  /** When their connection dropped (a phone switching apps), if it has: their place is kept a while. */
  awaySince?: number;
  /** Pizza Royale: out of the match, in this order (1 for the first one out). Final. */
  out?: number;
}

export interface RoomData {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  players: PlayerData[];
  /** How long the match lasts (rooms from before the choice have none: the default). */
  seconds?: MatchSeconds;
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
  ...(mode === "royale" ? { seconds: ROYALE_SECONDS } : {}),
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

export const addPlayer = (room: RoomData, id: string, typedName: string, now: number, token = "", connection = ""): PlayerData => {
  const player: PlayerData = {
    id,
    name: cleanName(typedName, `Pizzaiolo ${room.players.length + 1}`),
    color: freeColor(room),
    ready: false,
    score: 0,
    served: 0,
    done: false,
    connected: true,
    token,
    connection,
  };
  room.players.push(player);
  room.lastActivity = now;
  return player;
};

// Someone left or lost their connection. In the lobby they are gone (the next one becomes host); during a match they
// stay on the scoreboard with what they had.
export const removePlayer = (room: RoomData, id: string, now: number): void => {
  room.lastActivity = now;
  room.players.forEach((player) => {
    if (player.id === id) delete player.awaySince;
  });
  if (room.status === "lobby") {
    room.players = room.players.filter((player) => player.id !== id);
    return;
  }
  const player = room.players.find((candidate) => candidate.id === id);
  if (player) {
    player.connected = false;
    // Leaving a Pizza Royale is going out of it.
    if (room.status === "playing" && room.mode === "royale") knockOut(room, player);
    if (room.status === "playing") player.done = true;
  }
  if (room.status === "playing") finishIfOver(room, now);
};

const knockOut = (room: RoomData, player: PlayerData): void => {
  if (player.out !== undefined) return;
  player.out = room.players.filter((other) => other.out !== undefined).length + 1;
  player.done = true;
};

// The match is over once everyone's clock has run out; a Pizza Royale, as soon as one player at most is still in.
const finishIfOver = (room: RoomData, now: number): void => {
  const isOver =
    room.players.every((player) => player.done) ||
    (room.mode === "royale" && room.players.filter((player) => player.out === undefined).length <= 1);
  if (isOver) finish(room, now);
};

// A connection dropped. Phones drop theirs whenever the player switches apps (to send the room code, to answer a
// message): that is not leaving. The player stays, marked away, until they come back or AWAY_GRACE_MS has passed.
export const markAway = (room: RoomData, id: string, connection: string, now: number): void => {
  const player = room.players.find((candidate) => candidate.id === id);
  if (!player || !player.connected || player.connection !== connection) return;
  player.awaySince = now;
  room.lastActivity = now;
};

// A player coming back on a new connection, with the secret their phone was given. False when they can't (wrong
// secret, or gone for good): they may then join as anyone else.
export const rejoinPlayer = (room: RoomData, id: string, token: string, connection: string, now: number): boolean => {
  const player = room.players.find((candidate) => candidate.id === id);
  if (!player || !player.connected || !token || player.token !== token) return false;
  delete player.awaySince;
  player.connection = connection;
  room.lastActivity = now;
  return true;
};

// Players away for too long have left.
export const dropAway = (room: RoomData, now: number): void => {
  room.players
    .filter((player) => player.awaySince !== undefined && now >= player.awaySince + AWAY_GRACE_MS)
    .forEach((player) => removePlayer(room, player.id, now));
};

// The host picks the match's length, before it starts. A duo pizzeria has no clock.
// Pizza Royale has its own: five minutes at most.
export const setLength = (room: RoomData, id: string, seconds: MatchSeconds, now: number): void => {
  if (room.status !== "lobby" || (room.mode !== "challenge" && room.mode !== "coop") || room.players[0]?.id !== id) return;
  room.seconds = seconds;
  room.lastActivity = now;
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
  if (room.players.some((player) => !player.ready || player.awaySince !== undefined)) return "notReady";
  room.status = "playing";
  room.seed = seed;
  room.startAt = now + COUNTDOWN_MS;
  room.lastActivity = now;
  room.players.forEach((player) => Object.assign(player, { score: 0, served: 0, done: false }));
  return null;
};

// A player's score, their clock's end ("done"), or their mistake in a Pizza Royale ("out"). A score that can't be true
// (more pizzas than customers came by now, more points than they were worth, less than before) is not taken: the
// player keeps the last one that could be. Nothing changes for a player already done, or once the match is over.
export const recordScore = (
  room: RoomData,
  id: string,
  score: number,
  served: number,
  kind: "score" | "done" | "out",
  now: number,
): void => {
  const player = room.players.find((candidate) => candidate.id === id);
  if (!player || room.status !== "playing" || player.done || room.startAt === undefined) return;
  const secondsIn = (now - room.startAt) / 1000;
  // Nothing can be scored before the start; "out" only exists in a Pizza Royale.
  if (secondsIn < 0 || (kind === "out" && room.mode !== "royale")) return;
  if (isPlausibleScore({ score, served }, player, secondsIn, room.mode)) {
    player.score = score;
    player.served = served;
  }
  if (kind === "out") knockOut(room, player);
  if (kind === "done") player.done = true;
  room.lastActivity = now;
  finishIfOver(room, now);
};

export const finish = (room: RoomData, now: number): void => {
  room.status = "finished";
  room.finishedAt = now;
  room.players.forEach((player) => (player.done = true));
};

// When the match should end at the latest, counting players whose game never said it was over. A duo pizzeria has no
// clock: it stays open while it is being played.
export const matchDeadline = (room: RoomData): number | null =>
  room.startAt === undefined || room.mode === "duo" ? null : room.startAt + (room.seconds ?? MATCH_SECONDS) * 1000 + END_GRACE_MS;

// What happens next on its own, and when: the match ends, the idle room closes, or the cooled-down code is freed.
// A player away too long is dropped first, if that comes sooner.
export const nextDeadline = (room: RoomData): { at: number; then: "finish" | "close" | "forget" | "drop" } => {
  if (room.status === "finished") return { at: (room.finishedAt ?? room.lastActivity) + COOLDOWN_MS, then: "forget" };
  const own = room.status === "playing"
    ? { at: matchDeadline(room) ?? room.lastActivity + IDLE_MS, then: "finish" as const }
    : { at: room.lastActivity + IDLE_MS, then: "close" as const };
  const away = room.players.filter((player) => player.connected && player.awaySince !== undefined).map((player) => (player.awaySince as number) + AWAY_GRACE_MS);
  const drop = Math.min(...away);
  return drop < own.at ? { at: drop, then: "drop" } : own;
};

export const viewOf = (room: RoomData, now: number): RoomView => ({
  code: room.code,
  mode: room.mode,
  status: room.status,
  seconds: room.seconds ?? MATCH_SECONDS,
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
      ...(player.out !== undefined ? { out: player.out } : {}),
      connected: player.connected,
      away: player.awaySince !== undefined,
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
