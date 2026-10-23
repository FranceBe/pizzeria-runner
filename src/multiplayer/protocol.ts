// What the game and the multiplayer server (server/) say to each other, and the rules both sides apply.
// No accounts, no personal data: a room code, a nickname, and scores.

// Room codes: four letters, none that can be mistaken for another (no I, L, O).
export const ROOM_CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 4;
// Codes that read as something rude are never handed out.
const BLOCKED_CODES: ReadonlySet<string> = new Set([
  "CACA", "PIPI", "PUTE", "CONN", "FUCK", "SHIT", "CUNT", "DICK", "COCK", "PISS", "TWAT", "SUCE", "NAZI", "PUTA", "MERD",
  "ANUS", "SEXE", "SEXY", "PENE", "TETA", "CRAP", "DUMB", "SUCK", "FUCC", "HATE", "KKKK",
]);

// Four kinds of room: everyone plays the same customers on their own phone (a challenge), or the same in sudden death,
// the last one standing winning (Pizza Royale); two players share one kitchen for a quick match, run on the host's
// phone (co-op); or two players run a whole pizzeria together, saved on the host's phone with a copy on the partner's
// (duo), for as long as the host keeps it open.
export type RoomMode = "challenge" | "royale" | "coop" | "duo";
export const ROOM_MODES: readonly RoomMode[] = ["challenge", "royale", "coop", "duo"];
export const isRoomMode = (value: unknown): value is RoomMode => ROOM_MODES.includes(value as RoomMode);
// The mode asked for when creating a room (its request body, as sent), a challenge by default.
export const roomModeOf = (body: unknown): RoomMode => {
  const mode = typeof body === "object" && body !== null ? (body as Record<string, unknown>).mode : undefined;
  return isRoomMode(mode) ? mode : "challenge";
};
export const isSharedKitchen = (mode: RoomMode): boolean => mode === "coop" || mode === "duo";
/** Each player in their own game, with the same customers. */
export const isOwnKitchen = (mode: RoomMode): boolean => mode === "challenge" || mode === "royale";
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const maxPlayersIn = (mode: RoomMode): number => (isSharedKitchen(mode) ? 2 : MAX_PLAYERS);
// How long a challenge or a quick co-op lasts, picked by the host: a sprint, the daily challenge's two minutes (the
// default, game/challenge.ts checks it), or a long one. After a short countdown.
export const MATCH_LENGTHS = [60, 120, 300] as const;
export type MatchSeconds = (typeof MATCH_LENGTHS)[number];
export const MATCH_SECONDS: MatchSeconds = 120;
export const isMatchLength = (value: unknown): value is MatchSeconds => MATCH_LENGTHS.includes(value as MatchSeconds);
// Pizza Royale: at most five minutes, customers coming faster and faster; whoever is still in at the end wins on points.
export const ROYALE_SECONDS: MatchSeconds = 300;

// What the server accepts as a score, so a tampered phone can't claim the impossible. Customers come one at a time,
// at least this often apart (game/challenge.ts; faster and faster in Pizza Royale), and a pizza is worth at most
// MAX_POINTS_PER_PIZZA (game/serving.ts). Both are checked against the game by its tests.
export const MIN_ARRIVAL_SECONDS = 2;
export const ROYALE_MIN_ARRIVAL_SECONDS = 0.8;
export const MAX_POINTS_PER_PIZZA = 40;
// Phones' clocks and the network are not exact: a little leeway, never enough to matter.
const SCORE_LEEWAY_SECONDS = 3;
export const maxServedAfter = (seconds: number, mode: RoomMode): number =>
  1 + Math.floor((Math.max(0, seconds) + SCORE_LEEWAY_SECONDS) / (mode === "royale" ? ROYALE_MIN_ARRIVAL_SECONDS : MIN_ARRIVAL_SECONDS));
// A score that could be true this far into the match: no more pizzas than customers came, no more points than they
// were worth, and never less than already reported.
export const isPlausibleScore = (
  report: { score: number; served: number },
  before: { score: number; served: number },
  secondsIn: number,
  mode: RoomMode,
): boolean =>
  report.score >= before.score &&
  report.served >= before.served &&
  report.served <= maxServedAfter(secondsIn, mode) &&
  report.score <= report.served * MAX_POINTS_PER_PIZZA;
// Shared kitchens (co-op, duo): the host may split the work, one at the board and the oven, the other at the pass and
// the bar, picking their own side; or leave everyone free to do everything.
export const ROLES_CHOICES = ["free", "hostCooks", "hostServes"] as const;
export type RolesChoice = (typeof ROLES_CHOICES)[number];
export const isRolesChoice = (value: unknown): value is RolesChoice => ROLES_CHOICES.includes(value as RolesChoice);

// Pizza Royale traps: a tricky customer sent to another player. One is earned every TRAP_EVERY_SERVED pizzas served
// (as the server counts them), MAX_TRAPS at most a match; a player receives one at most every TRAP_COOLDOWN_MS.
export const TRAP_EVERY_SERVED = 4;
export const MAX_TRAPS = 3;
export const TRAP_COOLDOWN_MS = 8000;
export const trapsEarned = (served: number): number => Math.min(MAX_TRAPS, Math.floor(Math.max(0, served) / TRAP_EVERY_SERVED));
export const COUNTDOWN_MS = 3500;
// A player whose connection drops (a phone switching apps) keeps their place this long, so they can come back.
export const AWAY_GRACE_MS = 3 * 60_000;
// Asked by a phone to check its connection still works; answered by the server without waking the room.
export const PING = "ping";
export const PONG = "pong";
// Nicknames: short, plain text.
export const NAME_MAX_LENGTH = 16;

