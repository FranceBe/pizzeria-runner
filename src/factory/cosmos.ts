// Era 4, the universe: the rules only (no React). Earth sits in the middle of a star map. Around it, terroir planets
// grow the cosmic ingredients (star wheat, red tomatoes, moon cheese) and civilisations, near and far, want pizzas.
// Colonising a terroir, or meeting a civilisation, opens a cargo route to Earth: the farther the planet, the longer each
// trip, so the more cargo ships a route takes for the same flow. On Earth, orbital ovens turn one of each ingredient
// into a cosmic pizza. The player balances it all: what the terroirs grow, what the routes carry, what the ovens make,
// what the civilisations eat. Embassies make a civilisation hungrier (and the plant has to keep up). Exploring finds
// more planets (the farthest need the hyperdrive), and the stellar oven, built in eight stages around the sun, ends the
// game: the pizza of the universe. Research brings automations: a logistician who equips the routes, stewards who build
// the ovens, an agronomist who grows the farms.
import { isResearched, type ResearchId } from "./research";

export const INGREDIENTS = ["starWheat", "redTomato", "moonCheese"] as const;
export type Ingredient = (typeof INGREDIENTS)[number];
export const COSMIC_GOODS = [...INGREDIENTS, "cosmicPizza"] as const;
export type CosmicGood = (typeof COSMIC_GOODS)[number];

export const PLANET_IDS = [
  "helia", "rubra", "selena", "farro", "pomodor", "grana",
  "orbitans", "tellures", "nebulins", "cometaires", "quasari", "aurorains",
] as const;
export type PlanetId = (typeof PLANET_IDS)[number];

type Ring = 1 | 2 | 3;

interface PlanetBase {
  /** How far out it is: the first ring is known from the start, the second is explored, the third needs the hyperdrive. */
  ring: Ring;
  /** Light years from Earth. */
  distance: number;
  /** What colonising it, or meeting it, costs (a route with one cargo ship comes with it). */
  openCost: number;
}

export interface TerroirSpec extends PlanetBase {
  kind: "terroir";
  good: Ingredient;
  /** What it grows a second, per level of its farms. */
  yield: number;
  /** What the second level of its farms costs (each next one costs more). */
  levelCost: number;
}

export interface CivSpec extends PlanetBase {
  kind: "civ";
  /** Cosmic pizzas it would eat a second, per level of its embassy. */
  demand: number;
  /** What it pays for one. */
  price: number;
}

export type PlanetSpec = TerroirSpec | CivSpec;

export const PLANETS: Record<PlanetId, PlanetSpec> = {
  helia: { kind: "terroir", good: "starWheat", ring: 1, distance: 1.5, openCost: 1e8, yield: 1.5, levelCost: 5e7 },
  rubra: { kind: "terroir", good: "redTomato", ring: 1, distance: 2, openCost: 1e8, yield: 1.5, levelCost: 5e7 },
  selena: { kind: "terroir", good: "moonCheese", ring: 1, distance: 1, openCost: 1e8, yield: 1.5, levelCost: 5e7 },
  farro: { kind: "terroir", good: "starWheat", ring: 2, distance: 4, openCost: 2e9, yield: 5, levelCost: 5e8 },
  pomodor: { kind: "terroir", good: "redTomato", ring: 2, distance: 5, openCost: 2e9, yield: 5, levelCost: 5e8 },
  grana: { kind: "terroir", good: "moonCheese", ring: 2, distance: 6, openCost: 2e9, yield: 5, levelCost: 5e8 },
  orbitans: { kind: "civ", ring: 1, distance: 2, openCost: 5e7, demand: 3, price: 2e6 },
  tellures: { kind: "civ", ring: 1, distance: 3, openCost: 5e8, demand: 6, price: 4e6 },
  nebulins: { kind: "civ", ring: 2, distance: 5, openCost: 3e9, demand: 15, price: 1e7 },
  cometaires: { kind: "civ", ring: 2, distance: 7, openCost: 1.5e10, demand: 25, price: 2e7 },
  quasari: { kind: "civ", ring: 3, distance: 12, openCost: 1e11, demand: 60, price: 5e7 },
  aurorains: { kind: "civ", ring: 3, distance: 15, openCost: 3e11, demand: 100, price: 1e8 },
};

