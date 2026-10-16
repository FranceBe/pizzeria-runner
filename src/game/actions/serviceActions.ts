import { INGREDIENTS, type IngredientId } from "../../data/ingredients";
import {
  BAKE_SECONDS, COMMIS_SPREADS_DOUGH, DELIVERY_CHANCE, DELIVERY_EXPRESS_BONUS, DELIVERY_EXPRESS_SECONDS,
} from "../../data/progression";
import type { Pairing } from "../../data/recipes";
import { randomBetween, makeId } from "../../utils/random";
import { createCustomer, hasSpecialRequest, moodForWait, rollTip, type CustomerKind } from "../customers";
import { recordVisit } from "../regulars";
import { dailyCharges, forecastCustomers, payCharges, receivePayment } from "../economy";
import { rollDayEvent } from "../events";
import { activeMenu } from "../menu";
import { discoverPairings } from "../pairings";
import { ingredientCost, isSauce, fillingsOf, sortByLayer } from "../pizza";
import { levelForXp } from "../progression";
import { customerForPizza, maxQueueLength, ovenSlots, selectedCustomer } from "../service";
import { pushToast, pushPop } from "../toasts";
import type { ActionHandlers, BestSeller, Customer, GameState, Mood, RecipeSales, Service } from "../types";

const FIRST_ARRIVAL_DELAY = 0.6;
const MIN_SECONDS_BETWEEN_ARRIVALS = 3.5;
const MAX_SECONDS_BETWEEN_ARRIVALS = 6.5;
const SPECIAL_REQUEST_XP_BONUS = 3;
const AS_USUAL_XP_BONUS = 4;
const NEW_PAIRING_XP = 5;
// Reputation from the critic, by mood when served.
const CRITIC_XP: Record<Mood, number> = [40, 25, 12, 12];
// Stars in the critic's review, by mood when served.
const CRITIC_STARS: Record<Mood, number> = [5, 4, 3, 3];
// A day counts as waste-free with at least this many pizzas served and nothing binned.
const WASTE_FREE_MIN_SERVED = 5;
const MAX_HISTORY_DAYS = 120;

// The timed challenge: free ingredients, customers keep coming until the clock runs out.
export const CHALLENGE_SECONDS = 120;
const CHALLENGE_ARRIVALS = { min: 2, max: 4 };
// Points per pizza: a base, per filling, and by mood when served.
const CHALLENGE_BASE_POINTS = 10;
const CHALLENGE_FILLING_POINTS = 3;
const CHALLENGE_MOOD_POINTS: Record<Mood, number> = [10, 6, 3, 0];
// Enough customers that the clock always runs out first.
const CHALLENGE_CUSTOMERS = 999;

const DOUGH: IngredientId = "pate";

// During a challenge the fridge is bottomless and nothing is taken from it.
const isChallenge = (state: GameState): boolean => Boolean(state.service?.challenge);
const inStock = (state: GameState, id: IngredientId): number => (isChallenge(state) ? Infinity : state.stock[id] || 0);
const addToStock = (state: GameState, id: IngredientId, quantity = 1): void => {
  if (!isChallenge(state)) state.stock[id] = (state.stock[id] || 0) + quantity;
};
const takeFromStock = (state: GameState, id: IngredientId): void => {
  if (!isChallenge(state)) state.stock[id] = (state.stock[id] || 0) - 1;
};
const addWaste = (service: Service, ingredients: readonly IngredientId[]): void => {
  if (!service.challenge) service.stats.waste += ingredientCost(ingredients);
};

function createService(customerCount: number): Service {
  return {
    customersToCome: customerCount,
    nextArrivalIn: FIRST_ARRIVAL_DELAY,
    customers: [],
    board: [],
    oven: [],
    ready: [],
    selectedCustomerId: null,
    stats: { served: 0, happyServed: 0, revenue: 0, tips: 0, waste: 0, xp: 0, levelUps: [], byRecipe: {}, orders: [] },
  };
}

// The most ordered recipe of the day, or null.
function bestSellerOf(byRecipe: Record<string, RecipeSales>): BestSeller | null {
  const [best] = Object.entries(byRecipe).sort((a, b) => b[1].count - a[1].count);
  if (!best) return null;
  const [recipeId, sales] = best;
  return { recipeId, name: sales.name, count: sales.count };
}