export type RoomStatus = "lobby" | "playing" | "finished";

export interface PlayerView {
  id: string;
  name: string;
  /** Colour index, as for tables (tb-0 to tb-3). */
  color: number;
  isHost: boolean;
  /** In the morning prep, free to start a match. */
  ready: boolean;
  score: number;
  served: number;
  /** Their clock ran out (or they left mid-match). */
  done: boolean;
  /** Pizza Royale: out of the match, and in which order (1 for the first one out). */
  out?: number;
  /** Pizza Royale: traps sent so far. */
  traps?: number;
  /** Still in the room (false once they left for good). */
  connected: boolean;
  /** Lost their connection a moment ago (switched apps): their place is kept while they come back. */
  away: boolean;
}

export interface RoomView {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  players: PlayerView[];
  /** How long the match lasts (challenge and co-op). */
  seconds: MatchSeconds;
  /** Shared kitchens: how the work is split. */
  roles: RolesChoice;
  /** Once started: the shared seed, so everyone gets the same customers. */
  seed?: string;
  /** Once started: milliseconds until the match begins (negative once it has). */
  startsInMs?: number;
}

export type RoomError = "notFound" | "full" | "started" | "over" | "notHost" | "notReady" | "tooFew" | "tooFast" | "unavailable";

export type ClientMessage =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  // The host picks how long the match lasts, in the lobby.
  | { type: "length"; seconds: MatchSeconds }
  // The host splits the work of a shared kitchen, in the lobby.
  | { type: "roles"; roles: RolesChoice }
  | { type: "score"; score: number; served: number }
  | { type: "done"; score: number; served: number }
  // Pizza Royale: this player made a mistake, and is out.
  | { type: "out"; score: number; served: number }
  // Pizza Royale: a tricky customer for that player.
  | { type: "trap"; to: string }
  | { type: "leave" }
  // Co-op only. The host sends the shared kitchen as it is (as JSON); the other player sends what they do in it.
  | { type: "state"; state: string }
  | { type: "action"; action: unknown };

export type ServerMessage =
  // `token`: this player's secret for coming back after losing the connection, sent to them only.
  | { type: "room"; room: RoomView; you: string; token: string }
  | { type: "error"; reason: RoomError }
  | { type: "state"; state: string }
  | { type: "action"; from: string; action: unknown }
  // Pizza Royale: a tricky customer, sent by that player.
  | { type: "trap"; from: string };

// How big a message may be: the shared kitchen is the big one.
const MAX_MESSAGE_LENGTH = 500;
const MAX_STATE_LENGTH = 200_000;
const MAX_ACTION_LENGTH = 2_000;

export const randomRoomCode = (random: () => number = Math.random): string => {
  for (;;) {
    const code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_LETTERS[Math.floor(random() * ROOM_CODE_LETTERS.length)]).join("");
    if (!BLOCKED_CODES.has(code)) return code;
  }
};

// What a player typed, as a code: upper case, letters only. Null when it can't be one.
export const normalizeRoomCode = (typed: string): string | null => {
  const code = typed.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return code.length === ROOM_CODE_LENGTH && [...code].every((letter) => ROOM_CODE_LETTERS.includes(letter)) ? code : null;
};

// A nickname as shown to the others: no control characters or markup, spaces tidied, cut to length.
export const cleanName = (typed: string, fallback: string): string => {
  // Control characters (code below 32, or 127) and angle brackets are dropped.
  const isShown = (char: string) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127 && char !== "<" && char !== ">";
  const name = [...typed]
    .filter(isShown)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return name || fallback;
};

// Scores sent by a player, kept to sensible whole numbers.
export const cleanCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(100_000, Math.max(0, Math.round(value))) : 0;

// Reads a message from the other side; null for anything that isn't one.
export const parseClientMessage = (raw: unknown): ClientMessage | null => {
  if (typeof raw !== "string" || raw.length > MAX_STATE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;
  if (message.type === "state") return typeof message.state === "string" ? { type: "state", state: message.state } : null;
  if (raw.length > (message.type === "action" ? MAX_ACTION_LENGTH : MAX_MESSAGE_LENGTH)) return null;
  switch (message.type) {
    case "action":
      return typeof message.action === "object" && message.action !== null ? { type: "action", action: message.action } : null;
    case "ready":
      return { type: "ready", ready: message.ready === true };
    case "length":
      return isMatchLength(message.seconds) ? { type: "length", seconds: message.seconds } : null;
    case "roles":
      return isRolesChoice(message.roles) ? { type: "roles", roles: message.roles } : null;
    case "start":
    case "leave":
      return { type: message.type };
    case "score":
    case "done":
    case "out":
      return { type: message.type, score: cleanCount(message.score), served: cleanCount(message.served) };
    case "trap":
      return typeof message.to === "string" && message.to.length > 0 && message.to.length <= 64 ? { type: "trap", to: message.to } : null;
    default:
      return null;
  }
};

export const parseServerMessage = (raw: unknown): ServerMessage | null => {
  if (typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw) as ServerMessage;
    return data && ["room", "error", "state", "action", "trap"].includes(data.type) ? data : null;
  } catch {
    return null;
  }
};
