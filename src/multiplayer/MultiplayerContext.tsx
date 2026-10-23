// The game's side of multiplayer: a connection to a room on the server (server/), kept above the tabs so a match
// survives switching screens.
//   Challenge: every player plays the same customers in their own game; scores go to the room.
//   Co-op: the host's phone runs a shared kitchen (coop.ts), apart from both players' own pizzerias, and sends it to the
//   other player, whose moves come back to the host.
//   Duo: the same, with a whole pizzeria kept in the host's browser (duoSaves.ts); the partner keeps a copy of it.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Dispatch, GameAction, GameState } from "../game/types";
import {
  coopViewFor, createCoopGame, createDuoKitchen, decodeCoop, encodeCoop, isAllowedInDuo, isCoopMove, isPartnerDuoMove, isRoleMove, playCoopMove,
  tickCoop,
  type CoopGame,
} from "./coop";
import { saveDuo, type DuoInfo } from "./duoSaves";
import {
  AWAY_GRACE_MS, PING, PONG, isOwnKitchen, isSharedKitchen, normalizeRoomCode, parseServerMessage, type ClientMessage, type MatchSeconds, type RoomError, type RoomMode,
  type RolesChoice, type RoomView,
} from "./protocol";

// Where the server is: set at build time (VITE_MULTIPLAYER_URL), or the local one (`npm run server:dev`) in development.
// Empty when there is none: the tab then says multiplayer is coming.
export const MULTIPLAYER_URL: string = import.meta.env.VITE_MULTIPLAYER_URL || (import.meta.env.DEV ? "http://localhost:8787" : "");

const SCORE_EVERY_MS = 1000;
// The shared kitchen's clock on the host, which sends it to the other player at each step.
const COOP_TICK_MS = 250;
// A duo pizzeria is saved this often on the host while it is played (and when the host leaves or closes the page).
const DUO_SAVE_EVERY_MS = 3000;
// Messages in the shared kitchen go away after this long, as in the solo game (useGameLoop).
const TOAST_DURATION_MS = 4000;
const SEND_EVERY_MS = 250;
// A lost connection (a phone switching apps drops it) is tried again after these waits, then every last one, for as
// long as the server keeps the player's place.
const RECONNECT_WAITS_MS = [500, 1000, 2000, 4000, 8000];
// The connection is checked when the game comes back on screen, and every so often while it is on: no answer this
// quickly, and it is dead (a phone coming back from another app often holds one that never says it closed).
const PING_EVERY_MS = 20_000;
const PONG_WITHIN_MS = 4000;
// Closes from the server that mean "don't come back": refused, flooding, or this connection replaced by a newer one.
const FINAL_CLOSE_CODES: ReadonlySet<number> = new Set([4000, 4001, 4008]);

export type MultiplayerError = RoomError | "network" | "hostLeft";

export interface Multiplayer {
  isAvailable: boolean;
  room: RoomView | null;
  /** This player's id in the room. */
  you: string | null;
  isConnecting: boolean;
  /** The connection dropped and is being brought back; the room is kept meanwhile. */
  isReconnecting: boolean;
  error: MultiplayerError | null;
  /** When the match starts, on this device's clock (ms), once the host has started it. */
  startAt: number | null;
  /** Co-op and duo: the shared kitchen as this player sees it, while it is on; its moves go through coopDispatch. */
  coopView: GameState | null;
  coopDispatch: Dispatch;
  /** The duo pizzerias in play, if any. */
  duo: DuoInfo | null;
  /** When the partner last tried something only the host may do (ms), to say so. */
  refusedAt: number | null;
  /** duo: the pizzeria the host brings, when creating a duo room. */
  create: (name: string, mode: RoomMode, duo?: { info: DuoInfo; game: GameState }) => Promise<void>;
  join: (code: string, name: string) => void;
  start: () => void;
  /** The host picks how long the match lasts, in the lobby. */
  setLength: (seconds: MatchSeconds) => void;
  /** Shared kitchens: the host splits the work, in the lobby. */
  setRoles: (roles: RolesChoice) => void;
  /** Pizza Royale: sends a tricky customer to that player (the server checks it was earned). */
  sendTrap: (to: string) => void;
  /** Leaves the room, in the middle of a match too (the player's own game goes back to its morning). */
  leave: () => void;
  clearError: () => void;
}