/** The order planets are found in, exploring (the first ring is known from the start). */
export const EXPLORE_ORDER: readonly PlanetId[] = ["farro", "nebulins", "pomodor", "grana", "cometaires", "quasari", "aurorains"];
const KNOWN_AT_START: readonly PlanetId[] = PLANET_IDS.filter((id) => PLANETS[id].ring === 1);
export const EXPLORE_SECONDS = 45;
const EXPLORE_COST: Record<Ring, number> = { 1: 0, 2: 3e8, 3: 1e10 };

/** A cargo ship carries this many goods a trip, and takes this many seconds a light year, each way. */
const SHIP_LOAD = 10;
const SECONDS_PER_LIGHT_YEAR = 5;
/** A cargo ship costs this much per light year of its route; selling one back brings half. */
const SHIP_COST_PER_LIGHT_YEAR = 1e7;
const SHIP_REFUND = 0.5;
/** Each level of a terroir's farms costs this much more than the one before. */
const LEVEL_GROWTH = 1.12;
/** A civilisation's embassy: the next level costs this share of meeting it, more each level. */
const EMBASSY_SHARE = 0.6;
const EMBASSY_GROWTH = 1.6;
/** An orbital oven makes this many cosmic pizzas a second; each one costs more than the one before. */
const OVEN_RATE = 4;
const OVEN_COST = 2e8;
const OVEN_GROWTH = 1.2;
/** Earth's stores hold this many seconds of what fills them (never less than MIN_STORE). */
const STORE_SECONDS = 60;
const MIN_STORE = 200;
const SMOOTHING_SECONDS = 3;

/** The stellar oven, stage by stage: what each costs, and how many cosmic pizzas must have been delivered first (word of
 * it has to get around the universe). */
export const STAGES: readonly { cost: number; sold: number }[] = [
  { cost: 5e9, sold: 1_000 },
  { cost: 3e10, sold: 6_000 },
  { cost: 1.5e11, sold: 25_000 },
  { cost: 5e11, sold: 80_000 },
  { cost: 2e12, sold: 250_000 },
  { cost: 4e12, sold: 700_000 },
  { cost: 6e12, sold: 1_500_000 },
  { cost: 1.5e13, sold: 3_000_000 },
];

export interface PlanetState {
  /** Colonised (a terroir) or met (a civilisation): its route is open. */
  open: boolean;
  /** A terroir's farms, or a civilisation's embassy (1 once colonised or met). */
  level: number;
  ships: number;
}

export interface CosmosState {
  planets: Record<PlanetId, PlanetState>;
  /** The planets on the map (the first ring, and those explored). */
  known: PlanetId[];
  exploring: { planet: PlanetId; left: number } | null;
  /** Earth's stores. */
  stocks: Record<CosmicGood, number>;
  ovens: number;
  /** What each route really carried a second, and the ovens made, smoothed; how each store moves. */
  flows: Record<PlanetId, number>;
  ovenRate: number;
  trends: Record<CosmicGood, number>;
  /** Cosmic pizzas delivered so far. */
  sold: number;
  /** Stages of the stellar oven built (all five: the game is won). */
  stage: number;
  /** When the stellar oven was lit (seconds of play), once. */
  endedAt: number | null;
}

/** What the universe needs from the rest of the game. */
export interface CosmosHost {
  era: number;
  money: number;
  seconds: number;
  researched: ResearchId[];
  cosmos: CosmosState;
}

const zeros = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

export const newCosmos = (): CosmosState => ({
  planets: Object.fromEntries(PLANET_IDS.map((id) => [id, { open: false, level: 0, ships: 0 }])) as Record<PlanetId, PlanetState>,
  known: [...KNOWN_AT_START],
  exploring: null,
  stocks: zeros(COSMIC_GOODS),
  ovens: 0,
  flows: zeros(PLANET_IDS),
  ovenRate: 0,
  trends: zeros(COSMIC_GOODS),
  sold: 0,
  stage: 0,
  endedAt: null,
});

// --- What research brings --------------------------------------------------------------------------------------------

