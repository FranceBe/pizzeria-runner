// A robot that plays the factory mode the way a sensible player would, to balance it and to check it through. It
// clicks a few times a second while that still matters, keeps the price where customers take what is made, keeps
// kits in stock, calls a rush whenever one is ready, and buys whatever pays for itself: cooks, upgrades, advertising,
// restaurants and cities; with the factories, whole
// balanced modules, laboratories, and research, and it settles strikes and breakdowns when the till can spare it; in the
// universe, it opens the planets it can afford, keeps every route's ships and the ovens up with what flows, grows the
// farms the civilisations need, explores, and builds the stellar oven.
import {
  buyCrate, buyMarketing, buyUpgrade, changePrice, cookCapacity, cookCost, crateCost, fairPrice, hireCook, isForSale, makePizza,
  marketingCost, openRestaurant, productionRate, restaurantCost, tick, UPGRADE_IDS, UPGRADES, type FactoryState,
  build, buildStellarStage, cityCapacity, doResearch, fixIncident, incidentFixCost, nextCityCost, openCity, startRush,
} from "./engine";
import {
  appetite, buildOvensAsNeeded, STAGES, equipRoutes, explore, growShortFarms, inflowOf, INGREDIENTS, isReachable, levelCost, openPlanet, PLANET_IDS, PLANETS, raiseLevel,
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
// with the ingredients, farms to keep up with the civilisations' appetite, embassies once the farms keep up, then
// exploring.
const playUniverse = (state: FactoryState): FactoryState => {
  let next = buildStellarStage(state) ?? state;
  const closed = PLANET_IDS.filter((id) => next.cosmos.known.includes(id) && !next.cosmos.planets[id].open && isReachable(next, id))
    .sort((a, b) => PLANETS[a].openCost - PLANETS[b].openCost);
  for (const id of closed) next = openPlanet(next, id) ?? next;
  next = equipRoutes(next, next.money);
  next = buildOvensAsNeeded(next, next.money);
  next = growShortFarms(next, next.money);
  // Saving up for the stellar oven's next stage, once enough pizzas are delivered for it: no new embassy meanwhile.
  const stage = STAGES[next.cosmos.stage];
  const isSaving = stage !== undefined && next.cosmos.sold >= stage.sold;
  const fed = !isSaving && INGREDIENTS.every((good) => inflowOf(next, good) >= appetite(next));
  const embassy = PLANET_IDS.filter((id) => PLANETS[id].kind === "civ" && next.cosmos.planets[id].open)
    .sort((a, b) => levelCost(next, a) - levelCost(next, b))[0];
  if (fed && embassy && next.money >= levelCost(next, embassy) * 10) next = raiseLevel(next, embassy) ?? next;
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
  if (next.era >= 2 && next.cooks >= cookCapacity(next)) {
    // A new city once the cities are full, otherwise a restaurant.
    const city = nextCityCost(next);
    if (next.restaurants >= cityCapacity(next)) next = city !== null && next.money >= city * spare ? openCity(next) ?? next : next;
    else if (next.money >= restaurantCost(next) * spare) next = openRestaurant(next) ?? next;
  }
  // A rush whenever one is ready: the robot stays at the screen.
  next = startRush(next) ?? next;
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
