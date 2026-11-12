// A robot that plays the factory mode the way a sensible player would, to balance it and to check it through. It
// clicks a few times a second while that still matters, keeps the price where customers take what is made, keeps
// kits in stock, and buys whatever pays for itself: cooks, upgrades, advertising, restaurants; with the factories, whole
// balanced modules, laboratories, and research, and it settles strikes and breakdowns when the till can spare it; in the
// universe, it opens the planets it can afford, keeps every route's ships and the ovens up with what flows, grows the
// farms the civilisations need, explores, and builds the stellar oven.
import {
  buyCrate, buyMarketing, buyUpgrade, changePrice, cookCapacity, cookCost, crateCost, fairPrice, hireCook, isForSale, makePizza,
  marketingCost, openRestaurant, productionRate, restaurantCost, tick, UPGRADE_IDS, UPGRADES, type FactoryState,
  build, buildStellarStage, doResearch, fixIncident, incidentFixCost,
} from "./engine";
import {
  addShips, buildOven, explore, INGREDIENTS, isReachable, levelCost, openPlanet, ovenCapacity, ovenCost, PLANET_IDS, PLANETS, production, raiseFarms,
  routeCapacity, shipsNeeded,
} from "./cosmos";
import { nextModule, type BuildingId } from "./plant";
import { isResearchOpen, isResearchShown, RESEARCH, RESEARCH_IDS } from "./research";

export interface BotOptions {
  /** Clicks a second while making pizzas by hand is still worth it. */
  clicksPerSecond: number;
  random: () => number;
}

const steerPrice = (state: FactoryState, supply: number): FactoryState => {
  let next = state;
  const target = fairPrice(next, supply + next.pizzas / 30);
  for (let i = 0; i < 40; i++) {
    if (next.price < target * 0.97) next = changePrice(next, 1);
    else if (next.price > target * 1.03) next = changePrice(next, -1);
    else break;
  }
  return next;
};

// The universe, in order of what matters: the stellar oven, new planets, ships where routes fall short, ovens to keep up
// with the ingredients, farms to keep up with the civilisations' appetite, then exploring.
const playUniverse = (state: FactoryState): FactoryState => {
  let next = buildStellarStage(state) ?? state;
  const closed = PLANET_IDS.filter((id) => next.cosmos.known.includes(id) && !next.cosmos.planets[id].open && isReachable(next, id))
    .sort((a, b) => PLANETS[a].openCost - PLANETS[b].openCost);
  for (const id of closed) next = openPlanet(next, id) ?? next;
  for (const id of PLANET_IDS) if (next.cosmos.planets[id].open && shipsNeeded(next, id) > 0) next = addShips(next, id, shipsNeeded(next, id)) ?? next;
  const open = PLANET_IDS.filter((id) => next.cosmos.planets[id].open);
  const appetite = open.reduce((sum, id) => {
    const spec = PLANETS[id];
    return spec.kind === "civ" ? sum + spec.demand : sum;
  }, 0);
  const inflow = (good: string) => open.reduce((sum, id) => {
    const spec = PLANETS[id];
    return spec.kind === "terroir" && spec.good === good ? sum + Math.min(production(next, id), routeCapacity(next, id)) : sum;
  }, 0);
  const slowest = Math.min(...INGREDIENTS.map(inflow));
  for (let i = 0; i < 20 && ovenCapacity(next) < Math.min(slowest, appetite) && next.money >= ovenCost(next); i++) next = buildOven(next) ?? next;
  for (const good of INGREDIENTS) {
    if (inflow(good) >= appetite * 1.1) continue;
    const farm = open.filter((id) => {
      const spec = PLANETS[id];
      return spec.kind === "terroir" && spec.good === good;
    }).sort((a, b) => levelCost(next, a) / PLANETS[a].distance - levelCost(next, b) / PLANETS[b].distance)[0];
    if (farm) next = raiseFarms(next, farm) ?? next;
  }
  return explore(next) ?? next;
};

/** One second of play: the robot's decisions, then the second goes by. */
export const botSecond = (state: FactoryState, { clicksPerSecond, random }: BotOptions): FactoryState => {
  let next = state;
  const clicks = productionRate(next) < clicksPerSecond * 4 ? clicksPerSecond : 0;
  for (let i = 0; i < clicks; i++) next = makePizza(next);

  // Kits for twenty seconds of work.
  const supply = productionRate(next) + clicks;
  for (let i = 0; i < 50 && next.kits < supply * 20 && next.money >= crateCost(next); i++) next = buyCrate(next) ?? next;

  const upgrade = UPGRADE_IDS.filter((id) => isForSale(next, id) && !UPGRADES[id].comingSoon).sort((a, b) => UPGRADES[a].cost - UPGRADES[b].cost)[0];
  if (upgrade && next.money >= UPGRADES[upgrade].cost) next = buyUpgrade(next, upgrade) ?? next;
  // Cooks while there is room; a restaurant when the kitchens are full; advertising with the money to spare.
  for (let i = 0; i < 200 && next.cooks < cookCapacity(next) && next.money >= cookCost(next); i++) next = hireCook(next) ?? next;
  // Saving up for the rocket plans, then in the universe, the restaurants only get what the till can easily spare.
  const spare = next.era >= 4 || isForSale(next, "spacePlans") ? 20 : 1;
  if (next.era >= 2 && next.cooks >= cookCapacity(next) && next.money >= restaurantCost(next) * spare) next = openRestaurant(next) ?? next;
  if (next.money >= marketingCost(next) * 3 * spare) next = buyMarketing(next) ?? next;
  if (next.era >= 3) {
    const fix = incidentFixCost(next);
    if (fix !== null && next.money >= fix * 2) next = fixIncident(next) ?? next;
    // The plant: a whole balanced module whenever the till allows (the robot plans like the calculator), a laboratory
    // for every four factories, and whatever research is open and paid for.
    for (let i = 0; i < 20; i++) {
      const module = nextModule(next);
      if (next.money < module.cost * (next.era >= 4 ? 20 : 1)) break;
      const buildings = { ...next.buildings };
      for (const [id, count] of Object.entries(module.builds) as [BuildingId, number][]) buildings[id] += count;
      next = { ...next, money: next.money - module.cost, buildings };
    }
    const labsWanted = Math.max(1, Math.floor(next.buildings.pizzaFactory / 4));
    if (next.buildings.pizzaFactory > 0 && next.buildings.researchLab < labsWanted) next = build(next, "researchLab") ?? next;
    const research = RESEARCH_IDS.filter((id) => isResearchShown(next.era, id) && isResearchOpen(next.researched, id)).sort((a, b) => RESEARCH[a].cost - RESEARCH[b].cost)[0];
    if (research) next = doResearch(next, research) ?? next;
  }
  if (next.era >= 4) next = playUniverse(next);
  if (!next.autoPrice) next = steerPrice(next, supply);
  return tick(next, 1, random);
};
