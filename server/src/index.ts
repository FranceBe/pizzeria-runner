// The multiplayer server: a Cloudflare Worker, and one Durable Object per room code.
//   POST /rooms               creates a room and returns its code
//   GET  /rooms/ABCD/ws       joins room ABCD (WebSocket); with ?player=&token=, comes back to it after a dropped connection
// A room code is the name of its Durable Object: Cloudflare runs exactly one object per name, which handles one request
// at a time, so two rooms can never share a code, even when created at the same instant.
import { DurableObject } from "cloudflare:workers";
import {
  PING, PONG, ROOM_MODES, normalizeRoomCode, parseClientMessage, randomRoomCode, type RoomError, type RoomMode, type ServerMessage,
} from "../../src/multiplayer/protocol";
import {
  addPlayer, allowMessage, canSendKitchen, canSendMove, createRoom, dropAway, finish, joinError, markAway, nextDeadline, noteActivity,
  recordScore, rejoinPlayer, removePlayer, setLength, setReady, startMatch, viewOf, type RoomData,
} from "./roomLogic";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Comma-separated origins the game is served from; "*" allows any (local tests on a phone). */
  ALLOWED_ORIGINS: string;
  /** Rooms created and connections opened per address (wrangler.toml). Optional: the server runs without it. */
  JOIN_LIMIT?: RateLimit;
}

// The body of a room's creation is a few bytes ({"mode":"coop"}): anything much bigger isn't the game.
const MAX_BODY_BYTES = 200;

// Too many rooms or connections from one address this minute (a script, not a player).
const isOverLimit = async (request: Request, env: Env): Promise<boolean> => {
  if (!env.JOIN_LIMIT) return false;
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.JOIN_LIMIT.limit({ key: address });
  return !success;
};

// What the server remembers on each connection, across the room's sleeps: whose it is, and which of theirs.
interface Attachment {
  id: string;
  connection: string;
}

// Random codes are almost never taken (hundreds of thousands of codes, a handful of rooms): a few tries are plenty.
const CREATE_ATTEMPTS = 20;

const isAllowedOrigin = (origin: string | null, env: Env): origin is string => {
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGINS.split(",").map((entry) => entry.trim());
  return allowed.includes("*") || allowed.includes(origin);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    // Only the game itself may use the server: nobody else's page spends its quota.
    if (!isAllowedOrigin(origin, env)) return new Response("Forbidden", { status: 403 });
    const cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" },
      });
    }

    const isCreating = request.method === "POST" && url.pathname === "/rooms";
    const joining = url.pathname.match(/^\/rooms\/([A-Za-z]+)\/ws$/);
    if ((isCreating || joining) && (await isOverLimit(request, env))) {
      return new Response("Too many requests", { status: 429, headers: { ...cors, "Retry-After": "60" } });
    }

    if (isCreating) {
      if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) return new Response("Too large", { status: 413, headers: cors });
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return new Response("Too large", { status: 413, headers: cors });
      const body = (() => {
        try {
          return JSON.parse(raw) as { mode?: unknown };
        } catch {
          return {};
        }
      })();
      const mode: RoomMode = ROOM_MODES.includes(body.mode as RoomMode) ? (body.mode as RoomMode) : "challenge";
      for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
        const code = randomRoomCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await room.create(code, mode)) return Response.json({ code }, { status: 201, headers: cors });
      }
      return Response.json({ error: "unavailable" satisfies RoomError }, { status: 503, headers: cors });
    }

    if (joining && request.headers.get("Upgrade") === "websocket") {
      const code = normalizeRoomCode(joining[1]);
      if (!code) return new Response("Not found", { status: 404, headers: cors });
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};

export class Room extends DurableObject<Env> {
  private room: RoomData | undefined;
  private isLoaded = false;
  // Per player: messages this second. Lost when the object sleeps, which is fine for a flood guard.
  private counters = new Map<string, { windowStart: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Phones check their connection now and then: answered right here, without waking the room or counting as use.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private async load(): Promise<RoomData | undefined> {
    if (!this.isLoaded) {
      this.room = await this.ctx.storage.get<RoomData>("room");
      this.isLoaded = true;
    }
    return this.room;
  }

  private async save(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(nextDeadline(this.room).at);
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // Already closing: nothing to tell it.
    }
  }

  private broadcast(): void {
    if (!this.room) return;
    const now = Date.now();
    const view = viewOf(this.room, now);
    for (const socket of this.ctx.getWebSockets()) {
      const { id } = socket.deserializeAttachment() as Attachment;
      const token = this.room.players.find((player) => player.id === id)?.token ?? "";
      this.send(socket, { type: "room", room: view, you: id, token });
    }
  }