function endDay(state: GameState, service: Service): void {
  const unservedPizzas = [...service.ready, ...service.oven];
  const waste = service.stats.waste + unservedPizzas.reduce((total, pizza) => total + ingredientCost(pizza.ingredients), 0);
  // Whatever is still on the board goes back in the fridge.
  service.board.forEach((id) => addToStock(state, id));

  const charges = dailyCharges(state);
  payCharges(state, charges);

  const { stats } = service;
  const net = stats.revenue + stats.tips - charges - state.purchasesToday;
  state.summary = {
    day: state.day,
    served: stats.served,
    revenue: stats.revenue,
    tips: stats.tips,
    purchases: state.purchasesToday,
    charges,
    waste,
    xp: stats.xp,
    levelUps: stats.levelUps,
    debt: state.debt,
    net,
    bestSeller: bestSellerOf(stats.byRecipe),
    orders: stats.orders,
    event: state.event,
  };

  state.history = [
    ...state.history,
    { day: state.day, served: stats.served, revenue: stats.revenue, tips: stats.tips, net, xp: stats.xp, event: state.event },
  ].slice(-MAX_HISTORY_DAYS);
  const { lifetime } = state;
  if (stats.served >= WASTE_FREE_MIN_SERVED && waste === 0) lifetime.wasteFreeDays += 1;
  if (!lifetime.bestDay || net > lifetime.bestDay.net) lifetime.bestDay = { day: state.day, net };

  state.service = null;
  state.phase = "summary";
}

function finishChallenge(state: GameState, service: Service): void {
  const score = service.challenge?.score ?? 0;
  const isNewBest = score > state.bestChallengeScore;
  if (isNewBest) state.bestChallengeScore = score;
  state.challengeResult = { score, served: service.stats.served, isNewBest };
  state.service = null;
  state.phase = "prep";
}

const isDayOver = (service: Service): boolean => service.customersToCome === 0 && service.customers.length === 0;

// Who walks in next: the critic shows up at a random point of the evening (surely by the last arrival),
// deliveries come in with the delivery upgrade.
function nextCustomerKind(state: GameState, service: Service): CustomerKind {
  if (service.challenge) return "regular";
  if (service.criticPending && Math.random() < 1 / service.customersToCome) return "critic";
  if (state.upgrades.livraison > 0 && Math.random() < DELIVERY_CHANCE) return "delivery";
  return "regular";
}

function letCustomerIn(state: GameState, service: Service): void {
  const kind = nextCustomerKind(state, service);
  const customer = createCustomer(state, kind);
  if (!customer) {
    // The menu was emptied mid-service: nobody else comes tonight.
    service.customersToCome = 0;
    if (service.challenge) finishChallenge(state, service);
    else if (isDayOver(service)) endDay(state, service);
    return;
  }
  if (kind === "critic") service.criticPending = false;
  service.customers.push(customer);
  service.customersToCome -= 1;
  const arrivals = service.challenge ? CHALLENGE_ARRIVALS : { min: MIN_SECONDS_BETWEEN_ARRIVALS, max: MAX_SECONDS_BETWEEN_ARRIVALS };
  service.nextArrivalIn = randomBetween(arrivals.min, arrivals.max);
  if (!service.selectedCustomerId) service.selectedCustomerId = customer.id;
}

function serveForChallenge(service: Service, customer: Customer): void {
  if (!service.challenge) return;
  const mood = moodForWait(customer.waitedSeconds);
  service.challenge.score +=
    CHALLENGE_BASE_POINTS + CHALLENGE_FILLING_POINTS * fillingsOf(customer.ingredients).length + CHALLENGE_MOOD_POINTS[mood];
  service.stats.served += 1;
}

// Money, tips and the express bonus for a served order. Returns the tip (or bonus) given.
function collectPayment(state: GameState, customer: Customer): number {
  let extra = 0;
  if (customer.delivery) {
    if (customer.waitedSeconds < DELIVERY_EXPRESS_SECONDS) extra = DELIVERY_EXPRESS_BONUS;
  } else if (!customer.critic) {
    extra = rollTip(state, customer);
  }
  receivePayment(state, customer.price + extra);
  pushPop(state, customer.price, "money");
  if (extra) pushPop(state, extra, customer.delivery ? "express" : "tip");
  return extra;
}

