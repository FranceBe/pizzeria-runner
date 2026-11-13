// Special orders: now and then, someone asks for a lot of pizzas in a short time. A wedding, a festival, a team after
// the match (the restaurants' pizzas); a supermarket contract (the trucks' pizzas, from era 3); a galactic banquet at
// one of the civilisations (from era 4). The aim is a little above the pace of the moment, so it takes a push (a lower
// price, more cooks, more ships); done in time, it pays well above the pizzas' price. One at a time, never while the
// player is away, and one can be turned down.
import { PLANETS, type PlanetId } from "./cosmos";

export const ORDER_KINDS = ["wedding", "festival", "footballTeam", "school", "company", "contract", "banquet"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** What an order counts: the restaurants' pizzas sold, the trucks' pizzas shipped, or cosmic pizzas delivered to one
 * civilisation. */
export type OrderSource = "restaurants" | "trucks" | "civ";

interface OrderSpec {
  source: OrderSource;
  /** The era it can come from. */
  era: number;
  seconds: number;
}

export const ORDERS: Record<OrderKind, OrderSpec> = {
  wedding: { source: "restaurants", era: 1, seconds: 150 },
  festival: { source: "restaurants", era: 1, seconds: 180 },
  footballTeam: { source: "restaurants", era: 1, seconds: 120 },
  school: { source: "restaurants", era: 2, seconds: 180 },
  company: { source: "restaurants", era: 2, seconds: 240 },
  contract: { source: "trucks", era: 3, seconds: 240 },
  banquet: { source: "civ", era: 4, seconds: 240 },
};

export interface Order {
  kind: OrderKind;
  /** The civilisation a banquet is for. */
  civ?: PlanetId;
  target: number;
  progress: number;
  /** Seconds before it is too late. */
  left: number;
  reward: number;
}

/** How much above the pace of the moment an order asks, and how much above the pizzas' price it pays. */
const STRETCH = 1.3;
const REWARD = 2.5;
/** Never fewer pizzas than this (the first orders, while pizzas are made by hand). */
const MIN_TARGET = 25;
/** Seconds between two orders (the next one comes somewhere in between), and before the first. */
export const ORDER_GAP = { min: 240, max: 420 } as const;
export const FIRST_ORDER = 300;
/** No order until this many pizzas are sold: the first minutes are the tour's. */
export const ORDERS_FROM_SALES = 150;

/** The pace of the moment, for each source, and what a pizza fetches. */
export interface Pace {
  restaurants: { rate: number; price: number };
  trucks: { rate: number; price: number };
  /** The civilisations met: how many pizzas each gets a second. */
  civs: { id: PlanetId; rate: number }[];
}

/** A new order, fitted to the pace of the moment (null if nothing fits). */
export const makeOrder = (era: number, pace: Pace, random: () => number): Order | null => {
  const kinds = ORDER_KINDS.filter((kind) => {
    const { source, era: from } = ORDERS[kind];
    if (era < from) return false;
    if (source === "trucks") return pace.trucks.rate > 0;
    if (source === "civ") return pace.civs.some((civ) => civ.rate > 0);
    return true;
  });
  if (!kinds.length) return null;
  const kind = kinds[Math.floor(random() * kinds.length)];
  const { source, seconds } = ORDERS[kind];
  const aim = (rate: number) => Math.max(MIN_TARGET, Math.ceil(rate * seconds * STRETCH));
  if (source === "civ") {
    const civs = pace.civs.filter((civ) => civ.rate > 0);
    const civ = civs[Math.floor(random() * civs.length)];
    const spec = PLANETS[civ.id];
    const target = Math.max(10, Math.ceil(civ.rate * seconds * STRETCH));
    return { kind, civ: civ.id, target, progress: 0, left: seconds, reward: target * (spec.kind === "civ" ? spec.price : 0) * REWARD };
  }
  const { rate, price } = pace[source];
  const target = aim(rate);
  return { kind, target, progress: 0, left: seconds, reward: target * price * REWARD };
};

/** What counts toward an order in a step: the pizzas of its source. */
export interface OrderStep {
  restaurants: number;
  trucks: number;
  civs: Partial<Record<PlanetId, number>>;
}

/** A step of an order: its pizzas count, its time runs out. Done, it says so; too late, it is gone. */
export const stepOrder = (order: Order, dt: number, made: OrderStep): { order: Order | null; done: boolean } => {
  const { source } = ORDERS[order.kind];
  const counted = source === "civ" ? (order.civ ? made.civs[order.civ] ?? 0 : 0) : made[source];
  const progress = order.progress + counted;
  if (progress >= order.target) return { order: null, done: true };
  const left = order.left - dt;
  return { order: left > 0 ? { ...order, progress, left } : null, done: false };
};

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Whether a saved order still makes sense. */
export const readOrder = (value: unknown): Order | null => {
  if (typeof value !== "object" || value === null) return null;
  const saved = value as Partial<Order>;
  if (!(ORDER_KINDS as readonly string[]).includes(saved.kind as string)) return null;
  if (!isCount(saved.target) || !isCount(saved.progress) || !isCount(saved.left) || !isCount(saved.reward) || saved.left <= 0) return null;
  const kind = saved.kind as OrderKind;
  if ((ORDERS[kind].source === "civ") !== (saved.civ !== undefined) || (saved.civ !== undefined && PLANETS[saved.civ]?.kind !== "civ")) return null;
  return {
    kind, target: saved.target, progress: Math.min(saved.progress, saved.target), left: Math.min(saved.left, ORDERS[kind].seconds), reward: saved.reward,
    ...(saved.civ ? { civ: saved.civ } : {}),
  };
};
