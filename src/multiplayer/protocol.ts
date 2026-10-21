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

// Three kinds of room: everyone plays the same customers on their own phone (a challenge); two players share one kitchen
// for a quick match, run on the host's phone (co-op); or two players run a whole pizzeria together, saved on the host's
// phone with a copy on the partner's (duo), for as long as the host keeps it open.
export type RoomMode = "challenge" | "coop" | "duo";
export const isSharedKitchen = (mode: RoomMode): boolean => mode === "coop" || mode === "duo";
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const maxPlayersIn = (mode: RoomMode): number => (isSharedKitchen(mode) ? 2 : MAX_PLAYERS);
// The match lasts as long as the daily challenge (game/challenge.ts checks it), after a short countdown.
export const MATCH_SECONDS = 120;
export const COUNTDOWN_MS = 3500;
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
  connected: boolean;
}

export interface RoomView {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  players: PlayerView[];
  /** Once started: the shared seed, so everyone gets the same customers. */
  seed?: string;
  /** Once started: milliseconds until the match begins (negative once it has). */
  startsInMs?: number;
}

export type RoomError = "notFound" | "full" | "started" | "over" | "notHost" | "notReady" | "tooFew" | "tooFast" | "unavailable";

export type ClientMessage =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "score"; score: number; served: number }
  | { type: "done"; score: number; served: number }
  | { type: "leave" }
  // Co-op only. The host sends the shared kitchen as it is (as JSON); the other player sends what they do in it.
  | { type: "state"; state: string }
  | { type: "action"; action: unknown };

export type ServerMessage =
  | { type: "room"; room: RoomView; you: string }
  | { type: "error"; reason: RoomError }
  | { type: "state"; state: string }
  | { type: "action"; from: string; action: unknown };

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
    case "start":
    case "leave":
      return { type: message.type };
    case "score":
    case "done":
      return { type: message.type, score: cleanCount(message.score), served: cleanCount(message.served) };
    default:
      return null;
  }
};

export const parseServerMessage = (raw: unknown): ServerMessage | null => {
  if (typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw) as ServerMessage;
    return data && ["room", "error", "state", "action"].includes(data.type) ? data : null;
  } catch {
    return null;
  }
};
