// A robot that plays the factory mode the way a sensible player would, to balance it and to check it through. It
// clicks a few times a second while that still matters, keeps the price where customers take what is made, keeps
// kits in stock, and buys whatever pays for itself: cooks, upgrades, advertising, restaurants.
import {
  buyCrate, buyMarketing, buyUpgrade, changePrice, cookCapacity, cookCost, crateCost, fairPrice, hireCook, isForSale, makePizza,
  marketingCost, openRestaurant, productionRate, restaurantCost, tick, UPGRADE_IDS, UPGRADES, type FactoryState,
} from "./engine";

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
  if (next.era >= 2 && next.cooks >= cookCapacity(next) && next.money >= restaurantCost(next)) next = openRestaurant(next) ?? next;
  if (next.money >= marketingCost(next) * 3) next = buyMarketing(next) ?? next;

  if (!next.autoPrice) next = steerPrice(next, supply);
  return tick(next, 1, random);
};