// Reputation for a served order, including the critic's review.
function reputationFor(state: GameState, customer: Customer, newPairings: readonly Pairing[]): number {
  const mood = moodForWait(customer.waitedSeconds);
  let xp = 6 + 2 * fillingsOf(customer.ingredients).length;
  if (hasSpecialRequest(customer)) xp += SPECIAL_REQUEST_XP_BONUS;
  if (customer.asUsual) xp += AS_USUAL_XP_BONUS;
  xp += NEW_PAIRING_XP * newPairings.length;
  if (customer.critic) {
    xp += CRITIC_XP[mood];
    pushToast(state, { key: "critic", params: { name: customer.name, stars: CRITIC_STARS[mood] } }, "gold");
  }
  return xp;
}

function recordLifetime(state: GameState, customer: Customer, tip: number): void {
  const { lifetime } = state;
  const mood = moodForWait(customer.waitedSeconds);
  lifetime.served += 1;
  lifetime.revenue += customer.price;
  lifetime.tips += tip;
  if (mood === 0) lifetime.happyServed += 1;
  if (customer.asUsual) lifetime.asUsualServed += 1;
  if (customer.delivery) lifetime.deliveries += 1;
  if (customer.critic && mood <= 1) lifetime.criticsPleased += 1;
  const sales = lifetime.byRecipe[customer.recipeId] ?? { name: customer.recipeName, count: 0 };
  lifetime.byRecipe[customer.recipeId] = { ...sales, count: sales.count + 1 };
}