const done = (host: Pick<CosmosHost, "researched">, id: ResearchId) => isResearched(host.researched, id);

/** Goods a cargo ship moves a second on a route this long. */
export const perShip = (host: Pick<CosmosHost, "researched">, id: PlanetId): number => {
  const load = SHIP_LOAD * (done(host, "cargoHolds") ? 3 : 1);
  const speed = done(host, "hyperdrive") ? 2 : 1;
  return (load * speed) / (2 * PLANETS[id].distance * SECONDS_PER_LIGHT_YEAR);
};

/** What a route can carry a second, with its ships. */
export const routeCapacity = (host: Pick<CosmosHost, "researched" | "cosmos">, id: PlanetId): number =>
  host.cosmos.planets[id].ships * perShip(host, id);

/** What a terroir grows a second. */
export const production = (host: Pick<CosmosHost, "researched" | "cosmos">, id: PlanetId): number => {
  const spec = PLANETS[id];
  return spec.kind === "terroir" ? host.cosmos.planets[id].level * spec.yield * (done(host, "terraforming") ? 2 : 1) : 0;
};

export const ovenCapacity = (host: Pick<CosmosHost, "researched" | "cosmos">): number =>
  host.cosmos.ovens * OVEN_RATE * (done(host, "orbitalChefs") ? 2 : 1);

/** What a route should carry: all a terroir grows, all a civilisation would eat. */
export const routeTarget = (host: Pick<CosmosHost, "researched" | "cosmos">, id: PlanetId): number => {
  const spec = PLANETS[id];
  return spec.kind === "terroir" ? production(host, id) : demandOf(host, id);
};

/** What a civilisation would eat a second, with its embassy. */
export const demandOf = (host: Pick<CosmosHost, "cosmos">, id: PlanetId): number => {
  const spec = PLANETS[id];
  return spec.kind === "civ" ? spec.demand * Math.max(1, host.cosmos.planets[id].level) : 0;
};

/** Ships it takes for a route to carry its target, and how many more than it has. */
export const shipsNeeded = (host: Pick<CosmosHost, "researched" | "cosmos">, id: PlanetId): number =>
  Math.max(0, Math.ceil(routeTarget(host, id) / perShip(host, id) - 1e-9) - host.cosmos.planets[id].ships);

export const storeCap = (host: Pick<CosmosHost, "researched" | "cosmos">, good: CosmicGood): number => {
  if (good === "cosmicPizza") return Math.max(MIN_STORE, STORE_SECONDS * ovenCapacity(host));
  const inflow = PLANET_IDS.reduce((sum, id) => {
    const spec = PLANETS[id];
    return spec.kind === "terroir" && spec.good === good ? sum + routeCapacity(host, id) : sum;
  }, 0);
  return Math.max(MIN_STORE, STORE_SECONDS * inflow);
};

/** Whether a planet can be reached at all: the third ring takes the hyperdrive. */
export const isReachable = (host: Pick<CosmosHost, "researched">, id: PlanetId): boolean => PLANETS[id].ring < 3 || done(host, "hyperdrive");

// --- Prices ----------------------------------------------------------------------------------------------------------

/** The next level of a terroir's farms, or of a civilisation's embassy. */
export const levelCost = (host: Pick<CosmosHost, "cosmos">, id: PlanetId): number => {
  const spec = PLANETS[id];
  const level = host.cosmos.planets[id].level;
  return spec.kind === "terroir" ? spec.levelCost * LEVEL_GROWTH ** (level - 1) : spec.openCost * EMBASSY_SHARE * EMBASSY_GROWTH ** (level - 1);
};
export const shipCost = (id: PlanetId): number => SHIP_COST_PER_LIGHT_YEAR * PLANETS[id].distance;
export const shipRefund = (id: PlanetId): number => shipCost(id) * SHIP_REFUND;
export const ovenCost = (host: Pick<CosmosHost, "cosmos">): number => OVEN_COST * OVEN_GROWTH ** host.cosmos.ovens;

/** The next planet to explore, if any is left (and reachable). */
export const nextToExplore = (host: Pick<CosmosHost, "researched" | "cosmos">): PlanetId | null =>
  EXPLORE_ORDER.find((id) => !host.cosmos.known.includes(id)) ?? null;
