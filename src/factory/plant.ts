// Era 3, the factories: the plant's rules (no React). Raw buildings draw from the land, processing buildings turn goods
// into others (the creamery leaves whey besides), the pizza factories assemble pizzas, the trucks take them away and sell
// them, the laboratories turn them into research. Every building needs power: wind turbines make a little, biogas plants
// burn the whey for more. Goods wait in stores between the buildings; a building short of an input, or whose output store
// is full, slows down; short of power, every building does.
//
// Nothing here tells the player what to build: they read it from the stores (rising, empty) and the buildings' states.
// The planner below (`planFor`) works out what a balanced plant needs: it is the calculator, the modules and the foreman
// of the research tree, and the robot that balances the game.
import { isResearched, type ResearchId } from "./research";

export const GOODS = ["wheat", "water", "tomato", "olive", "milk", "salt", "flour", "dough", "oil", "sauce", "cheese", "whey", "frozen"] as const;
export type Good = (typeof GOODS)[number];

export const BUILDING_IDS = [
  "wheatFarm", "waterPump", "greenhouse", "oliveGrove", "dairyFarm", "saltWorks",
  "mill", "kneader", "oilPress", "cannery", "creamery",
  "pizzaFactory", "shippingDock", "researchLab",
  "windTurbine", "biogasPlant",
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export type BuildingGroup = "raw" | "processing" | "output" | "power";

export interface BuildingSpec {
  group: BuildingGroup;
  /** Goods used and made a second, at full speed (before upgrades). */
  uses: Partial<Record<Good, number>>;
  makes: Partial<Record<Good, number>>;
  /** Power used, in MW (made, for a power plant). */
  power: number;
  baseCost: number;
}

/** Goods move in thousands: one unit of a recipe below is a thousand of them. */
const SCALE = 1000;
const per = (goods: Partial<Record<Good, number>>): Partial<Record<Good, number>> =>
  Object.fromEntries(Object.entries(goods).map(([good, amount]) => [good, amount * SCALE]));

export const BUILDINGS: Record<BuildingId, BuildingSpec> = {
  wheatFarm: { group: "raw", uses: {}, makes: per({ wheat: 4 }), power: 1, baseCost: 150_000 },
  waterPump: { group: "raw", uses: {}, makes: per({ water: 6 }), power: 2, baseCost: 120_000 },
  greenhouse: { group: "raw", uses: {}, makes: per({ tomato: 4.5 }), power: 1, baseCost: 150_000 },
  oliveGrove: { group: "raw", uses: {}, makes: per({ olive: 3 }), power: 1, baseCost: 150_000 },
  dairyFarm: { group: "raw", uses: {}, makes: per({ milk: 4 }), power: 1, baseCost: 150_000 },
  saltWorks: { group: "raw", uses: {}, makes: per({ salt: 2 }), power: 2, baseCost: 200_000 },
  mill: { group: "processing", uses: per({ wheat: 4 }), makes: per({ flour: 2 }), power: 3, baseCost: 300_000 },
  kneader: { group: "processing", uses: per({ flour: 2, water: 2, salt: 0.5 }), makes: per({ dough: 2 }), power: 3, baseCost: 300_000 },
  oilPress: { group: "processing", uses: per({ olive: 3 }), makes: per({ oil: 1 }), power: 2, baseCost: 300_000 },
  cannery: { group: "processing", uses: per({ tomato: 4.5, oil: 1.5 }), makes: per({ sauce: 3 }), power: 3, baseCost: 300_000 },
  creamery: { group: "processing", uses: per({ milk: 4, salt: 1 }), makes: per({ cheese: 1, whey: 2 }), power: 3, baseCost: 300_000 },
  pizzaFactory: { group: "output", uses: per({ dough: 3, sauce: 3, cheese: 3 }), makes: per({ frozen: 3 }), power: 6, baseCost: 1_000_000 },
  shippingDock: { group: "output", uses: per({ frozen: 5 }), makes: {}, power: 2, baseCost: 300_000 },
  researchLab: { group: "output", uses: per({ frozen: 2 }), makes: {}, power: 4, baseCost: 1_000_000 },
  windTurbine: { group: "power", uses: {}, makes: {}, power: -8, baseCost: 250_000 },
  biogasPlant: { group: "power", uses: {}, makes: {}, power: -20, baseCost: 400_000 },
};

/** What a biogas plant burns a second at full speed: the creamery's whey. */
export const BIOGAS_FUEL = 3 * SCALE;
const FUELS: readonly Good[] = ["whey"];
/** Euros a frozen pizza fetches at the docks. */
export const WHOLESALE_PRICE = 12;
/** Research points a second from a laboratory at full speed. */
export const LAB_RESEARCH = 1;
/** A store holds this many seconds of what its producers can make (and never less than MIN_STORE). */
const STORE_SECONDS = 30;
const MIN_STORE = 1000;
const BUILDING_COST_GROWTH = 1.06;
/** Selling a building back brings this share of its price. */
const SELL_SHARE = 0.5;
/** The share of the power a plan gets from the wind, at least: enough to start the by-products that feed the biogas. */
const WIND_SHARE = 0.25;
/** Over how many seconds the rates and trends shown are smoothed. */
const SMOOTHING_SECONDS = 3;

/** The order in which a step runs the buildings: what makes a good comes before what uses it (and the laboratories take
 * their pizzas before the docks ship the rest). */
const RUN_ORDER: readonly BuildingId[] = [
  "wheatFarm", "waterPump", "greenhouse", "oliveGrove", "dairyFarm", "saltWorks",
  "mill", "oilPress", "kneader", "cannery", "creamery", "pizzaFactory", "researchLab", "shippingDock",
];

export interface PlantState {
  buildings: Record<BuildingId, number>;
  stocks: Record<Good, number>;
  /** What each kind of building really did a second, smoothed (its share of full speed, times its count). */
  factoryRates: Record<BuildingId, number>;
  stockTrends: Record<Good, number>;
  researched: ResearchId[];
}

const zeros = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
export const noBuildings = (): Record<BuildingId, number> => zeros(BUILDING_IDS);
export const noStocks = (): Record<Good, number> => zeros(GOODS);

// --- What the research brings -----------------------------------------------------------------------------------------

/** How much faster than its base a building works. */
export const speedOf = (state: PlantState, id: BuildingId): number => {
  const done = (research: ResearchId) => isResearched(state.researched, research);
  const group = BUILDINGS[id].group;
  let speed = (done("conveyorBelts") ? 1.5 : 1) * (done("modernised") ? 2 : 1) * (done("futuristic") ? 2 : 1);
  if (group === "raw" && done("fertilizer")) speed *= 2;
  if (id === "pizzaFactory" && done("robotArms")) speed *= 2;
  if (id === "shippingDock" && done("automatedDocks")) speed *= 2;
  if (group === "power" && done("efficientTurbines")) speed *= 2;
  return speed;
};

/** Modernised workshops and those of the future do more, and draw more power for it. */
const powerFactor = (state: PlantState): number =>
  (isResearched(state.researched, "modernised") ? 1.5 : 1) * (isResearched(state.researched, "futuristic") ? 1.5 : 1);

export const buildingCost = (state: PlantState, id: BuildingId): number => BUILDINGS[id].baseCost * BUILDING_COST_GROWTH ** state.buildings[id];

/** What selling one back brings: part of what the last one cost. */
export const sellValue = (state: PlantState, id: BuildingId): number =>
  state.buildings[id] < 1 ? 0 : SELL_SHARE * BUILDINGS[id].baseCost * BUILDING_COST_GROWTH ** (state.buildings[id] - 1);

/** What all the buildings of a kind make a second at full speed. */
export const capacityOf = (state: PlantState, id: BuildingId, good: Good): number =>
  state.buildings[id] * speedOf(state, id) * (BUILDINGS[id].makes[good] ?? 0);

/** What a store holds at most: half a minute of what fills it. */
export const storeCap = (state: PlantState, good: Good): number =>
  Math.max(MIN_STORE, STORE_SECONDS * BUILDING_IDS.reduce((sum, id) => sum + capacityOf(state, id, good), 0));

export const powerDemand = (state: PlantState): number =>
  BUILDING_IDS.reduce((sum, id) => sum + (BUILDINGS[id].power > 0 ? state.buildings[id] * BUILDINGS[id].power * powerFactor(state) : 0), 0);

/** How fast some buildings work for a while (an incident: a strike, a breakdown, the weather), against their usual speed. */
export type Speeds = Partial<Record<BuildingId, number>>;

const windPower = (state: PlantState, speeds: Speeds): number =>
  state.buildings.windTurbine * -BUILDINGS.windTurbine.power * speedOf(state, "windTurbine") * (speeds.windTurbine ?? 1);

// --- A step of time --------------------------------------------------------------------------------------------------

export interface PlantStep {
  state: PlantState;
  shipped: number;
  research: number;
  /** Kits (a dough, a sauce and a mozzarella each) taken for the restaurants. */
  kits: number;
  /** Power made and needed, this step (MW). */
  power: { supply: number; demand: number };
}

const smooth = (current: number, value: number, dt: number): number => current + (value - current) * Math.min(1, dt / SMOOTHING_SECONDS);

/** One step of the plant. `kitsWanted`: kits the restaurants would take, served before the pizza factories. */
export const runPlant = (state: PlantState, dt: number, kitsWanted = 0, speeds: Speeds = {}): PlantStep => {
  const stocks = { ...state.stocks };
  const done = noBuildings();
  // Power first: the wind, and the biogas plants burning what by-products there are.
  const burnable = FUELS.reduce((sum, good) => sum + stocks[good], 0);
  const biogasSpeed = speedOf(state, "biogasPlant") * (speeds.biogasPlant ?? 1);
  const burnt = Math.min(state.buildings.biogasPlant * biogasSpeed * BIOGAS_FUEL * dt, burnable);
  let toBurn = burnt;
  for (const good of FUELS) {
    const used = Math.min(stocks[good], toBurn);
    stocks[good] -= used;
    toBurn -= used;
  }
  done.biogasPlant = burnt / (BIOGAS_FUEL * dt);
  const supply = windPower(state, speeds) + done.biogasPlant * -BUILDINGS.biogasPlant.power;
  done.windTurbine = state.buildings.windTurbine * speedOf(state, "windTurbine") * (speeds.windTurbine ?? 1);
  const demand = powerDemand(state);
  const powered = demand > 0 ? Math.min(1, supply / demand) : 1;

  // Then every building in turn, as far as its inputs, the room in its output stores and the power allow.
  let shipped = 0;
  let research = 0;
  let kits = 0;
  for (const id of RUN_ORDER) {
    // The restaurants' kits come first: their pizzas sell dearer than the frozen ones.
    if (id === "pizzaFactory") {
      kits = Math.max(0, Math.min(kitsWanted, stocks.dough, stocks.sauce, stocks.cheese));
      stocks.dough -= kits;
      stocks.sauce -= kits;
      stocks.cheese -= kits;
    }
    const spec = BUILDINGS[id];
    let activity = state.buildings[id] * speedOf(state, id) * (speeds[id] ?? 1) * powered * dt;
    for (const [good, amount] of Object.entries(spec.uses) as [Good, number][]) activity = Math.min(activity, stocks[good] / amount);
    for (const [good, amount] of Object.entries(spec.makes) as [Good, number][]) activity = Math.min(activity, (storeCap(state, good) - stocks[good]) / amount);
    activity = Math.max(0, activity);
    // Never below nothing (sums of fractions can leave a hair under zero).
    for (const [good, amount] of Object.entries(spec.uses) as [Good, number][]) stocks[good] = Math.max(0, stocks[good] - activity * amount);
    for (const [good, amount] of Object.entries(spec.makes) as [Good, number][]) stocks[good] += activity * amount;
    if (id === "shippingDock") shipped = activity * (spec.uses.frozen ?? 0);
    if (id === "researchLab") research = activity * LAB_RESEARCH;
    done[id] = activity / dt;
  }

  const factoryRates = Object.fromEntries(BUILDING_IDS.map((id) => [id, smooth(state.factoryRates[id], done[id], dt)])) as Record<BuildingId, number>;
  const stockTrends = Object.fromEntries(GOODS.map((good) => [good, smooth(state.stockTrends[good], (stocks[good] - state.stocks[good]) / dt, dt)])) as Record<Good, number>;
  return { state: { ...state, stocks, factoryRates, stockTrends }, shipped, research, kits, power: { supply, demand } };
};

// --- How each building is doing ----------------------------------------------------------------------------------------

/** Why a building runs below full speed, if it does: no power, short of an input, or its output store full. */
export type BuildingStatus =
  | { kind: "none" }
  | { kind: "running" }
  | { kind: "unpowered" }
  | { kind: "starved"; good: Good }
  | { kind: "blocked"; good: Good };

/** How fast a kind of building runs, from 0 to 1, smoothed. */
export const usageOf = (state: PlantState, id: BuildingId): number => {
  const full = state.buildings[id] * speedOf(state, id);
  return full > 0 ? Math.min(1, state.factoryRates[id] / full) : 0;
};

/** What the power plants make now, against what the plant needs (MW). */
export const powerBalance = (state: PlantState, speeds: Speeds = {}): { supply: number; demand: number } => ({
  supply: windPower(state, speeds) + state.factoryRates.biogasPlant * -BUILDINGS.biogasPlant.power,
  demand: powerDemand(state),
});

export const buildingStatus = (state: PlantState, id: BuildingId, speeds: Speeds = {}): BuildingStatus => {
  if (state.buildings[id] <= 0) return { kind: "none" };
  if (usageOf(state, id) >= 0.97) return { kind: "running" };
  if (id === "biogasPlant") return { kind: "starved", good: "whey" };
  const spec = BUILDINGS[id];
  // The scarcest input, against what one second at full speed needs.
  const inputs = (Object.entries(spec.uses) as [Good, number][]).map(([good, amount]) => ({ good, cover: state.stocks[good] / amount }));
  const scarcest = inputs.sort((a, b) => a.cover - b.cover)[0];
  const fullOutput = (Object.keys(spec.makes) as Good[]).find((good) => state.stocks[good] >= storeCap(state, good) * 0.99);
  if (fullOutput) return { kind: "blocked", good: fullOutput };
  // Short of an input only if its store is low and not filling up: a store that rises means the input is there, and
  // something else (the power) holds the building back.
  if (scarcest && scarcest.cover < 1 && state.stockTrends[scarcest.good] <= 0.5) return { kind: "starved", good: scarcest.good };
  const { supply, demand } = powerBalance(state, speeds);
  if (spec.power > 0 && supply < demand) return { kind: "unpowered" };
  return scarcest ? { kind: "starved", good: scarcest.good } : { kind: "running" };
};

// --- Planning: what a balanced plant needs --------------------------------------------------------------------------

/** The single kind of building that makes each good (by-products apart). */
const MAKER: Partial<Record<Good, BuildingId>> = {
  wheat: "wheatFarm", water: "waterPump", tomato: "greenhouse", olive: "oliveGrove", milk: "dairyFarm", salt: "saltWorks",
  flour: "mill", dough: "kneader", oil: "oilPress", sauce: "cannery", cheese: "creamery", frozen: "pizzaFactory",
};

/** How many of each building (fractions) run a plant whose factories make `pizzas` a second, with docks to ship them
 * all, and power for everything: biogas from the by-products, the wind for the rest. */
export const planFor = (state: PlantState, pizzas: number): Record<BuildingId, number> => {
  const plan = noBuildings();
  const need = noStocks();
  need.frozen = pizzas;
  // Work back from the pizzas: each good's maker, then what that maker uses (makers come after their inputs' makers
  // in the run order, so going through it backwards meets every good's demand before its maker is sized).
  for (const id of [...RUN_ORDER].reverse()) {
    if (id === "shippingDock" || id === "researchLab") continue;
    const spec = BUILDINGS[id];
    const main = (Object.keys(spec.makes) as Good[]).find((good) => MAKER[good] === id);
    if (!main) continue;
    const perBuilding = (spec.makes[main] ?? 0) * speedOf(state, id);
    plan[id] = need[main] / perBuilding;
    for (const [good, amount] of Object.entries(spec.uses) as [Good, number][]) need[good] += plan[id] * speedOf(state, id) * amount;
  }
  plan.shippingDock = pizzas / ((BUILDINGS.shippingDock.uses.frozen ?? 1) * speedOf(state, "shippingDock"));
  // Power: what the plan's buildings need; the by-products it makes, burnt; the wind for what is missing.
  const demand = BUILDING_IDS.reduce((sum, id) => sum + (BUILDINGS[id].power > 0 ? plan[id] * BUILDINGS[id].power * powerFactor(state) : 0), 0);
  const fuel = FUELS.reduce((sum, good) => sum + BUILDING_IDS.reduce((total, id) => total + plan[id] * speedOf(state, id) * (BUILDINGS[id].makes[good] ?? 0), 0), 0);
  const biogasEach = BIOGAS_FUEL * speedOf(state, "biogasPlant");
  plan.biogasPlant = fuel / biogasEach;
  const biogasPower = plan.biogasPlant * speedOf(state, "biogasPlant") * -BUILDINGS.biogasPlant.power;
  // Biogas needs by-products, which need power to be made: some wind, a quarter of the need at least, starts it all.
  plan.windTurbine = Math.max(demand * WIND_SHARE, demand - biogasPower) / (-BUILDINGS.windTurbine.power * speedOf(state, "windTurbine"));
  return plan;
};

/** Frozen pizzas a second the factories make at full speed. */
export const factoryCapacity = (state: PlantState): number => capacityOf(state, "pizzaFactory", "frozen");

export interface Module {
  /** Buildings to add, and how many of each. */
  builds: Partial<Record<BuildingId, number>>;
  cost: number;
}

/** A module: everything it takes, on top of what stands, for one more pizza factory running flat out (or, with none, for
 * the first). Built in one go, once researched; the foreman builds them on their own. */
export const nextModule = (state: PlantState): Module => {
  const perFactory = (BUILDINGS.pizzaFactory.makes.frozen ?? 0) * speedOf(state, "pizzaFactory");
  const target = planFor(state, (state.buildings.pizzaFactory + 1) * perFactory);
  const builds: Partial<Record<BuildingId, number>> = {};
  let cost = 0;
  for (const id of BUILDING_IDS) {
    if (id === "researchLab") continue;
    const missing = Math.max(0, Math.ceil(target[id] - 1e-9) - state.buildings[id]);
    if (!missing) continue;
    builds[id] = missing;
    for (let i = 0; i < missing; i++) cost += BUILDINGS[id].baseCost * BUILDING_COST_GROWTH ** (state.buildings[id] + i);
  }
  return { builds, cost };
};