export const serviceActions = {
  openRestaurant(state) {
    const customerCount = forecastCustomers(state);
    if (!customerCount) {
      pushToast(state, { key: "emptyMenu" }, "warn");
      return;
    }
    state.service = createService(customerCount);
    state.service.criticPending = state.event === "critic";
    state.phase = "service";
  },

  // A timed round for fun: free ingredients, no money or reputation at stake, only a best score.
  startChallenge(state) {
    if (state.phase !== "prep" || !activeMenu(state).length) return;
    state.service = { ...createService(CHALLENGE_CUSTOMERS), challenge: { secondsLeft: CHALLENGE_SECONDS, score: 0 } };
    state.phase = "service";
    state.challengeResult = null;
  },

  dismissChallengeResult(state) {
    state.challengeResult = null;
  },

  tick(state, { seconds }) {
    const { service } = state;
    if (!service) return;
    service.customers.forEach((customer) => (customer.waitedSeconds += seconds));
    service.oven.forEach((pizza) => (pizza.bakedSeconds += seconds));

    const isBaked = (pizza: { bakedSeconds: number; bakeDuration: number }) => pizza.bakedSeconds >= pizza.bakeDuration;
    service.oven.filter(isBaked).forEach((pizza) => service.ready.push({ id: pizza.id, ingredients: pizza.ingredients }));
    service.oven = service.oven.filter((pizza) => !isBaked(pizza));

    if (service.challenge) {
      service.challenge.secondsLeft = Math.max(0, service.challenge.secondsLeft - seconds);
      if (service.challenge.secondsLeft === 0) return finishChallenge(state, service);
    }

    service.nextArrivalIn -= seconds;
    const someoneCanArrive =
      service.nextArrivalIn <= 0 && service.customersToCome > 0 && service.customers.length < maxQueueLength(state);
    if (someoneCanArrive) letCustomerIn(state, service);
  },

  selectCustomer(state, { customerId }) {
    if (state.service) state.service.selectedCustomerId = customerId;
  },

  // Gives up on remembering a regular's usual: the ticket shows the recipe, without the bonus.
  revealUsualOrder(state, { customerId }) {
    const customer = state.service?.customers.find((c) => c.id === customerId);
    if (customer) customer.asUsual = false;
  },

  toggleIngredient(state, { ingredientId: id }) {
    const { service } = state;
    if (!service) return;
    if (service.board.includes(id)) {
      if (id === DOUGH && service.board.length > 1) {
        pushToast(state, { key: "removeToppingsFirst" });
        return;
      }
      service.board = service.board.filter((x) => x !== id);
      addToStock(state, id);
      return;
    }
    if (id !== DOUGH && !service.board.includes(DOUGH)) {
      pushToast(state, { key: "spreadDoughFirst" });
      return;
    }
    if (inStock(state, id) < 1) {
      pushToast(state, { key: "outOfStock", params: { ingredientId: id } }, "warn");
      return;
    }
    // Only one sauce per pizza: the new one replaces the old.
    if (isSauce(id)) {
      const previousSauce = service.board.find(isSauce);
      if (previousSauce) {
        service.board = service.board.filter((x) => x !== previousSauce);
        addToStock(state, previousSauce);
      }
    }
    service.board.push(id);
    takeFromStock(state, id);
  },

  trashBoard(state) {
    const { service } = state;
    if (!service) return;
    addWaste(service, service.board);
    service.board = [];
  },

  bake(state) {
    const { service } = state;
    if (!service || !service.board.includes(DOUGH)) return;
    if (service.oven.length >= ovenSlots(state)) {
      pushToast(state, { key: "ovenFull" });
      return;
    }
    service.oven.push({
      id: makeId(),
      ingredients: sortByLayer(service.board),
      bakedSeconds: 0,
      bakeDuration: BAKE_SECONDS[state.upgrades.oven],
    });
    service.board = [];
    if (state.upgrades.commis >= COMMIS_SPREADS_DOUGH && inStock(state, DOUGH) > 0) {
      service.board = [DOUGH];
      takeFromStock(state, DOUGH);
    }
  },

  // Commis level 2: puts exactly the selected order on the board.
  assembleOrder(state) {
    const { service } = state;
    const customer = service && selectedCustomer(service);
    if (!service || !customer) return;
    const toAdd = customer.ingredients.filter((id) => !service.board.includes(id));
    const missing = toAdd.filter((id) => inStock(state, id) < 1);
    if (missing.length) {
      pushToast(state, { key: "missingIngredients", params: { ingredientIds: missing } }, "warn");
      return;
    }
    service.board.filter((id) => !customer.ingredients.includes(id)).forEach((id) => addToStock(state, id));
    toAdd.forEach((id) => takeFromStock(state, id));
    service.board = [...customer.ingredients];
  },

  servePizza(state, { pizzaId }) {
    const { service } = state;
    if (!service) return;
    const pizza = service.ready.find((p) => p.id === pizzaId);
    if (!pizza) return;
    const customer = customerForPizza(service, pizza.ingredients);
    if (!customer) {
      pushToast(state, { key: "nobodyOrdered" });
      return;
    }
    service.ready = service.ready.filter((p) => p.id !== pizza.id);
    service.customers = service.customers.filter((c) => c.id !== customer.id);
    if (service.selectedCustomerId === customer.id) service.selectedCustomerId = service.customers[0]?.id ?? null;

    if (service.challenge) {
      serveForChallenge(service, customer);
      return;
    }

    const tip = collectPayment(state, customer);
    const isPerson = !customer.critic && !customer.delivery;
    if (isPerson && recordVisit(state, customer)) pushToast(state, { key: "newRegular", params: { name: customer.name } }, "gold");
    // The first pizza served completes the tutorial.
    state.settings.tutorialDone = true;
    recordLifetime(state, customer, tip);

    const newPairings = discoverPairings(state, customer.ingredients);
    if (newPairings.length) pushToast(state, { key: "newPairing", params: { pairings: newPairings } }, "gold");

    const xpGained = reputationFor(state, customer, newPairings);
    const levelBefore = levelForXp(state.xp);
    state.xp += xpGained;
    const levelAfter = levelForXp(state.xp);

    const { stats } = service;
    stats.served += 1;
    if (moodForWait(customer.waitedSeconds) === 0) stats.happyServed += 1;
    stats.revenue += customer.price;
    stats.tips += tip;
    stats.xp += xpGained;
    const sales = stats.byRecipe[customer.recipeId] ?? { name: customer.recipeName, count: 0 };
    stats.byRecipe[customer.recipeId] = { ...sales, count: sales.count + 1 };

    stats.orders = [
      ...stats.orders,
      { customerName: customer.name, recipeId: customer.recipeId, recipeName: customer.recipeName, ingredients: customer.ingredients, price: customer.price, tip },
    ];

    if (levelAfter > levelBefore) {
      stats.levelUps.push(levelAfter);
      const newSupplierIds = INGREDIENTS.filter((i) => i.requiredLevel === levelAfter).map((i) => i.id);
      pushToast(state, { key: "levelUp", params: { level: levelAfter, ingredientIds: newSupplierIds } }, "gold");
    }

    if (isDayOver(service)) endDay(state, service);
  },

  trashReadyPizza(state, { pizzaId }) {
    const { service } = state;
    if (!service) return;
    const pizza = service.ready.find((p) => p.id === pizzaId);
    if (!pizza) return;
    addWaste(service, pizza.ingredients);
    service.ready = service.ready.filter((p) => p.id !== pizzaId);
  },

  startNextDay(state) {
    state.day += 1;
    state.phase = "prep";
    state.summary = null;
    state.purchasesToday = 0;
    state.event = rollDayEvent(state.day, state.event);
  },
} satisfies Partial<ActionHandlers>;