export const exploreCost = (id: PlanetId): number => EXPLORE_COST[PLANETS[id].ring];

// --- The player's actions --------------------------------------------------------------------------------------------

const withPlanet = <S extends CosmosHost>(host: S, id: PlanetId, planet: Partial<PlanetState>, cost: number): S => ({
  ...host,
  money: host.money - cost,
  cosmos: { ...host.cosmos, planets: { ...host.cosmos.planets, [id]: { ...host.cosmos.planets[id], ...planet } } },
});

const canAct = (host: CosmosHost, cost: number) => host.era >= 4 && host.money >= cost && Number.isFinite(cost);

/** Colonises a terroir or meets a civilisation: its route opens, with one cargo ship. */
export const openPlanet = <S extends CosmosHost>(host: S, id: PlanetId): S | null => {
  const planet = host.cosmos.planets[id];
  const cost = PLANETS[id].openCost;
  if (planet.open || !host.cosmos.known.includes(id) || !isReachable(host, id) || !canAct(host, cost)) return null;
  return withPlanet(host, id, { open: true, level: 1, ships: Math.max(1, planet.ships) }, cost);
};

/** One more level of farms on a terroir, or of a civilisation's embassy. */
export const raiseLevel = <S extends CosmosHost>(host: S, id: PlanetId): S | null => {
  const cost = levelCost(host, id);
  if (!host.cosmos.planets[id].open || !canAct(host, cost)) return null;
  return withPlanet(host, id, { level: host.cosmos.planets[id].level + 1 }, cost);
};

/** Cargo ships for a route: `count` of them, or as many as the till allows, whichever comes first. */
export const addShips = <S extends CosmosHost>(host: S, id: PlanetId, count: number): S | null => {
  const affordable = Math.min(count, Math.floor(host.money / shipCost(id)));
  if (!host.cosmos.planets[id].open || affordable < 1 || !canAct(host, shipCost(id))) return null;
  return withPlanet(host, id, { ships: host.cosmos.planets[id].ships + affordable }, affordable * shipCost(id));
};

/** One cargo ship sold back (a route keeps at least one). */
export const removeShip = <S extends CosmosHost>(host: S, id: PlanetId): S | null => {
  if (host.era < 4 || host.cosmos.planets[id].ships <= 1) return null;
  return withPlanet(host, id, { ships: host.cosmos.planets[id].ships - 1 }, -shipRefund(id));
};

export const buildOven = <S extends CosmosHost>(host: S): S | null => {
  const cost = ovenCost(host);
  if (!canAct(host, cost)) return null;
  return { ...host, money: host.money - cost, cosmos: { ...host.cosmos, ovens: host.cosmos.ovens + 1 } };
};

/** Sends a scout to the next planet: found after a while. */
export const explore = <S extends CosmosHost>(host: S): S | null => {
  const planet = nextToExplore(host);
  if (!planet || host.cosmos.exploring || !isReachable(host, planet)) return null;
  const cost = exploreCost(planet);
  if (!canAct(host, cost)) return null;
  return { ...host, money: host.money - cost, cosmos: { ...host.cosmos, exploring: { planet, left: EXPLORE_SECONDS } } };
};

/** Whether the next stage of the stellar oven can be built: the word has got around, and the till allows. */
export const canBuildStage = (host: CosmosHost): boolean => {
  const stage = STAGES[host.cosmos.stage];
  return stage !== undefined && host.cosmos.sold >= stage.sold && canAct(host, stage.cost);
};

/** The next stage of the stellar oven; the last one lights it (and the game is won). */
export const buildStage = <S extends CosmosHost>(host: S): S | null => {
  if (!canBuildStage(host)) return null;
  const stage = host.cosmos.stage + 1;
  const endedAt = stage === STAGES.length ? (host.cosmos.endedAt ?? host.seconds) : host.cosmos.endedAt;
  return { ...host, money: host.money - STAGES[host.cosmos.stage].cost, cosmos: { ...host.cosmos, stage, endedAt } };
};

// --- Automations (research): the same moves the player makes, out of a budget -------------------------------------

