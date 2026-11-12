// Era 3's incidents: now and then, something happens to the plant for a few minutes. A strike slows a workshop down, a
// breakdown stops one, the weather slows the fields or the wind; and sometimes luck smiles (a bumper harvest, a trade
// fair that pays the pizzas dearer). One at a time, always said (what, where, how long), never while the player is away,
// and they can be switched off. A strike ends sooner with a bonus paid, a breakdown with a repair.
import type { BuildingId, PlantState } from "./plant";
import { isResearched } from "./research";

export const INCIDENT_KINDS = ["strike", "breakdown", "drought", "calm", "harvest", "fair"] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export interface Incident {
  kind: IncidentKind;
  /** The kind of building it hits (a strike, a breakdown). */
  building?: BuildingId;
  /** Seconds before it is over. */
  left: number;
}

interface IncidentSpec {
  /** How often it comes, against the others. */
  weight: number;
  seconds: number;
  /** How fast the buildings it hits work (a bonus is above 1). */
  speed: number;
  /** The buildings it can hit: one kind picked among these (a strike, a breakdown), or all of them (the weather). */
  hits: readonly BuildingId[];
  picksOne: boolean;
  /** Whether it is good news. */
  isLucky: boolean;
}

const WORKSHOPS: readonly BuildingId[] = ["mill", "kneader", "oilPress", "cannery", "creamery", "pizzaFactory", "shippingDock"];
const FIELDS: readonly BuildingId[] = ["wheatFarm", "greenhouse", "oliveGrove"];

export const INCIDENTS: Record<IncidentKind, IncidentSpec> = {
  strike: { weight: 25, seconds: 180, speed: 0.5, hits: WORKSHOPS, picksOne: true, isLucky: false },
  breakdown: { weight: 25, seconds: 150, speed: 0, hits: [...WORKSHOPS, "biogasPlant"], picksOne: true, isLucky: false },
  drought: { weight: 15, seconds: 240, speed: 0.6, hits: FIELDS, picksOne: false, isLucky: false },
  calm: { weight: 10, seconds: 180, speed: 0.3, hits: ["windTurbine"], picksOne: false, isLucky: false },
  harvest: { weight: 12, seconds: 120, speed: 1.5, hits: [...FIELDS, "dairyFarm"], picksOne: false, isLucky: true },
  fair: { weight: 13, seconds: 120, speed: 1, hits: ["shippingDock"], picksOne: false, isLucky: true },
};

/** What the trucks get for a pizza during a trade fair, against the usual price. */
export const FAIR_PRICE = 1.5;
/** Seconds between two incidents (the next one comes somewhere in between), and before the first. */
export const INCIDENT_GAP = { min: 300, max: 600 } as const;
export const FIRST_INCIDENT = 900;
/** Ending a strike or a breakdown at once costs this many seconds of what the trucks bring in (and never less than the
 * minimum). */
const FIX_SECONDS = 40;
const MIN_FIX = 100_000;
/** With maintenance researched, breakdowns come half as often and last half as long. */
const MAINTENANCE = 0.5;

export interface IncidentState extends PlantState {
  incident: Incident | null;
  /** Seconds until the next incident. */
  incidentClock: number;
  incidentsOn: boolean;
}

const weightOf = (state: PlantState, kind: IncidentKind): number =>
  INCIDENTS[kind].weight * (kind === "breakdown" && isResearched(state.researched, "maintenance") ? MAINTENANCE : 1);

const durationOf = (state: PlantState, kind: IncidentKind): number =>
  INCIDENTS[kind].seconds * (kind === "breakdown" && isResearched(state.researched, "maintenance") ? MAINTENANCE : 1);

/** The buildings an incident hits. */
export const hitBuildings = (incident: Incident | null): readonly BuildingId[] => {
  if (!incident) return [];
  if (incident.building) return [incident.building];
  return incident.kind === "fair" ? [] : INCIDENTS[incident.kind].hits;
};

/** How fast each building works under the incident of the moment (those it leaves alone are missing). */
export const incidentSpeeds = (incident: Incident | null): Partial<Record<BuildingId, number>> =>
  Object.fromEntries(hitBuildings(incident).map((id) => [id, INCIDENTS[incident!.kind].speed]));

/** What the trucks get for a pizza, against the usual price. */
export const priceFactor = (incident: Incident | null): number => (incident?.kind === "fair" ? FAIR_PRICE : 1);

/** What ending the incident at once costs (a strike or a breakdown only), from what the trucks bring in a second. */
export const fixCost = (incident: Incident | null, income: number): number | null =>
  incident?.kind === "strike" || incident?.kind === "breakdown" ? Math.max(MIN_FIX, Math.round(income * FIX_SECONDS)) : null;

// What can happen now: a strike or a breakdown needs a building to hit, the calm needs wind turbines, a bonus a plant
// that runs.
const possible = (state: PlantState): { kind: IncidentKind; building?: BuildingId }[] =>
  INCIDENT_KINDS.flatMap((kind) => {
    const built = INCIDENTS[kind].hits.filter((id) => state.buildings[id] > 0);
    if (!built.length) return [];
    return INCIDENTS[kind].picksOne ? built.map((building) => ({ kind, building })) : [{ kind }];
  });

/** Picks the next incident, weighted (a kind that picks a building shares its weight among them). */
export const pickIncident = (state: PlantState, random: () => number): Incident | null => {
  const options = possible(state);
  const shares = options.map(({ kind }) => weightOf(state, kind) / options.filter((other) => other.kind === kind).length);
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  const index = shares.findIndex((share) => (roll -= share) < 0);
  const picked = options[index === -1 ? options.length - 1 : index];
  return { ...picked, left: durationOf(state, picked.kind) };
};

const nextGap = (random: () => number): number => INCIDENT_GAP.min + random() * (INCIDENT_GAP.max - INCIDENT_GAP.min);

/** A step of time: the incident of the moment runs out, and, while the player is there (`isLive`), the next one comes
 * when its time has come. Returns the incident that just started, if one did. */
export const stepIncidents = <S extends IncidentState>(state: S, dt: number, random: () => number, isLive: boolean): { state: S; started: Incident | null } => {
  if (state.incident) {
    const left = state.incident.left - dt;
    return { state: { ...state, incident: left > 0 ? { ...state.incident, left } : null }, started: null };
  }
  // No incident until the plant makes pizzas, and none while away.
  if (!state.incidentsOn || !isLive || state.buildings.pizzaFactory < 1) return { state, started: null };
  const clock = state.incidentClock - dt;
  if (clock > 0) return { state: { ...state, incidentClock: clock }, started: null };
  const incident = pickIncident(state, random);
  return { state: { ...state, incident, incidentClock: nextGap(random) }, started: incident };
};

/** Ends a strike (a bonus paid) or a breakdown (a repair) at once. */
export const endIncident = <S extends IncidentState>(state: S): S => ({ ...state, incident: null });

/** Whether a saved incident still makes sense. */
export const readIncident = (value: unknown): Incident | null => {
  if (typeof value !== "object" || value === null) return null;
  const saved = value as Partial<Incident>;
  if (!(INCIDENT_KINDS as readonly string[]).includes(saved.kind as string) || typeof saved.left !== "number" || !Number.isFinite(saved.left) || saved.left <= 0) return null;
  const spec = INCIDENTS[saved.kind as IncidentKind];
  if (spec.picksOne !== (saved.building !== undefined)) return null;
  if (saved.building !== undefined && !spec.hits.includes(saved.building)) return null;
  return { kind: saved.kind as IncidentKind, left: Math.min(saved.left, spec.seconds), ...(saved.building ? { building: saved.building } : {}) };
};

