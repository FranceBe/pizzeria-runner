// Forno Infinito, the factory mode: the rules only (no React), so they can be tested and balanced by robots.
//
// Pizzas are made from ingredient kits (one kit a pizza), by hand at first, then by cooks. Customers buy them as fast
// as the price lets them: the lower the price, the more they want. The player's job is to keep production, demand and
// supplies in balance, then to automate it all and grow, from one counter to a chain of restaurants across a continent,
// city by city, then to factories: production lines from the fields to the pizza, whose ratios have to be balanced;
// then to the universe (see cosmos.ts), and the stellar oven that ends the game. All along, a story told in chapters
// (story.ts), achievements (achievements.ts) and special orders (orders.ts).
//
// Every action returns a new state and leaves the one it is given untouched.

import {
  BUILDING_IDS, BUILDINGS, buildingCost, GOODS, nextModule, noBuildings, noStocks, runPlant, sellValue, storeCap, WHOLESALE_PRICE, type BuildingId, type Good,
} from "./plant";
import { ACHIEVEMENT_IDS, newAchievements, salesBonus, type AchievementId } from "./achievements";
import {
  buildOvensAsNeeded, buildStage, equipRoutes, growShortFarms, newCosmos, PLANET_IDS, PLANETS, readCosmos, runCosmos, STAGES, type CosmosState, type PlanetId,
} from "./cosmos";
import {
  endIncident, FIRST_INCIDENT, fixCost, incidentSpeeds, INCIDENT_KINDS, priceFactor, readIncident, stepIncidents, type Incident, type IncidentKind,
} from "./incidents";
import { FIRST_ORDER, makeOrder, ORDER_GAP, ORDER_KINDS, ORDERS_FROM_SALES, readOrder, stepOrder, type Order, type OrderKind } from "./orders";
import { isResearchOpen, isResearchShown, RESEARCH, RESEARCH_IDS, type ResearchId } from "./research";
import { CHAPTER_IDS, firstChapterOf, isChapterDone, type ChapterId } from "./story";

export type Era = 1 | 2 | 3 | 4;