/** The logistician: every route gets the ships it lacks, out of `budget`. */
export const equipRoutes = <S extends CosmosHost>(host: S, budget: number): S => {
  let next = host;
  let left = budget;
  for (const id of PLANET_IDS) {
    const missing = next.cosmos.planets[id].open ? Math.min(shipsNeeded(next, id), Math.floor(left / shipCost(id))) : 0;
    if (missing < 1) continue;
    next = addShips(next, id, missing) ?? next;
    left -= missing * shipCost(id);
  }
  return next;
};

/** What reaches Earth of an ingredient a second, at most, with the routes as they are. */
export const inflowOf = (host: Pick<CosmosHost, "researched" | "cosmos">, good: Ingredient): number =>
  PLANET_IDS.reduce((sum, id) => {
    const spec = PLANETS[id];
    return spec.kind === "terroir" && spec.good === good && host.cosmos.planets[id].open ? sum + Math.min(production(host, id), routeCapacity(host, id)) : sum;
  }, 0);

/** What the civilisations met would eat a second, all together. */
export const appetite = (host: Pick<CosmosHost, "cosmos">): number => PLANET_IDS.reduce((sum, id) => sum + (host.cosmos.planets[id].open ? demandOf(host, id) : 0), 0);

/** The stewards: ovens while they can't keep up with both the ingredients coming in and the appetite, out of `budget`. */
export const buildOvensAsNeeded = <S extends CosmosHost>(host: S, budget: number): S => {
  let next = host;
  let left = budget;
  const wanted = Math.min(...INGREDIENTS.map((good) => inflowOf(host, good)), appetite(host));
  for (let i = 0; i < 20 && ovenCapacity(next) < wanted && ovenCost(next) <= left; i++) {
    left -= ovenCost(next);
    next = buildOven(next) ?? next;
  }
  return next;
};

/** The agronomist: a level for the farms of each ingredient that falls short of the appetite, out of `budget` (the
 * cheapest farm for what it grows). Never more than what is eaten: late on, a level costs a fortune. */
export const growShortFarms = <S extends CosmosHost>(host: S, budget: number): S => {
  let next = host;
  let left = budget;
  for (const good of INGREDIENTS) {
    if (inflowOf(next, good) >= appetite(next)) continue;
    const farm = PLANET_IDS.filter((id) => {
      const spec = PLANETS[id];
      return spec.kind === "terroir" && spec.good === good && next.cosmos.planets[id].open;
    }).sort((a, b) => levelCost(next, a) / PLANETS[a].distance - levelCost(next, b) / PLANETS[b].distance)[0];
    if (!farm || levelCost(next, farm) > left) continue;
    left -= levelCost(next, farm);
    next = raiseLevel(next, farm) ?? next;
  }
  return next;
};

// --- A step of time --------------------------------------------------------------------------------------------------

export interface CosmosStep {
  cosmos: CosmosState;
  /** Money made selling cosmic pizzas, and how many were delivered. */
  earned: number;
  delivered: number;
  /** The cosmic pizzas each civilisation got. */
  deliveredTo: Partial<Record<PlanetId, number>>;
  /** A planet just found, if one was. */
  found: PlanetId | null;
}

const smooth = (current: number, value: number, dt: number): number => current + (value - current) * Math.min(1, dt / SMOOTHING_SECONDS);

/** One step of the universe (`boost`: the rush, the terroirs and the ovens faster): the scouts travel, the routes bring the ingredients home, the ovens bake, the routes take
 * the pizzas out (shared among the civilisations by what each asks, when there are not enough). */