const noop = () => undefined;

// Outside a provider (screens drawn on their own, as in tests): no room, nothing to do.
const NO_MULTIPLAYER: Multiplayer = {
  isAvailable: false,
  room: null,
  you: null,
  isConnecting: false,
  isReconnecting: false,
  error: null,
  startAt: null,
  coopView: null,
  coopDispatch: noop,
  duo: null,
  refusedAt: null,
  create: async () => undefined,
  join: noop,
  start: noop,
  setLength: noop,
  sendTrap: noop,
  setRoles: noop,
  leave: noop,
  clearError: noop,
};

const MultiplayerContext = createContext<Multiplayer>(NO_MULTIPLAYER);

export const useMultiplayer = (): Multiplayer => useContext(MultiplayerContext);

// This player's place in a room, to come back to it after losing the connection.
interface Seat {
  code: string;
  name: string;
  id: string;
  token: string;
}

const socketUrl = (code: string, name: string, seat?: Seat | null): string => {
  const query = new URLSearchParams({ name });
  if (seat) {
    query.set("player", seat.id);
    query.set("token", seat.token);
  }
  return `${MULTIPLAYER_URL.replace(/^http/, "ws")}/rooms/${code}/ws?${query.toString()}`;
};

interface ProviderProps {
  state: GameState;
  dispatch: Dispatch;
  /** The match has begun: show the service screen. */
  onMatchStart: () => void;
  children: ReactNode;
}

