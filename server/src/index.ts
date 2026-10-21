// The multiplayer server: a Cloudflare Worker, and one Durable Object per room code.
//   POST /rooms               creates a room and returns its code
//   GET  /rooms/ABCD/ws       joins room ABCD (WebSocket)
// A room code is the name of its Durable Object: Cloudflare runs exactly one object per name, which handles one request
// at a time, so two rooms can never share a code, even when created at the same instant.
import { DurableObject } from "cloudflare:workers";
import {
  normalizeRoomCode, parseClientMessage, randomRoomCode, type RoomError, type RoomMode, type ServerMessage,
} from "../../src/multiplayer/protocol";
import {
  addPlayer, allowMessage, canSendKitchen, canSendMove, createRoom, finish, joinError, nextDeadline, noteActivity, recordScore,
  removePlayer, setReady, startMatch, viewOf, type RoomData,
} from "./roomLogic";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Comma-separated origins the game is served from; "*" allows any (local tests on a phone). */
  ALLOWED_ORIGINS: string;
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

    if (request.method === "POST" && url.pathname === "/rooms") {
      const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
      const mode: RoomMode = body.mode === "coop" || body.mode === "duo" ? body.mode : "challenge";
      for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
        const code = randomRoomCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await room.create(code, mode)) return Response.json({ code }, { status: 201, headers: cors });
      }
      return Response.json({ error: "unavailable" satisfies RoomError }, { status: 503, headers: cors });
    }

    const joining = url.pathname.match(/^\/rooms\/([A-Za-z]+)\/ws$/);
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
    for (const socket of this.ctx.getWebSockets()) {
      const { id } = socket.deserializeAttachment() as { id: string };
      this.send(socket, { type: "room", room: viewOf(this.room, now), you: id });
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
    const error = joinError(room);
    if (error || !room) {
      // Accepted only to say why not, then closed: a mistyped code never creates an empty room.
      server.accept();
      this.send(server, { type: "error", reason: error ?? "notFound" });
      server.close(4000, error ?? "notFound");
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = crypto.randomUUID();
    addPlayer(room, id, new URL(request.url).searchParams.get("name") ?? "", Date.now());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id });
    await this.save();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = await this.load();
    const { id } = socket.deserializeAttachment() as { id: string };
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
      case "start": {
        const error = startMatch(room, id, crypto.randomUUID(), now);
        if (error) this.send(socket, { type: "error", reason: error });
        break;
      }
      case "score":
      case "done":
        recordScore(room, id, message.score, message.served, message.type === "done", now);
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
      const target = (socket.deserializeAttachment() as { id: string }).id;
      // The kitchen goes to everyone but the host; a move goes to the host only.
      if (isKitchen ? target !== id : target === room.players[0]?.id) this.send(socket, forward);
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const room = await this.load();
    if (!room) return;
    const { id } = socket.deserializeAttachment() as { id: string };
    removePlayer(room, id, Date.now());
    this.counters.delete(id);
    await this.save();
    this.broadcast();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.webSocketClose(socket);
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
    finish(room, now);
    await this.save();
    this.broadcast();
  }
}