export const runCosmos = (host: Pick<CosmosHost, "researched" | "cosmos">, dt: number, boost = 1): CosmosStep => {
  const cosmos = host.cosmos;
  const stocks = { ...cosmos.stocks };
  const carried = zeros(PLANET_IDS);

  let found: PlanetId | null = null;
  let exploring = cosmos.exploring;
  let known = cosmos.known;
  if (exploring) {
    const left = exploring.left - dt;
    if (left > 0) exploring = { ...exploring, left };
    else {
      found = exploring.planet;
      known = [...known, exploring.planet];
      exploring = null;
    }
  }

  // The terroirs' routes, as far as what grows, the ships and the room in Earth's stores allow.
  for (const good of INGREDIENTS) {
    const routes = PLANET_IDS.filter((id) => {
      const spec = PLANETS[id];
      return spec.kind === "terroir" && spec.good === good && cosmos.planets[id].open;
    });
    const loads = routes.map((id) => Math.min(production(host, id) * boost, routeCapacity(host, id)) * dt);
    const total = loads.reduce((sum, load) => sum + load, 0);
    const share = total > 0 ? Math.min(1, Math.max(0, storeCap(host, good) - stocks[good]) / total) : 0;
    routes.forEach((id, i) => {
      carried[id] = loads[i] * share;
      stocks[good] += carried[id];
    });
  }

  // The ovens: one of each ingredient makes a cosmic pizza.
  const baked = Math.max(
    0,
    Math.min(ovenCapacity(host) * boost * dt, stocks.starWheat, stocks.redTomato, stocks.moonCheese, storeCap(host, "cosmicPizza") - stocks.cosmicPizza),
  );
  for (const good of INGREDIENTS) stocks[good] = Math.max(0, stocks[good] - baked);
  stocks.cosmicPizza += baked;

  // The civilisations' routes: each asks for what it would eat, as far as its ships carry.
  const civs = PLANET_IDS.filter((id) => PLANETS[id].kind === "civ" && cosmos.planets[id].open);
  const asked = civs.map((id) => Math.min(routeTarget(host, id), routeCapacity(host, id)) * dt);
  const totalAsked = asked.reduce((sum, amount) => sum + amount, 0);
  const served = totalAsked > 0 ? Math.min(1, stocks.cosmicPizza / totalAsked) : 0;
  let earned = 0;
  let delivered = 0;
  const deliveredTo: Partial<Record<PlanetId, number>> = {};
  civs.forEach((id, i) => {
    const spec = PLANETS[id] as CivSpec;
    carried[id] = asked[i] * served;
    deliveredTo[id] = carried[id];
    delivered += carried[id];
    earned += carried[id] * spec.price;
  });
  stocks.cosmicPizza = Math.max(0, stocks.cosmicPizza - delivered);

  const flows = Object.fromEntries(PLANET_IDS.map((id) => [id, smooth(cosmos.flows[id], carried[id] / dt, dt)])) as Record<PlanetId, number>;
  const trends = Object.fromEntries(COSMIC_GOODS.map((good) => [good, smooth(cosmos.trends[good], (stocks[good] - cosmos.stocks[good]) / dt, dt)])) as Record<CosmicGood, number>;
  return {
    cosmos: { ...cosmos, known, exploring, stocks, flows, trends, ovenRate: smooth(cosmos.ovenRate, baked / dt, dt), sold: cosmos.sold + delivered },
    earned,
    delivered,
    deliveredTo,
    found,
  };
};

// --- How each planet is doing -----------------------------------------------------------------------------------------

export type PlanetStatus =
  | { kind: "unknown" }
  | { kind: "unreachable" }
  | { kind: "closed" }
  /** A route that can't carry all there is to carry (a terroir's harvest, a civilisation's appetite). */
  | { kind: "needsShips"; carried: number; target: number }
  /** A terroir whose goods wait: Earth's store is full. */
  | { kind: "storeFull" }
  /** A civilisation that gets fewer pizzas than its ships could carry. */
  | { kind: "hungry"; share: number }
  | { kind: "running" };

export const planetStatus = (host: Pick<CosmosHost, "researched" | "cosmos">, id: PlanetId): PlanetStatus => {
  const { cosmos } = host;
  if (!cosmos.known.includes(id)) return { kind: "unknown" };
  if (!isReachable(host, id)) return { kind: "unreachable" };
  if (!cosmos.planets[id].open) return { kind: "closed" };
  const spec = PLANETS[id];
  const capacity = routeCapacity(host, id);
  const target = routeTarget(host, id);
  if (spec.kind === "terroir") {
    if (capacity < target * 0.98) return { kind: "needsShips", carried: capacity, target };
    if (cosmos.flows[id] < target * 0.95 && cosmos.stocks[spec.good] >= storeCap(host, spec.good) * 0.99) return { kind: "storeFull" };
    return { kind: "running" };
  }
  const possible = Math.min(capacity, target);
  if (possible > 0 && cosmos.flows[id] < possible * 0.95) return { kind: "hungry", share: cosmos.flows[id] / target };
  if (capacity < target * 0.98) return { kind: "needsShips", carried: capacity, target };
  return { kind: "running" };
};