export const MultiplayerProvider = ({ state, dispatch, onMatchStart, children }: ProviderProps) => {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [isConnecting, setConnecting] = useState(false);
  const [isReconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<MultiplayerError | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [coop, setCoop] = useState<CoopGame | null>(null);
  const [refusedAt, setRefusedAt] = useState<number | null>(null);
  // The duo pizzeria the host brought, until the room opens it.
  const hostDuo = useRef<{ info: DuoInfo; game: GameState } | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const seat = useRef<Seat | null>(null);
  // Since when the connection is lost (ms), while it is being brought back.
  const lostAt = useRef<number | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeard = useRef(0);
  // The seed of the match already started on this device, and whether its final score went out.
  const startedSeed = useRef<string | null>(null);
  const sentDone = useRef(false);
  // The co-op kitchen on the host, always current (the timer and incoming moves change it between renders).
  const hostKitchen = useRef<CoopGame | null>(null);
  const youRef = useRef<string | null>(null);
  const [pendingTraps, setPendingTraps] = useState<string[]>([]);
  const roomRef = useRef<RoomView | null>(null);
  const coopRef = useRef<CoopGame | null>(null);
  roomRef.current = room;
  youRef.current = you;
  coopRef.current = coop;
  // Sending the kitchen: at most every SEND_EVERY_MS, the latest one always going out.
  const lastSentAt = useRef(0);
  const pendingSend = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHost = Boolean(room && you && room.players[0]?.id === you);

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  // The host changes the kitchen, shows it, and sends it to the other player (not more often than SEND_EVERY_MS:
  // a whole duo pizzeria weighs more than a quick kitchen).
  const sendKitchen = useCallback(() => {
    pendingSend.current = null;
    lastSentAt.current = Date.now();
    if (hostKitchen.current) send({ type: "state", state: encodeCoop(hostKitchen.current) });
  }, [send]);
  const setHostKitchen = useCallback(
    (next: CoopGame | null) => {
      hostKitchen.current = next;
      setCoop(next);
      if (!next || pendingSend.current) return;
      const wait = SEND_EVERY_MS - (Date.now() - lastSentAt.current);
      if (wait <= 0) sendKitchen();
      else pendingSend.current = setTimeout(sendKitchen, wait);
    },
    [sendKitchen],
  );

  // Keeps the duo pizzeria on this device: the host's own, or the partner's copy.
  const keepDuo = useCallback((kitchen: CoopGame | null) => {
    if (kitchen?.duo) saveDuo(kitchen.duo, kitchen.game);
  }, []);

  const reset = useCallback(() => {
    socket.current = null;
    seat.current = null;
    lostAt.current = null;
    if (retry.current) clearTimeout(retry.current);
    retry.current = null;
    setReconnecting(false);
    hostKitchen.current = null;
    hostDuo.current = null;
    setRoom(null);
    setYou(null);
    setStartAt(null);
    setPendingTraps([]);
    setConnecting(false);
    setCoop(null);
    startedSeed.current = null;
    sentDone.current = false;
  }, []);

  // What this phone has to say again after coming back: the kitchen (host), its final score, whether it is free to play.
  const latestResult = useRef<GameState["challengeResult"]>(null);
  const isReadyRef = useRef(false);
  const resumeAfterRejoin = useCallback(
    (ws: WebSocket, view: RoomView) => {
      const say = (message: ClientMessage) => ws.send(JSON.stringify(message));
      if (view.status === "lobby") say({ type: "ready", ready: isReadyRef.current });
      if (hostKitchen.current) say({ type: "state", state: encodeCoop(hostKitchen.current) });
      const result = latestResult.current;
      if (result?.multiplayer && sentDone.current) say({ type: result.out ? "out" : "done", score: result.score, served: result.served });
    },
    [],
  );

  const connect = useCallback(
    (code: string, name: string) => {
      const returning = seat.current;
      const ws = new WebSocket(socketUrl(code, name, returning));
      socket.current = ws;
      lastHeard.current = Date.now();

      // The connection is gone: try again while the server keeps this player's place, else say it is lost.
      const lose = (isFinal: boolean) => {
        if (socket.current !== ws) return;
        socket.current = null;
        setConnecting(false);
        const current = roomRef.current;
        const since = lostAt.current ?? Date.now();
        if (!isFinal && seat.current && current && current.status !== "finished" && Date.now() - since < AWAY_GRACE_MS) {
          lostAt.current = since;
          setReconnecting(true);
          const attempt = Math.round((Date.now() - since) / 1000);
          const wait = RECONNECT_WAITS_MS[Math.min(RECONNECT_WAITS_MS.length - 1, Math.floor(Math.log2(attempt + 1)))];
          retry.current = setTimeout(() => {
            retry.current = null;
            if (!socket.current && seat.current) connect(seat.current.code, seat.current.name);
          }, wait);
          return;
        }
        lostAt.current = null;
        setReconnecting(false);
        // A finished match stays on screen; anything else lost means the room is gone.
        setRoom((room) => {
          if (room?.status !== "finished") setError((existing) => existing ?? "network");
          return room?.status === "finished" ? room : null;
        });
      };
      ws.onclose = (event) => lose(FINAL_CLOSE_CODES.has(event.code));
      ws.onmessage = (event) => {
        if (socket.current !== ws) return;
        lastHeard.current = Date.now();
        if (event.data === PONG) return;
        const message = parseServerMessage(event.data);
        if (!message) return;
        switch (message.type) {
          case "error":
            setError(message.reason);
            return;
          case "state": {
            // The other player's phone: the kitchen as the host has it now.
            const kitchen = decodeCoop(message.state);
            if (kitchen) setCoop(kitchen);
            return;
          }
          case "action": {
            // The host's phone: a move from the other player, played in the shared kitchen if it is theirs to make.
            const kitchen = hostKitchen.current;
            const isAllowed = kitchen?.duo ? isPartnerDuoMove(message.action) : isCoopMove(message.action);
            if (kitchen && isAllowed) setHostKitchen(playCoopMove(kitchen, message.from, message.action as GameAction));
            return;
          }
          case "trap": {
            // Pizza Royale: a tricky customer from another player, into this player's own game (held a moment if
            // this phone hasn't started the match yet: clocks are never exactly in step).
            const sender = roomRef.current?.players.find((player) => player.id === message.from);
            if (sender) setPendingTraps((traps) => [...traps, sender.name]);
            return;
          }
          case "room": {
            const isBack = lostAt.current !== null && message.you === returning?.id;
            setConnecting(false);
            setReconnecting(false);
            lostAt.current = null;
            setRoom(message.room);
            setYou(message.you);
            seat.current = { code: message.room.code, name, id: message.you, token: message.token };
            if (isBack) resumeAfterRejoin(ws, message.room);
            // The server says how long until the start; this device's own clock times it.
            const { startsInMs } = message.room;
            if (startsInMs !== undefined) setStartAt((current) => current ?? Date.now() + startsInMs);
            // Co-op: without its host, the shared kitchen is gone (a host only away keeps it: they are coming back).
            const host = message.room.players[0];
            if (isSharedKitchen(message.room.mode) && message.room.status === "playing" && host && host.id !== message.you && !host.connected) {
              // The partner keeps their copy of a duo pizzeria as it was last seen, and leaves the room: nothing more
              // happens in it, and they may want to host the pizzeria themselves.
              const last = coopRef.current;
              if (last?.duo) saveDuo(last.duo, last.game);
              reset();
              ws.close();
              setError("hostLeft");
            }
            return;
          }
        }
      };
    },
    [reset, setHostKitchen, resumeAfterRejoin],
  );

  const join = useCallback(
    (typedCode: string, name: string) => {
      const code = normalizeRoomCode(typedCode);
      if (!code) return setError("notFound");
      socket.current?.close();
      reset();
      setError(null);
      setConnecting(true);
      connect(code, name);
    },
    [reset, connect],
  );

  // Back on screen (or every so often): a connection that doesn't answer is dead, and one that is lost is tried again
  // right away rather than at the next retry.
  const checkConnection = useCallback(() => {
    if (!seat.current) return;
    const ws = socket.current;
    if (!ws) {
      if (retry.current) clearTimeout(retry.current);
      retry.current = null;
      connect(seat.current.code, seat.current.name);
      return;
    }
    if (ws.readyState === WebSocket.CONNECTING) return;
    // Dead without saying so (no answer, or stuck closing): dropped here, and brought back.
    const dropAndReconnect = () => {
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
      socket.current = null;
      lostAt.current = lostAt.current ?? Date.now();
      setReconnecting(true);
      if (seat.current) connect(seat.current.code, seat.current.name);
    };
    if (ws.readyState !== WebSocket.OPEN) return dropAndReconnect();
    const askedAt = Date.now();
    ws.send(PING);
    setTimeout(() => {
      if (socket.current === ws && lastHeard.current < askedAt) dropAndReconnect();
    }, PONG_WITHIN_MS);
  }, [connect]);
  const isInRoom = room !== null || isReconnecting;
  useEffect(() => {
    if (!isInRoom) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") checkConnection();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", checkConnection);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") checkConnection();
    }, PING_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", checkConnection);
      clearInterval(timer);
    };
  }, [isInRoom, checkConnection]);

  const create = useCallback(
    async (name: string, mode: RoomMode, duo?: { info: DuoInfo; game: GameState }) => {
      setError(null);
      setConnecting(true);
      try {
        const response = await fetch(`${MULTIPLAYER_URL}/rooms`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const body = (await response.json()) as { code?: string };
        if (!response.ok || !body.code) throw new Error("no room");
        join(body.code, name);
        // After join, which starts afresh: the pizzeria waits for the host to open it.
        if (mode === "duo" && duo) hostDuo.current = duo;
      } catch {
        setConnecting(false);
        setError("unavailable");
      }
    },
    [join],
  );

  const leave = useCallback(() => {
    // A duo pizzeria is kept as it is, on either phone.
    keepDuo(hostKitchen.current ?? coopRef.current);
    // A challenge is played in the player's own game: it stops there, nothing recorded.
    if (roomRef.current && isOwnKitchen(roomRef.current.mode)) dispatch({ type: "leaveMatch" });
    send({ type: "leave" });
    const ws = socket.current;
    reset();
    ws?.close();
  }, [send, reset, keepDuo, dispatch]);

  const start = useCallback(() => send({ type: "start" }), [send]);
  const setLength = useCallback((seconds: MatchSeconds) => send({ type: "length", seconds }), [send]);
  const sendTrap = useCallback((to: string) => send({ type: "trap", to }), [send]);
  const setRoles = useCallback((roles: RolesChoice) => send({ type: "roles", roles }), [send]);
  const clearError = useCallback(() => setError(null), []);

  // Co-op moves: played right here on the host, sent to the host from the other phone.
  const coopDispatch = useCallback<Dispatch>(
    (action: GameAction) => {
      const me = youRef.current;
      const kitchen = hostKitchen.current;
      if (kitchen && me) {
        if (kitchen.duo && !isAllowedInDuo(action)) return;
        const next = playCoopMove(kitchen, me, action);
        // A quick co-op is done with once its result is dismissed; a duo pizzeria goes on.
        setHostKitchen(next.duo || next.game.service || next.game.challengeResult ? next : null);
      } else if (action.type === "dismissChallengeResult" && !coopRef.current?.duo) {
        setCoop(null);
      } else if (me && !isRoleMove(coopRef.current?.roles, me, action)) {
        // The other player's side of the kitchen: their controls are greyed out, keys do nothing either.
        return;
      } else if (coopRef.current?.duo ? isPartnerDuoMove(action) : isCoopMove(action)) {
        send({ type: "action", action });
      } else if (coopRef.current?.duo) {
        // Only the host decides this in a duo pizzeria: said on screen rather than silently ignored.
        setRefusedAt(Date.now());
      }
    },
    [send, setHostKitchen],
  );

  // Free to play only in the morning prep, not in the middle of a day (the day would go on without them).
  const isReady = state.phase === "prep" && !state.challengeResult;
  isReadyRef.current = isReady;
  useEffect(() => {
    if (room?.status === "lobby") send({ type: "ready", ready: isReady });
  }, [room?.status, isReady, send]);

  // The match starts on every phone at the same moment. Challenge: each in their own game, with the same customers.
  // Co-op: the host sets up the shared kitchen; the other phone waits for it.
  const seed = room?.status === "playing" ? room.seed : undefined;
  const mode = room?.mode;
  useEffect(() => {
    if (!seed || startAt === null || startedSeed.current === seed) return;
    const timer = setTimeout(() => {
      startedSeed.current = seed;
      sentDone.current = false;
      const current = roomRef.current;
      const isHostHere = Boolean(current && youRef.current === current.players[0]?.id);
      if (mode === "duo") {
        const duo = hostDuo.current;
        if (isHostHere && current && duo) {
          const members = current.players.map((player) => player.name);
          setHostKitchen(createDuoKitchen(duo.game, current.players.map((player) => player.id), { ...duo.info, members }, current.roles));
        }
      } else if (mode === "coop") {
        if (isHostHere && current) {
          setHostKitchen(createCoopGame(seed, current.players.map((player) => player.id), state.settings.language, current.seconds, current.roles));
        }
      } else {
        dispatch({ type: "startChallenge", date: seed, multiplayer: true, seconds: current?.seconds, royale: mode === "royale" });
      }
      onMatchStart();
    }, Math.max(0, startAt - Date.now()));
    return () => clearTimeout(timer);
  }, [seed, mode, startAt, dispatch, onMatchStart, setHostKitchen, state.settings.language]);

  // The host's clock for the shared kitchen: only during service, when time matters.
  const isRunningKitchen = isHost && Boolean(coop?.game.service) && coop?.game.phase === "service";
  useEffect(() => {
    if (!isRunningKitchen) return;
    const timer = setInterval(() => {
      const kitchen = hostKitchen.current;
      if (kitchen?.game.service) setHostKitchen(tickCoop(kitchen, COOP_TICK_MS / 1000));
    }, COOP_TICK_MS);
    return () => clearInterval(timer);
  }, [isRunningKitchen, setHostKitchen]);

  // A duo pizzeria is saved as it goes: every few seconds on the host, at each new day or receipt on the partner's phone.
  const isDuo = Boolean(coop?.duo);
  useEffect(() => {
    if (!isDuo || !isHost) return;
    const timer = setInterval(() => keepDuo(hostKitchen.current), DUO_SAVE_EVERY_MS);
    return () => clearInterval(timer);
  }, [isDuo, isHost, keepDuo]);
  useEffect(() => {
    if (!isDuo || !isHost) return;
    const save = () => keepDuo(hostKitchen.current);
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [isDuo, isHost, keepDuo]);

  // The host expires the shared kitchen's messages, for both players.
  const newestToast = coop?.game.toasts.at(-1)?.id;
  useEffect(() => {
    if (!isHost || !newestToast) return;
    const timer = setTimeout(() => {
      const kitchen = hostKitchen.current;
      if (kitchen) setHostKitchen({ ...kitchen, game: { ...kitchen.game, toasts: kitchen.game.toasts.filter((toast) => toast.id !== newestToast) } });
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isHost, newestToast, setHostKitchen]);

  const duoDay = coop?.duo ? coop.game.day : null;
  const duoPhase = coop?.duo ? coop.game.phase : null;
  useEffect(() => {
    if (duoDay !== null && !isHost) keepDuo(coopRef.current);
  }, [duoDay, duoPhase, isHost, keepDuo]);

  // The match being played, solo game or shared kitchen, for the score.
  const matchState = mode === "coop" ? (coop?.game ?? null) : state;
  const latestMatch = useRef(matchState);
  latestMatch.current = matchState;
  const isPlaying = Boolean(matchState?.service?.challenge?.multiplayer);
  useEffect(() => {
    if (!isPlaying) return;
    let lastSent = -1;
    const timer = setInterval(() => {
      const service = latestMatch.current?.service;
      if (!service?.challenge || service.challenge.score === lastSent) return;
      lastSent = service.challenge.score;
      send({ type: "score", score: service.challenge.score, served: service.stats.served });
    }, SCORE_EVERY_MS);
    return () => clearInterval(timer);
  }, [isPlaying, send]);

  // The final score, once, when the clock runs out.
  const result = matchState?.challengeResult;
  latestResult.current = result ?? null;
  useEffect(() => {
    if (!result?.multiplayer || sentDone.current || !startedSeed.current) return;
    sentDone.current = true;
    // In a Pizza Royale, a mistake ended it: the player is out.
    send({ type: result.out ? "out" : "done", score: result.score, served: result.served });
  }, [result, send]);

  // Traps received, played into the match as soon as this phone is in it.
  const isInRoyale = Boolean(state.service?.challenge?.royale);
  useEffect(() => {
    if (!isInRoyale || !pendingTraps.length) return;
    pendingTraps.forEach((from) => dispatch({ type: "receiveTrap", from }));
    setPendingTraps([]);
  }, [isInRoyale, pendingTraps, dispatch]);

  // A Pizza Royale ends for everyone once one player is left: their game stops there, on the podium.
  const isMatchOver = room?.status === "finished";
  const isStillPlaying = Boolean(state.service?.challenge?.multiplayer);
  useEffect(() => {
    if (isMatchOver && isStillPlaying && mode === "royale") dispatch({ type: "endMatch" });
  }, [isMatchOver, isStillPlaying, mode, dispatch]);

  // The other player came back after losing their connection: the host sends them the kitchen as it is now (it may not
  // change for a while in a duo's morning).
  const partnerAway = room?.players.find((player) => player.id !== you)?.away;
  useEffect(() => {
    if (isHost && partnerAway === false && hostKitchen.current) sendKitchen();
  }, [isHost, partnerAway, sendKitchen]);

  // Closing the page leaves the room cleanly.
  useEffect(
    () => () => {
      const ws = socket.current;
      socket.current = null;
      if (retry.current) clearTimeout(retry.current);
      ws?.close();
    },
    [],
  );

  const coopView = useMemo(() => {
    if (!coop || !you || !room) return null;
    const partner = room.players.find((player) => player.id !== you);
    return coopViewFor(coop, you, partner && { id: partner.id, color: partner.color, name: partner.name });
  }, [coop, you, room]);

  const value = useMemo<Multiplayer>(
    () => ({
      isAvailable: MULTIPLAYER_URL !== "",
      room,
      you,
      isConnecting,
      isReconnecting,
      error,
      startAt,
      coopView,
      coopDispatch,
      duo: coop?.duo ?? null,
      refusedAt,
      create,
      join,
      start,
      setLength,
      sendTrap,
      setRoles,
      leave,
      clearError,
    }),
    [room, you, isConnecting, isReconnecting, error, startAt, coopView, coopDispatch, coop?.duo, refusedAt, create, join, start, setLength, sendTrap, setRoles, leave, clearError],
  );
  return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>;
};