export const UPGRADE_IDS = [
  // Era 1: the counter
  "doubleHands", "pizzaPeel", "woodOven", "supplier", "nonnaRecipe", "bikeDelivery", "bigMixer", "neonSign", "secondShift", "franchise",
  // Era 2: the chain
  "manager", "centralKitchen", "pricingAnalyst", "expansionDirector", "conveyorOven", "tvAd", "adAgency", "pizzaAcademy", "deliveryFleet",
  "factoryPlans",
  // Era 3: the factories (their own upgrades come from research, see research.ts); the rocket plans open era 4
  "spacePlans",
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const MESSAGE_KEYS = [
  "welcome", "firstSale", "sold100", "outOfKits", "firstCook", "kitchenFull", "sold1000", "franchiseOpen",
  "city", "country", "continent", "sold1m", "upgradeBought", "factoriesOpen", "firstFactoryPizza", "factory10k", "sold100m",
  "researchDone", "sold1b", "incident", "universeOpen", "planetFound", "firstCosmicSale", "stellarStage", "ending",
  "cityOpen", "chapter", "achievement", "orderDone",
] as const;
export type MessageKey = (typeof MESSAGE_KEYS)[number];

export interface LogEntry {
  id: number;
  key: MessageKey;
  upgrade?: UpgradeId;
  research?: ResearchId;
  /** An incident that started (see incidents.ts), and the kind of building it hit. */
  incident?: IncidentKind;
  building?: BuildingId;
  /** A planet found, a stage of the stellar oven built. */
  planet?: PlanetId;
  stage?: number;
  /** A city opened (its index in CITIES), a chapter of the story done, an achievement unlocked, an order delivered. */
  city?: number;
  chapter?: ChapterId;
  achievement?: AchievementId;
  order?: OrderKind;
}

export interface FactoryState {
  version: 1;
  era: Era;
  money: number;
  /** Pizzas made and not yet sold (they keep: this is a game). */
  pizzas: number;
  /** One kit makes one pizza. */
  kits: number;
  price: number;
  /** What a crate of kits costs today; it moves a little every few seconds. */
  cratePrice: number;
  cooks: number;
  restaurants: number;
  /** Cities the chain has settled in (see CITIES): each holds so many restaurants. */
  cities: number;
  marketing: number;
  upgrades: UpgradeId[];
  /** The supplier, the manager and the analyst, once hired, can be told to stop; so can the expansion director (new
   * restaurants and cities) and the ad agency. */
  autoBuy: boolean;
  autoHire: boolean;
  autoPrice: boolean;
  autoExpand: boolean;
  autoAds: boolean;
  /** Era 3 (see plant.ts): how many of each building, what the stores between them hold, what each kind really did a
   * second and how each store moves (smoothed), the research points and what they paid for. */
  buildings: Record<BuildingId, number>;
  stocks: Record<Good, number>;
  factoryRates: Record<BuildingId, number>;
  stockTrends: Record<Good, number>;
  research: number;
  researched: ResearchId[];
  /** The foreman builds modules on their own; the restaurants take their kits from the factories' stores first (the
   * player's choice: off at first). */
  autoBuild: boolean;
  autoKits: boolean;
  /** Kits a second the restaurants take from the factories' stores, smoothed. */
  kitsFromPlant: number;
  /** Era 3's incidents (see incidents.ts): the one going on, the seconds until the next, and whether there are any. */
  incident: Incident | null;
  incidentClock: number;
  incidentsOn: boolean;
  /** The maintenance crew settles strikes and breakdowns on its own (research). */
  autoRepair: boolean;
  /** Era 4: the universe (see cosmos.ts), and its automations (research): the logistician equips the routes, the
   * stewards build ovens, the agronomist grows the farms. */
  cosmos: CosmosState;
  autoShips: boolean;
  autoOvens: boolean;
  autoFarms: boolean;
  /** The story (story.ts): the chapter going on. Achievements unlocked (achievements.ts). */
  chapter: number;
  achievements: AchievementId[];
  /** Special orders (orders.ts): the one going on, the seconds until the next, how many were delivered. */
  order: Order | null;
  orderClock: number;
  ordersDone: number;
  /** Pizzas made by hand, and strikes and breakdowns settled: for the achievements. */
  handMade: number;
  incidentsFixed: number;
  /** The rush: seconds it still lasts, and seconds before the next can start. */
  rushLeft: number;
  rushReady: number;
  totalMade: number;
  totalSold: number;
  totalEarned: number;
  cratesBought: number;
  seconds: number;
  /** Seconds until the crate price moves again. */
  marketClock: number;
  milestones: MessageKey[];
  log: LogEntry[];
  nextLogId: number;
}

// The numbers the game is balanced on (see engine.test.ts, where robots play it through).
export const RULES = {
  startMoney: 20,
  startKits: 30,
  startPrice: 5,
  refPrice: 5,
  minPrice: 0.5,
  maxPrice: 500,
  /** Customers a second, per restaurant, at the reference price. */
  demandPerRestaurant: 2,
  /** How much a price above the reference puts customers off. */
  priceElasticity: 2,
  cookRate: 0.4,
  cookBaseCost: 15,
  cookCostGrowth: 1.13,
  cooksPerRestaurant: 5,
  crateSize: 50,
  crateBasePrice: 15,
  crateMinPrice: 8,
  crateMaxPrice: 25,
  marketEvery: 3,
  marketingBaseCost: 60,
  marketingGrowth: 2.2,
  marketingBoost: 1.4,
  restaurantBaseCost: 2500,
  restaurantGrowth: 1.07,
  /** Each city settled beyond the first brings this many more customers. */
  cityBoost: 0.05,
  logKept: 40,
  offlineCap: 8 * 3600,
};

interface UpgradeSpec {
  era: Era;
  cost: number;
  /** When it shows up in the shop. */
  shows: (state: FactoryState) => boolean;
  /** Not for sale yet (the next era is still being built). */
  comingSoon?: boolean;
}

export const UPGRADES: Record<UpgradeId, UpgradeSpec> = {
  doubleHands: { era: 1, cost: 40, shows: (s) => s.totalMade >= 15 },
  pizzaPeel: { era: 1, cost: 600, shows: (s) => s.handMade >= 150 },
  bikeDelivery: { era: 1, cost: 3_500, shows: (s) => s.totalSold >= 1_000 },
  neonSign: { era: 1, cost: 6_000, shows: (s) => s.totalSold >= 1_800 },
  woodOven: { era: 1, cost: 250, shows: (s) => s.cooks >= 2 },
  supplier: { era: 1, cost: 300, shows: (s) => s.cratesBought >= 3 },
  nonnaRecipe: { era: 1, cost: 900, shows: (s) => s.totalSold >= 400 },
  bigMixer: { era: 1, cost: 1500, shows: (s) => s.cooks >= 5 },
  secondShift: { era: 1, cost: 2500, shows: (s) => s.cooks >= cookCapacity(s) - 1 },
  franchise: { era: 1, cost: 20_000, shows: (s) => s.totalSold >= 5_000 },
  manager: { era: 2, cost: 5000, shows: (s) => s.era >= 2 },
  pricingAnalyst: { era: 2, cost: 40_000, shows: (s) => s.era >= 2 && s.restaurants >= 4 },
  expansionDirector: { era: 2, cost: 250_000, shows: (s) => s.era >= 2 && s.cities >= 3 },
  adAgency: { era: 2, cost: 1_500_000, shows: (s) => s.era >= 2 && s.marketing >= 8 },
  centralKitchen: { era: 2, cost: 25_000, shows: (s) => s.era >= 2 && s.restaurants >= 3 },
  conveyorOven: { era: 2, cost: 80_000, shows: (s) => s.era >= 2 && s.restaurants >= 5 },
  tvAd: { era: 2, cost: 200_000, shows: (s) => s.era >= 2 && s.restaurants >= 8 },
  pizzaAcademy: { era: 2, cost: 500_000, shows: (s) => s.era >= 2 && s.restaurants >= 12 },
  deliveryFleet: { era: 2, cost: 1_500_000, shows: (s) => s.era >= 2 && s.restaurants >= 18 },
  factoryPlans: { era: 2, cost: 100_000_000, shows: (s) => s.era >= 2 && s.cities >= 7 && s.totalSold >= 2e7 },
  spacePlans: { era: 3, cost: 5e9, shows: (s) => s.era >= 3 && s.totalSold >= SPACE_PLANS_SALES },
};

/** The foreman builds a module once the till holds this many times its cost (more in the universe). */
const FOREMAN_SPARE = 1.5;
const FOREMAN_SPARE_UNIVERSE = 10;

/** Pizzas sold before the rocket plans show up. */
export const SPACE_PLANS_SALES = 1.2e9;

const has = (state: FactoryState, id: UpgradeId): boolean => state.upgrades.includes(id);

// --- What the state is worth, second by second ----------------------------------------------------------------------

export const clickPower = (state: FactoryState): number => (has(state, "doubleHands") ? 2 : 1);

/** A click also lends the kitchen a hand: this share of a second of its work (more with the peel). */
export const clickShare = (state: FactoryState): number => (has(state, "pizzaPeel") ? 0.6 : 0.25);

/** Pizzas a click makes (kits allowing). */
export const clickPizzas = (state: FactoryState): number => clickPower(state) + clickShare(state) * productionRate(state);

// --- The rush: for those who stay, everything runs twice as fast for a while, now and then ----------------------------

export const RUSH = { seconds: 30, cooldown: 180, boost: 2 } as const;

/** How much faster everything runs now. */
export const rushBoost = (state: Pick<FactoryState, "rushLeft">): number => (state.rushLeft > 0 ? RUSH.boost : 1);

/** Whether the rush can start: once there is a kitchen crew, and the last one is long enough ago. */
export const canRush = (state: FactoryState): boolean => state.cooks >= 1 && state.rushLeft <= 0 && state.rushReady <= 0;

export const startRush = (state: FactoryState): FactoryState | null =>
  canRush(state) ? { ...state, rushLeft: RUSH.seconds, rushReady: RUSH.cooldown + RUSH.seconds } : null;

const cookMultiplier = (state: FactoryState): number =>
  (has(state, "woodOven") ? 1.5 : 1) * (has(state, "bigMixer") ? 2 : 1) * (has(state, "conveyorOven") ? 3 : 1);

export const cookCapacity = (state: FactoryState): number =>
  state.restaurants * (RULES.cooksPerRestaurant + (has(state, "secondShift") ? 5 : 0) + (has(state, "pizzaAcademy") ? 10 : 0));

/** Pizzas the cooks would make in a second, with kits enough. */
export const productionRate = (state: FactoryState): number => state.cooks * RULES.cookRate * cookMultiplier(state) * rushBoost(state);

/** Pizzas the restaurants make a second (the factories' are frozen, and shipped). */
export const supplyRate = (state: FactoryState): number => productionRate(state);

/** Era 3, smoothed: frozen pizzas a second out of the factories, and shipped from the docks. */
export const frozenRate = (state: FactoryState): number => state.factoryRates.pizzaFactory * (BUILDINGS.pizzaFactory.makes.frozen ?? 0);
export const shippedRate = (state: FactoryState): number => state.factoryRates.shippingDock * (BUILDINGS.shippingDock.uses.frozen ?? 0);

const demandMultiplier = (state: FactoryState): number =>
  RULES.marketingBoost ** state.marketing *
  (1 + RULES.cityBoost * (state.cities - 1)) *
  (has(state, "nonnaRecipe") ? 1.5 : 1) *
  (has(state, "bikeDelivery") ? 1.3 : 1) *
  (has(state, "neonSign") ? 1.25 : 1) *
  rushBoost(state) *
  (has(state, "tvAd") ? 2 : 1) *
  (has(state, "deliveryFleet") ? 2 : 1);

/** Customers a second at this price. */
export const demandRate = (state: FactoryState, price = state.price): number =>
  RULES.demandPerRestaurant * state.restaurants * demandMultiplier(state) * (RULES.refPrice / price) ** RULES.priceElasticity;

export const crateSize = (state: FactoryState): number => (has(state, "centralKitchen") ? RULES.crateSize * 10 : RULES.crateSize);
export const crateCost = (state: FactoryState): number => (has(state, "centralKitchen") ? state.cratePrice * 6 : state.cratePrice);

// A cook costs more as each kitchen fills up, and a little more with every restaurant: a new restaurant brings
// cheaper hires back, which is what makes the chain grow.
export const cookCost = (state: FactoryState): number =>
  RULES.cookBaseCost * RULES.cookCostGrowth ** (state.cooks / state.restaurants) * state.restaurants;
export const marketingCost = (state: FactoryState): number => RULES.marketingBaseCost * RULES.marketingGrowth ** state.marketing;
export const restaurantCost = (state: FactoryState): number => RULES.restaurantBaseCost * RULES.restaurantGrowth ** (state.restaurants - 1);

// --- The cities: the chain grows city by city, each one holding so many restaurants --------------------------------

export const CITIES: readonly { capacity: number; cost: number }[] = [
  { capacity: 6, cost: 0 },
  { capacity: 10, cost: 40_000 },
  { capacity: 14, cost: 200_000 },
  { capacity: 18, cost: 800_000 },
  { capacity: 24, cost: 3_000_000 },
  { capacity: 30, cost: 10_000_000 },
  { capacity: 36, cost: 40_000_000 },
  { capacity: 48, cost: 150_000_000 },
  { capacity: 60, cost: 500_000_000 },
];

/** How many restaurants the cities settled hold. */
export const cityCapacity = (state: Pick<FactoryState, "cities">): number =>
  CITIES.slice(0, state.cities).reduce((sum, city) => sum + city.capacity, 0);

/** The fewest cities that hold this many restaurants (for saves from before the cities). */
export const citiesFor = (restaurants: number): number => {
  let cities = 1;
  while (cities < CITIES.length && cityCapacity({ cities }) < restaurants) cities++;
  return cities;
};

/** The next city's cost, if one is left. */
export const nextCityCost = (state: Pick<FactoryState, "cities">): number | null => CITIES[state.cities]?.cost ?? null;

// --- Starting, and the log ------------------------------------------------------------------------------------------

export const newFactory = (): FactoryState => {
  const state: FactoryState = {
    version: 1,
    era: 1,
    money: RULES.startMoney,
    pizzas: 0,
    kits: RULES.startKits,
    price: RULES.startPrice,
    cratePrice: RULES.crateBasePrice,
    cooks: 0,
    restaurants: 1,
    marketing: 0,
    upgrades: [],
    cities: 1,
    autoBuy: false,
    autoHire: false,
    autoPrice: false,
    autoExpand: false,
    autoAds: false,
    buildings: noBuildings(),
    stocks: noStocks(),
    factoryRates: noBuildings(),
    stockTrends: noStocks(),
    research: 0,
    researched: [],
    autoBuild: false,
    autoKits: false,
    kitsFromPlant: 0,
    incident: null,
    incidentClock: FIRST_INCIDENT,
    incidentsOn: true,
    autoRepair: false,
    cosmos: newCosmos(),
    autoShips: false,
    autoOvens: false,
    autoFarms: false,
    chapter: 0,
    achievements: [],
    order: null,
    orderClock: FIRST_ORDER,
    ordersDone: 0,
    handMade: 0,
    incidentsFixed: 0,
    rushLeft: 0,
    rushReady: 0,
    totalMade: 0,
    totalSold: 0,
    totalEarned: 0,
    cratesBought: 0,
    seconds: 0,
    marketClock: RULES.marketEvery,
    milestones: [],
    log: [],
    nextLogId: 1,
  };
  return reach(state, "welcome");
};

const copy = (state: FactoryState): FactoryState => ({ ...state, upgrades: [...state.upgrades], milestones: [...state.milestones], log: [...state.log] });

const say = (state: FactoryState, entry: Omit<LogEntry, "id">): FactoryState => {
  const log = [...state.log, { ...entry, id: state.nextLogId }].slice(-RULES.logKept);
  return { ...state, log, nextLogId: state.nextLogId + 1 };
};

// A milestone is told once, the first time it is reached.
const reach = (state: FactoryState, key: MessageKey): FactoryState =>
  state.milestones.includes(key) ? state : say({ ...state, milestones: [...state.milestones, key] }, { key });

// --- The player's actions -------------------------------------------------------------------------------------------

export const makePizza = (state: FactoryState): FactoryState => {
  const made = Math.min(clickPizzas(state), state.kits);
  if (made < 1) return reach(state, "outOfKits");
  return { ...state, kits: state.kits - made, pizzas: state.pizzas + made, totalMade: state.totalMade + made, handMade: state.handMade + made };
};

// The price goes up and down in steps that suit it: 10 cents under 2 €, then 50 cents, then whole euros, and so on.
const priceStep = (price: number): number => (price < 2 ? 0.1 : price < 20 ? 0.5 : 10 ** Math.floor(Math.log10(price)) / 2);

export const changePrice = (state: FactoryState, direction: 1 | -1): FactoryState => {
  const step = priceStep(direction > 0 ? state.price : state.price - priceStep(state.price) / 2);
  const price = Math.round((state.price + direction * step) * 100) / 100;
  return { ...state, price: Math.min(RULES.maxPrice, Math.max(RULES.minPrice, price)) };
};

export const buyCrate = (state: FactoryState): FactoryState | null => {
  const cost = crateCost(state);
  if (state.money < cost) return null;
  return { ...state, money: state.money - cost, kits: state.kits + crateSize(state), cratesBought: state.cratesBought + 1 };
};

export const hireCook = (state: FactoryState): FactoryState | null => {
  const cost = cookCost(state);
  if (state.money < cost || state.cooks >= cookCapacity(state)) return null;
  const next = { ...state, money: state.money - cost, cooks: state.cooks + 1 };
  const hired = next.cooks === 1 ? reach(next, "firstCook") : next;
  return hired.cooks >= cookCapacity(hired) ? reach(hired, "kitchenFull") : hired;
};

export const buyMarketing = (state: FactoryState): FactoryState | null => {
  const cost = marketingCost(state);
  if (state.money < cost) return null;
  return { ...state, money: state.money - cost, marketing: state.marketing + 1 };
};

const REGIONS: readonly [number, MessageKey][] = [[10, "city"], [40, "country"], [150, "continent"]];

export const openRestaurant = (state: FactoryState): FactoryState | null => {
  const cost = restaurantCost(state);
  if (state.era < 2 || state.money < cost || state.restaurants >= cityCapacity(state)) return null;
  let next: FactoryState = { ...state, money: state.money - cost, restaurants: state.restaurants + 1 };
  for (const [count, key] of REGIONS) if (next.restaurants >= count) next = reach(next, key);
  return next;
};

/** The chain settles in the next city: room for more restaurants, and more customers everywhere. */
export const openCity = (state: FactoryState): FactoryState | null => {
  const cost = nextCityCost(state);
  if (state.era < 2 || cost === null || state.money < cost) return null;
  return say({ ...state, money: state.money - cost, cities: state.cities + 1 }, { key: "cityOpen", city: state.cities });
};

export const isForSale = (state: FactoryState, id: UpgradeId): boolean =>
  !has(state, id) && UPGRADES[id].era <= state.era && UPGRADES[id].shows(state);

export const buyUpgrade = (state: FactoryState, id: UpgradeId): FactoryState | null => {
  const spec = UPGRADES[id];
  if (!isForSale(state, id) || spec.comingSoon || state.money < spec.cost) return null;
  let next: FactoryState = copy(state);
  next.money -= spec.cost;
  next.upgrades.push(id);
  if (id === "supplier") next.autoBuy = true;
  if (id === "manager") next.autoHire = true;
  if (id === "pricingAnalyst") next.autoPrice = true;
  if (id === "expansionDirector") next.autoExpand = true;
  if (id === "adAgency") next.autoAds = true;
  next = say(next, { key: "upgradeBought", upgrade: id });
  if (id === "franchise") next = reach({ ...next, era: 2 }, "franchiseOpen");
  if (id === "factoryPlans") next = reach({ ...next, era: 3 }, "factoriesOpen");
  if (id === "spacePlans") next = reach({ ...next, era: 4 }, "universeOpen");
  return next;
};

export type Automation =
  | "autoBuy" | "autoHire" | "autoPrice" | "autoExpand" | "autoAds" | "autoBuild" | "autoKits" | "autoRepair" | "autoShips" | "autoOvens" | "autoFarms";
export const AUTOMATIONS: readonly Automation[] = [
  "autoBuy", "autoHire", "autoPrice", "autoExpand", "autoAds", "autoKits", "autoBuild", "autoRepair", "autoShips", "autoOvens", "autoFarms",
];

/** What makes an automation available: an upgrade, a research, or era 3 itself (the kits from the factories). */
export type AutomationOwner = { upgrade: UpgradeId } | { research: ResearchId } | { era: Era };
export const AUTOMATION_OWNERS: Record<Automation, AutomationOwner> = {
  autoBuy: { upgrade: "supplier" },
  autoHire: { upgrade: "manager" },
  autoPrice: { upgrade: "pricingAnalyst" },
  autoExpand: { upgrade: "expansionDirector" },
  autoAds: { upgrade: "adAgency" },
  autoKits: { era: 3 },
  autoBuild: { research: "foreman" },
  autoRepair: { research: "maintenanceCrew" },
  autoShips: { research: "logistics" },
  autoOvens: { research: "orbitalStewards" },
  autoFarms: { research: "agronomy" },
};

export const hasAutomation = (state: FactoryState, which: Automation): boolean => {
  const owner = AUTOMATION_OWNERS[which];
  if ("upgrade" in owner) return has(state, owner.upgrade);
  if ("research" in owner) return state.researched.includes(owner.research);
  return state.era >= owner.era;
};

export const toggleAutomation = (state: FactoryState, which: Automation): FactoryState =>
  hasAutomation(state, which) ? { ...state, [which]: !state[which] } : state;

// --- Era 3: building, and research --------------------------------------------------------------------------------------

export const build = (state: FactoryState, id: BuildingId): FactoryState | null => {
  const cost = buildingCost(state, id);
  if (state.era < 3 || state.money < cost) return null;
  return { ...state, money: state.money - cost, buildings: { ...state.buildings, [id]: state.buildings[id] + 1 } };
};

/** One building sold back, for part of its price: to slow a step down, and free the power it drew. */
export const sell = (state: FactoryState, id: BuildingId): FactoryState | null => {
  if (state.era < 3 || state.buildings[id] < 1) return null;
  return { ...state, money: state.money + sellValue(state, id), buildings: { ...state.buildings, [id]: state.buildings[id] - 1 } };
};

/** What ending the incident of the moment costs now, if it can be ended (a strike, a breakdown). */
export const incidentFixCost = (state: FactoryState): number | null => fixCost(state.incident, shippedRate(state) * WHOLESALE_PRICE);

/** A bonus paid to end a strike, or a repair to end a breakdown. */
export const fixIncident = (state: FactoryState): FactoryState | null => {
  const cost = incidentFixCost(state);
  if (cost === null || state.money < cost) return null;
  return endIncident({ ...state, money: state.money - cost, incidentsFixed: state.incidentsFixed + 1 });
};

/** Incidents on or off: off, the one going on ends too. */
export const toggleIncidents = (state: FactoryState): FactoryState =>
  state.incidentsOn ? { ...state, incidentsOn: false, incident: null } : { ...state, incidentsOn: true };

/** The next stage of the stellar oven (see cosmos.ts), said in the journal; the last one ends the game. */
export const buildStellarStage = (state: FactoryState): FactoryState | null => {
  const built = buildStage(state);
  if (!built) return null;
  const said = say(built, { key: "stellarStage", stage: built.cosmos.stage });
  return built.cosmos.stage === STAGES.length ? reach(said, "ending") : said;
};

/** A whole module at once (see plant.ts): once researched, or by the foreman. */
export const buildModule = (state: FactoryState): FactoryState | null => {
  const { builds, cost } = nextModule(state);
  if (state.era < 3 || state.money < cost || !Object.keys(builds).length) return null;
  const buildings = { ...state.buildings };
  for (const [id, count] of Object.entries(builds) as [BuildingId, number][]) buildings[id] += count;
  return { ...state, money: state.money - cost, buildings };
};

export const doResearch = (state: FactoryState, id: ResearchId): FactoryState | null => {
  if (state.era < 3 || !isResearchShown(state.era, id) || !isResearchOpen(state.researched, id) || state.research < RESEARCH[id].cost) return null;
  const owned = AUTOMATIONS.find((which) => {
    const owner = AUTOMATION_OWNERS[which];
    return "research" in owner && owner.research === id;
  });
  const next = { ...state, research: state.research - RESEARCH[id].cost, researched: [...state.researched, id], ...(owned ? { [owned]: true } : {}) };
  return say({ ...next, autoBuild: id === "foreman" ? true : next.autoBuild }, { key: "researchDone", research: id });
};

/** How many cooks the till and the kitchens allow, up to `wanted`, and what they cost together. */
export const hiringPlan = (state: FactoryState, wanted: number): { count: number; cost: number } => {
  let s = state;
  let cost = 0;
  let count = 0;
  while (count < wanted && s.cooks < cookCapacity(s) && s.money >= cookCost(s)) {
    cost += cookCost(s);
    s = { ...s, money: s.money - cookCost(s), cooks: s.cooks + 1 };
    count++;
  }
  return { count, cost };
};

// Hires as many cooks as asked (or as the till and the kitchens allow, whichever comes first).
export const hireCooks = (state: FactoryState, count: number): FactoryState => {
  let next = state;
  for (let i = 0; i < count; i++) {
    const hired = hireCook(next);
    if (!hired) break;
    next = hired;
  }
  return next;
};

/** The price at which customers take about what is made (a little less, so pizzas never pile up for nothing). */
export const fairPrice = (state: FactoryState, supply = supplyRate(state)): number => {
  const atReference = demandRate(state, RULES.refPrice);
  const price = RULES.refPrice * Math.sqrt(atReference / Math.max(supply * 0.95, 0.01));
  return Math.min(RULES.maxPrice, Math.max(RULES.minPrice, Math.round(price * 10) / 10));
};

// --- Time -----------------------------------------------------------------------------------------------------------

const smoothKits = (current: number, value: number, dt: number): number => current + (value - current) * Math.min(1, dt / 3);

const SOLD_MILESTONES: readonly [number, MessageKey][] = [[1, "firstSale"], [100, "sold100"], [1000, "sold1000"], [1_000_000, "sold1m"], [1e8, "sold100m"], [1e9, "sold1b"]];

/** One step of time (a fraction of a second up to a second): cooks cook, customers buy, the automations do their job.
 * `isLive`: the player is there (no new incident while away). */
export const tick = (state: FactoryState, dt: number, random: () => number = Math.random, isLive = true): FactoryState => {
  let next: FactoryState = {
    ...state,
    seconds: state.seconds + dt,
    rushLeft: Math.max(0, state.rushLeft - dt),
    rushReady: Math.max(0, state.rushReady - dt),
  };
  const bonus = salesBonus(next);

  // The crate price wanders between its bounds.
  next.marketClock -= dt;
  if (next.marketClock <= 0) {
    next.marketClock += RULES.marketEvery;
    const drift = (random() - 0.5) * 3 + (RULES.crateBasePrice - next.cratePrice) * 0.08;
    next.cratePrice = Math.round(Math.min(RULES.crateMaxPrice, Math.max(RULES.crateMinPrice, next.cratePrice + drift)) * 100) / 100;
  }

  // The supplier keeps about twenty seconds of kits in stock (and never spends the last of the till on it).
  if (next.autoBuy && has(next, "supplier")) {
    const wanted = Math.max(productionRate(next) * 20, 10);
    for (let crates = 0; crates < 1000 && next.kits < wanted && next.money >= crateCost(next) * 1.2; crates++) next = buyCrate(next) ?? next;
  }

  // The manager hires as long as there is room in the kitchens and money to spare.
  if (next.autoHire && has(next, "manager")) {
    for (let hires = 0; hires < 1000 && next.cooks < cookCapacity(next) && next.money >= cookCost(next) * 1.5; hires++) next = hireCook(next) ?? next;
  }

  // The foreman builds whole modules, as long as there is money to spare (in the universe, only out of a tenth of the
  // till: the money is for the stars).
  if (next.autoBuild && hasAutomation(next, "autoBuild")) {
    const spare = next.era >= 4 ? FOREMAN_SPARE_UNIVERSE : FOREMAN_SPARE;
    for (let builds = 0; builds < 20 && next.money >= nextModule(next).cost * spare; builds++) next = buildModule(next) ?? next;
  }

  next = runAutomations(next);

  // The analyst sets the price to what customers will take, counting the pizzas waiting to be sold.
  if (next.autoPrice && has(next, "pricingAnalyst")) next = { ...next, price: fairPrice(next, supplyRate(next) + next.pizzas / 30) };

  const made = Math.min(productionRate(next) * dt, next.kits);
  if (made > 0) next = { ...next, kits: next.kits - made, pizzas: next.pizzas + made, totalMade: next.totalMade + made };
  if (next.kits < 1 && productionRate(next) > 0) next = reach(next, "outOfKits");

  let shipped = 0;
  let deliveredTo: Partial<Record<PlanetId, number>> = {};
  // Era 3: the plant runs; the docks ship frozen pizzas at the wholesale price, the laboratories make research.
  if (next.era >= 3) {
    // The restaurants take their kits from the factories' stores first (a dough, a sauce and a mozzarella each).
    const kitsWanted = next.autoKits ? Math.max(0, productionRate(next) * 20 - next.kits) : 0;
    const incidentSpeed = incidentSpeeds(next.incident);
    const speeds = Object.fromEntries(BUILDING_IDS.map((id) => [id, (incidentSpeed[id] ?? 1) * rushBoost(next)]));
    const plant = runPlant(next, dt, kitsWanted, speeds);
    shipped = plant.shipped;
    const earned = plant.shipped * WHOLESALE_PRICE * priceFactor(next.incident) * bonus;
    next = {
      ...next,
      ...plant.state,
      research: next.research + plant.research,
      kits: next.kits + plant.kits,
      kitsFromPlant: smoothKits(next.kitsFromPlant, plant.kits / dt, dt),
      money: next.money + earned,
      totalMade: next.totalMade + plant.shipped,
      totalSold: next.totalSold + plant.shipped,
      totalEarned: next.totalEarned + earned,
    };
    if (next.stocks.frozen > 0 || plant.shipped > 0) next = reach(next, "firstFactoryPizza");
    if (frozenRate(next) >= 10_000) next = reach(next, "factory10k");
    const incidents = stepIncidents(next, dt, random, isLive);
    next = incidents.state;
    if (incidents.started) next = say(next, { key: "incident", incident: incidents.started.kind, building: incidents.started.building });
  }

  // Era 4: the universe turns; cosmic pizzas count among the pizzas sold.
  if (next.era >= 4) {
    const cosmos = runCosmos(next, dt, rushBoost(next));
    deliveredTo = cosmos.deliveredTo;
    next = {
      ...next,
      cosmos: cosmos.cosmos,
      money: next.money + cosmos.earned * bonus,
      totalMade: next.totalMade + cosmos.delivered,
      totalSold: next.totalSold + cosmos.delivered,
      totalEarned: next.totalEarned + cosmos.earned * bonus,
    };
    if (cosmos.found) next = say(next, { key: "planetFound", planet: cosmos.found });
    if (next.cosmos.sold > 0) next = reach(next, "firstCosmicSale");
  }

  const sold = Math.min(demandRate(next) * dt, next.pizzas);
  if (sold > 0) {
    const earned = sold * next.price * bonus;
    next = { ...next, pizzas: next.pizzas - sold, money: next.money + earned, totalSold: next.totalSold + sold, totalEarned: next.totalEarned + earned };
  }
  for (const [count, key] of SOLD_MILESTONES) if (next.totalSold >= count) next = reach(next, key);

  next = runOrders(next, dt, random, isLive, { restaurants: sold, trucks: shipped, civs: deliveredTo });
  return runStory(next);
};

// --- Automations, orders, story and achievements, each step ---------------------------------------------------------

/** The automations of the chain, the plant and the universe (each one switched on, and owned). */
const runAutomations = (state: FactoryState): FactoryState => {
  let next = state;
  const on = (which: Automation) => next[which] && hasAutomation(next, which);
  // The expansion director: a new city once the cities are full, a restaurant while there is room, with money to spare.
  if (on("autoExpand")) {
    for (let opened = 0; opened < 5; opened++) {
      const city = nextCityCost(next);
      const isFull = next.restaurants >= cityCapacity(next);
      const after = isFull
        ? city !== null && next.money >= city * 2 ? openCity(next) : null
        : next.money >= restaurantCost(next) * 2 ? openRestaurant(next) : null;
      if (!after) break;
      next = after;
    }
  }
  // The ad agency: a campaign when the till holds several times its cost.
  if (on("autoAds") && next.money >= marketingCost(next) * 5) next = buyMarketing(next) ?? next;
  // The maintenance crew: strikes and breakdowns settled at once, when the till can spare it.
  const fix = incidentFixCost(next);
  if (on("autoRepair") && fix !== null && next.money >= fix * 3) next = fixIncident(next) ?? next;
  // The universe's: out of a share of the till each.
  if (next.era >= 4) {
    if (on("autoShips")) next = equipRoutes(next, next.money * 0.5);
    if (on("autoOvens")) next = buildOvensAsNeeded(next, next.money * 0.5);
    if (on("autoFarms")) next = growShortFarms(next, next.money * 0.3);
  }
  return next;
};

/** Money made a second at the pace of the moment: the restaurants, the trucks, the civilisations. */
export const incomeRate = (state: FactoryState): number => {
  const restaurants = Math.min(demandRate(state), supplyRate(state)) * state.price;
  const cosmic = PLANET_IDS.reduce((sum, id) => {
    const spec = PLANETS[id];
    return spec.kind === "civ" ? sum + state.cosmos.flows[id] * spec.price : sum;
  }, 0);
  return (restaurants + shippedRate(state) * WHOLESALE_PRICE + cosmic) * salesBonus(state);
};

/** The pace of the moment, for the special orders. */
const paceOf = (state: FactoryState) => ({
  restaurants: { rate: Math.min(demandRate(state), supplyRate(state)), price: state.price * salesBonus(state) },
  trucks: { rate: shippedRate(state), price: WHOLESALE_PRICE * salesBonus(state) },
  civs: PLANET_IDS.filter((id) => PLANETS[id].kind === "civ" && state.cosmos.planets[id].open).map((id) => ({ id, rate: state.cosmos.flows[id] })),
});

const runOrders = (state: FactoryState, dt: number, random: () => number, isLive: boolean, made: Parameters<typeof stepOrder>[2]): FactoryState => {
  if (state.order) {
    const { order, done } = stepOrder(state.order, dt, made);
    if (!done) return { ...state, order };
    const reward = state.order.reward;
    return say({ ...state, order: null, money: state.money + reward, totalEarned: state.totalEarned + reward, ordersDone: state.ordersDone + 1 },
      { key: "orderDone", order: state.order.kind });
  }
  // None while away, nor before the first sales are behind.
  if (!isLive || state.totalSold < ORDERS_FROM_SALES) return state;
  const clock = state.orderClock - dt;
  if (clock > 0) return { ...state, orderClock: clock };
  return { ...state, order: makeOrder(state.era, paceOf(state), random), orderClock: ORDER_GAP.min + random() * (ORDER_GAP.max - ORDER_GAP.min) };
};

/** Turns the special order down. */
export const declineOrder = (state: FactoryState): FactoryState => ({ ...state, order: null });

/** The least a chapter pays, in each era (beyond that, a minute of what the game brings in). */
const CHAPTER_REWARD: Record<Era, number> = { 1: 40, 2: 5_000, 3: 2_000_000, 4: 2e9 };
const CHAPTER_REWARD_SECONDS = 30;

export const chapterReward = (state: FactoryState): number =>
  Math.max(CHAPTER_REWARD[state.era], incomeRate(state) * CHAPTER_REWARD_SECONDS);

// A chapter reached pays its reward and opens the next; achievements reached are unlocked, said in the journal.
const runStory = (state: FactoryState): FactoryState => {
  let next = state;
  const chapter = CHAPTER_IDS[next.chapter];
  if (chapter && isChapterDone(next, chapter)) {
    const reward = chapterReward(next);
    next = say({ ...next, chapter: next.chapter + 1, money: next.money + reward, totalEarned: next.totalEarned + reward }, { key: "chapter", chapter });
  }
  for (const achievement of newAchievements(next)) next = say({ ...next, achievements: [...next.achievements, achievement] }, { key: "achievement", achievement });
  return next;
};

/** Time spent away (or a long stretch to simulate): up to the offline cap, second by second. The incident going on runs
 * out, and no new one comes. */
export const advance = (state: FactoryState, seconds: number, random: () => number = Math.random): FactoryState => {
  let next = state;
  let left = Math.min(Math.max(0, seconds), RULES.offlineCap);
  while (left > 0) {
    const dt = Math.min(1, left);
    next = tick(next, dt, random, false);
    left -= dt;
  }
  return next;
};

// --- Saves ----------------------------------------------------------------------------------------------------------

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const readBuildings = (value: unknown, isCount = true): Record<BuildingId, number> => {
  const saved = (typeof value === "object" && value !== null ? value : {}) as Partial<Record<BuildingId, unknown>>;
  return Object.fromEntries(
    BUILDING_IDS.map((id) => {
      const count = saved[id];
      return [id, isNumber(count) && count >= 0 ? (isCount ? Math.floor(count) : count) : 0];
    }),
  ) as Record<BuildingId, number>;
};

// Stores (or, with `signed`, how they move: up or down).
const readGoods = (value: unknown, signed = false): Record<Good, number> => {
  const saved = (typeof value === "object" && value !== null ? value : {}) as Partial<Record<Good, unknown>>;
  return Object.fromEntries(
    GOODS.map((good) => {
      const amount = saved[good];
      return [good, isNumber(amount) && (signed || amount >= 0) ? amount : 0];
    }),
  ) as Record<Good, number>;
};

// A saved factory, read with care: anything odd starts a new one rather than a broken game.
export const readFactory = (value: unknown): FactoryState | null => {
  if (typeof value !== "object" || value === null) return null;
  const saved = value as Partial<FactoryState>;
  const numbers = [
    saved.money, saved.pizzas, saved.kits, saved.price, saved.cratePrice, saved.cooks, saved.restaurants, saved.marketing,
    saved.totalMade, saved.totalSold, saved.totalEarned, saved.cratesBought, saved.seconds, saved.marketClock, saved.nextLogId,
  ];
  if (saved.version !== 1 || (saved.era !== 1 && saved.era !== 2 && saved.era !== 3 && saved.era !== 4) || !numbers.every((n) => isNumber(n) && n >= 0)) return null;
  if (!Array.isArray(saved.upgrades) || !Array.isArray(saved.milestones) || !Array.isArray(saved.log)) return null;
  if ((saved.restaurants ?? 0) < 1 || (saved.price ?? 0) < RULES.minPrice) return null;
  const upgrades = saved.upgrades.filter((id): id is UpgradeId => (UPGRADE_IDS as readonly string[]).includes(id));
  const milestones = saved.milestones.filter((key): key is MessageKey => (MESSAGE_KEYS as readonly string[]).includes(key));
  const log = saved.log.filter(
    (entry): entry is LogEntry =>
      typeof entry === "object" && entry !== null && isNumber(entry.id) && (MESSAGE_KEYS as readonly string[]).includes(entry.key) &&
      (entry.upgrade === undefined || (UPGRADE_IDS as readonly string[]).includes(entry.upgrade)) &&
      (entry.research === undefined || (RESEARCH_IDS as readonly string[]).includes(entry.research)) &&
      (entry.incident === undefined || (INCIDENT_KINDS as readonly string[]).includes(entry.incident)) &&
      (entry.building === undefined || (BUILDING_IDS as readonly string[]).includes(entry.building)) &&
      (entry.planet === undefined || (PLANET_IDS as readonly string[]).includes(entry.planet)) &&
      (entry.stage === undefined || (isNumber(entry.stage) && entry.stage >= 1 && entry.stage <= STAGES.length)) &&
      (entry.city === undefined || (isNumber(entry.city) && entry.city >= 1 && entry.city < CITIES.length)) &&
      (entry.chapter === undefined || (CHAPTER_IDS as readonly string[]).includes(entry.chapter)) &&
      (entry.achievement === undefined || (ACHIEVEMENT_IDS as readonly string[]).includes(entry.achievement)) &&
      (entry.order === undefined || (ORDER_KINDS as readonly string[]).includes(entry.order)),
  );
  // What is no longer part of the game (era 3's former distribution deals) is dropped.
  const { deals: _deals, ...current } = saved as FactoryState & { deals?: unknown };
  const stocks = readGoods(saved.stocks);
  const buildings = readBuildings(saved.buildings);
  // A store never holds more than it can: its cap follows the buildings that fill it.
  for (const good of GOODS) stocks[good] = Math.min(stocks[good], storeCap({ buildings, stocks, factoryRates: noBuildings(), stockTrends: noStocks(), researched: [] }, good));
  return {
    ...current,
    upgrades,
    milestones,
    log,
    autoBuy: saved.autoBuy === true,
    autoHire: saved.autoHire === true,
    autoPrice: saved.autoPrice === true,
    // Saves from before the factories have none of these.
    buildings,
    stocks,
    factoryRates: readBuildings(saved.factoryRates, false),
    stockTrends: readGoods(saved.stockTrends, true),
    research: isNumber(saved.research) && saved.research >= 0 ? saved.research : 0,
    researched: Array.isArray(saved.researched) ? saved.researched.filter((id): id is ResearchId => (RESEARCH_IDS as readonly string[]).includes(id)) : [],
    autoBuild: saved.autoBuild === true,
    autoKits: saved.autoKits === true,
    kitsFromPlant: isNumber(saved.kitsFromPlant) && saved.kitsFromPlant >= 0 ? saved.kitsFromPlant : 0,
    incident: readIncident(saved.incident),
    incidentClock: isNumber(saved.incidentClock) && saved.incidentClock >= 0 ? saved.incidentClock : FIRST_INCIDENT,
    incidentsOn: saved.incidentsOn !== false,
    cosmos: readCosmos(saved.cosmos),
    // Saves from before the cities, the story, the achievements, the orders and the rush.
    cities: isNumber(saved.cities) && saved.cities >= 1
      ? Math.min(CITIES.length, Math.max(Math.floor(saved.cities), citiesFor(saved.restaurants ?? 1)))
      : citiesFor(saved.restaurants ?? 1),
    autoExpand: saved.autoExpand === true,
    autoAds: saved.autoAds === true,
    autoRepair: saved.autoRepair === true,
    autoShips: saved.autoShips === true,
    autoOvens: saved.autoOvens === true,
    autoFarms: saved.autoFarms === true,
    // A save from before the story starts at its era's first chapter (the earlier ones are not paid again).
    chapter: isNumber(saved.chapter) && saved.chapter >= 0 ? Math.min(Math.floor(saved.chapter), CHAPTER_IDS.length) : firstChapterOf(saved.era as Era),
    achievements: Array.isArray(saved.achievements)
      ? ACHIEVEMENT_IDS.filter((id) => (saved.achievements as unknown[]).includes(id))
      : [],
    order: readOrder(saved.order),
    orderClock: isNumber(saved.orderClock) && saved.orderClock >= 0 ? saved.orderClock : FIRST_ORDER,
    ordersDone: isNumber(saved.ordersDone) && saved.ordersDone >= 0 ? Math.floor(saved.ordersDone) : 0,
    handMade: isNumber(saved.handMade) && saved.handMade >= 0 ? saved.handMade : 0,
    incidentsFixed: isNumber(saved.incidentsFixed) && saved.incidentsFixed >= 0 ? Math.floor(saved.incidentsFixed) : 0,
    rushLeft: isNumber(saved.rushLeft) && saved.rushLeft >= 0 ? Math.min(saved.rushLeft, RUSH.seconds) : 0,
    rushReady: isNumber(saved.rushReady) && saved.rushReady >= 0 ? Math.min(saved.rushReady, RUSH.cooldown + RUSH.seconds) : 0,
  };
};