/** What holds the ovens back, if anything: an ingredient short, or the pizza store full. */
export const ovenStatus = (host: Pick<CosmosHost, "researched" | "cosmos">): { kind: "none" | "running" | "full" } | { kind: "short"; good: Ingredient } => {
  const { cosmos } = host;
  if (cosmos.ovens < 1) return { kind: "none" };
  const capacity = ovenCapacity(host);
  if (cosmos.ovenRate >= capacity * 0.95) return { kind: "running" };
  if (cosmos.stocks.cosmicPizza >= storeCap(host, "cosmicPizza") * 0.99) return { kind: "full" };
  const scarcest = [...INGREDIENTS].sort((a, b) => cosmos.stocks[a] - cosmos.stocks[b])[0];
  return { kind: "short", good: scarcest };
};

// --- Saves -----------------------------------------------------------------------------------------------------------

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** A saved universe, read with care: what makes no sense goes back to how it starts. */
export const readCosmos = (value: unknown): CosmosState => {
  const fresh = newCosmos();
  if (typeof value !== "object" || value === null) return fresh;
  const saved = value as Partial<Record<keyof CosmosState, unknown>>;
  const savedPlanets = (typeof saved.planets === "object" && saved.planets !== null ? saved.planets : {}) as Partial<Record<PlanetId, Partial<PlanetState>>>;
  const planets = Object.fromEntries(
    PLANET_IDS.map((id) => {
      const planet = savedPlanets[id];
      const open = planet?.open === true;
      return [id, {
        open,
        level: open ? Math.max(1, isCount(planet?.level) ? Math.floor(planet.level) : 1) : 0,
        ships: open ? Math.max(1, isCount(planet?.ships) ? Math.floor(planet.ships) : 1) : 0,
      }];
    }),
  ) as Record<PlanetId, PlanetState>;
  const known = Array.isArray(saved.known) ? PLANET_IDS.filter((id) => KNOWN_AT_START.includes(id) || (saved.known as unknown[]).includes(id)) : fresh.known;
  // An open planet is a known one.
  for (const id of PLANET_IDS) if (planets[id].open && !known.includes(id)) known.push(id);
  const exploring = saved.exploring as { planet?: unknown; left?: unknown } | null | undefined;
  const readGoods = (goods: unknown, signed: boolean) =>
    Object.fromEntries(COSMIC_GOODS.map((good) => {
      const amount = (typeof goods === "object" && goods !== null ? (goods as Record<string, unknown>)[good] : 0);
      return [good, typeof amount === "number" && Number.isFinite(amount) && (signed || amount >= 0) ? amount : 0];
    })) as Record<CosmicGood, number>;
  const flowsSaved = (typeof saved.flows === "object" && saved.flows !== null ? saved.flows : {}) as Record<string, unknown>;
  const stage = isCount(saved.stage) ? Math.min(STAGES.length, Math.floor(saved.stage)) : 0;
  return {
    planets,
    known,
    exploring:
      exploring && (PLANET_IDS as readonly string[]).includes(exploring.planet as string) && !known.includes(exploring.planet as PlanetId) && isCount(exploring.left)
        ? { planet: exploring.planet as PlanetId, left: Math.min(exploring.left, EXPLORE_SECONDS) }
        : null,
    stocks: readGoods(saved.stocks, false),
    ovens: isCount(saved.ovens) ? Math.floor(saved.ovens) : 0,
    flows: Object.fromEntries(PLANET_IDS.map((id) => [id, isCount(flowsSaved[id]) ? flowsSaved[id] : 0])) as Record<PlanetId, number>,
    ovenRate: isCount(saved.ovenRate) ? saved.ovenRate : 0,
    trends: readGoods(saved.trends, true),
    sold: isCount(saved.sold) ? saved.sold : 0,
    stage,
    endedAt: stage === STAGES.length ? (isCount(saved.endedAt) ? saved.endedAt : 0) : null,
  };
};