  // Called by the Worker with a fresh random code: true if this object now holds a new room under it, false if the
  // code is in use (a room open, playing, or just finished and cooling down).
  async create(code: string, mode: RoomMode): Promise<boolean> {
    if (await this.load()) return false;
    this.room = createRoom(code, Date.now(), mode);
    await this.save();
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    const room = await this.load();
    const [client, server] = Object.values(new WebSocketPair());
    const params = new URL(request.url).searchParams;
    const connection = crypto.randomUUID();
    const now = Date.now();
    // Coming back after a dropped connection: the same player, in a match already started too. Their old connection,
    // if the server still has it open, is closed (quietly: it is no longer theirs, so it doesn't mark them away).
    const returning = params.get("player") ?? "";
    if (room && returning && rejoinPlayer(room, returning, params.get("token") ?? "", connection, now)) {
      this.ctx.getWebSockets()
        .filter((socket) => (socket.deserializeAttachment() as Attachment).id === returning)
        .forEach((socket) => socket.close(4001, "replaced"));
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ id: returning, connection } satisfies Attachment);
      await this.save();
      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    }
    const error = joinError(room);
    if (error || !room) {
      // Accepted only to say why not, then closed: a mistyped code never creates an empty room.
      server.accept();
      this.send(server, { type: "error", reason: error ?? "notFound" });
      server.close(4000, error ?? "notFound");
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = crypto.randomUUID();
    addPlayer(room, id, params.get("name") ?? "", now, crypto.randomUUID(), connection);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, connection } satisfies Attachment);
    await this.save();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = await this.load();
    const { id } = socket.deserializeAttachment() as Attachment;
    if (!room) return socket.close(4000, "notFound");
    const now = Date.now();
    const counter = this.counters.get(id) ?? { windowStart: now, count: 0 };
    this.counters.set(id, counter);
    if (!allowMessage(counter, now)) {
      this.send(socket, { type: "error", reason: "tooFast" });
      return socket.close(4008, "tooFast");
    }
    const message = parseClientMessage(raw);
    if (!message) return;
    // Co-op relays pass straight through: nothing to save, nobody else to tell.
    if (message.type === "state" || message.type === "action") {
      this.relay(room, id, message);
      if (noteActivity(room, now)) await this.save();
      return;
    }
    switch (message.type) {
      case "ready":
        setReady(room, id, message.ready, now);
        break;
      case "length":
        setLength(room, id, message.seconds, now);
        break;
      case "start": {
        const error = startMatch(room, id, crypto.randomUUID(), now);
        if (error) this.send(socket, { type: "error", reason: error });
        break;
      }
      case "score":
      case "done":
      case "out":
        recordScore(room, id, message.score, message.served, message.type, now);
        break;
      case "leave":
        removePlayer(room, id, now);
        socket.close(1000, "left");
        break;
    }
    await this.save();
    this.broadcast();
  }

  private relay(room: RoomData, id: string, message: { type: "state"; state: string } | { type: "action"; action: unknown }): void {
    const isKitchen = message.type === "state";
    if (isKitchen ? !canSendKitchen(room, id) : !canSendMove(room, id)) return;
    const forward: ServerMessage = isKitchen ? { type: "state", state: message.state } : { type: "action", from: id, action: message.action };
    for (const socket of this.ctx.getWebSockets()) {
      const target = (socket.deserializeAttachment() as Attachment).id;
      // The kitchen goes to everyone but the host; a move goes to the host only.
      if (isKitchen ? target !== id : target === room.players[0]?.id) this.send(socket, forward);
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    // Answers the close, so the phone learns at once that it is closed (otherwise it waits, stuck "closing").
    try {
      socket.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      // Already closed.
    }
    const room = await this.load();
    if (!room) return;
    // A dropped connection is not leaving (a phone switching apps drops it): the player is away until they come back,
    // or for good after a while (alarm). Leaving on purpose says so first ("leave").
    const { id, connection } = socket.deserializeAttachment() as Attachment;
    markAway(room, id, connection, Date.now());
    this.counters.delete(id);
    await this.save();
    this.broadcast();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.webSocketClose(socket, 1011, "error");
  }

  // The room's own clock: ends a match whose players went quiet, closes an idle room, and finally frees the code.
  async alarm(): Promise<void> {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    const { at, then } = nextDeadline(room);
    if (now < at) return void (await this.ctx.storage.setAlarm(at));
    if (then === "forget") {
      this.ctx.getWebSockets().forEach((socket) => socket.close(1000, "over"));
      await this.ctx.storage.deleteAll();
      this.room = undefined;
      return;
    }
    if (then === "drop") dropAway(room, now);
    else finish(room, now);
    await this.save();
    this.broadcast();
  }
}
