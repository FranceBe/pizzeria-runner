import { DRINKS } from "../../data/drinks";
import { INGREDIENTS, type IngredientId } from "../../data/ingredients";
import { ANNEXE_INCOME, COMMIS_SPREADS_DOUGH, DELIVERY_CHANCE } from "../../data/progression";
import { randomBetween, randomIndex, makeId } from "../../utils/random";
import { createChallenge, createChallengeCustomer, nextChallengeArrival } from "../challenge";
import { createCustomer, isRegularCustomer, moodForWait, type CustomerKind } from "../customers";
import { birthdaysToday, recordVisit } from "../regulars";
import { dailyCharges, forecastCustomers, payCharges, receivePayment } from "../economy";
import { rollDayEvent } from "../events";
import { discoverClassics } from "../menu";
import { discoverPairings } from "../pairings";
import { hasBase, ingredientCost, isBase, isSauce, sortByLayer } from "../pizza";
import { levelForXp } from "../progression";
import { advanceQuest, expireQuest, maybeOfferQuest } from "../quests";
import { customerForPizza, maxQueueLength, ovenWithRoom, selectedCustomer } from "../service";
import {
  collectPayment, maybeShareNonnasSecret, recordLifetime, reputationFor, secretBonus, serveForChallenge, settleTable,
} from "../serving";
import { pushToast, pushPop } from "../toasts";
import type { ActionHandlers, BestSeller, Customer, GameState, RecipeSales, Service } from "../types";

const FIRST_ARRIVAL_DELAY = 0.6;
const MIN_SECONDS_BETWEEN_ARRIVALS = 3.5;
const MAX_SECONDS_BETWEEN_ARRIVALS = 6.5;
// A day counts as waste-free with at least this many pizzas served and nothing binned.
const WASTE_FREE_MIN_SERVED = 5;
const MAX_HISTORY_DAYS = 120;

// Tables: from this level, some customers come in together.
const TABLES_LEVEL = 3;
const TABLE_CHANCE = 0.15;
const MAX_TABLE_SIZE = 4;
const TABLE_COLORS = 4;

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
    stats: { served: 0, happyServed: 0, revenue: 0, tips: 0, drinks: 0, waste: 0, xp: 0, levelUps: [], byRecipe: {}, orders: [] },
    tables: {},
    birthdayGuests: [],
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
  // Whatever is still on the board goes back in the fridge, and the secret back on its shelf.
  service.board.forEach((id) => addToStock(state, id));
  if (service.secretOnBoard) state.secretStock += 1;

  const annexeIncome = ANNEXE_INCOME[state.upgrades.annexe] ?? 0;
  if (annexeIncome) receivePayment(state, annexeIncome);
  const charges = dailyCharges(state);
  payCharges(state, charges);

  const { stats } = service;
  const questRewards = stats.questRewards ?? 0;
  const net = stats.revenue + stats.tips + annexeIncome + questRewards - charges - state.purchasesToday;
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
    drinks: stats.drinks ?? 0,
    annexeIncome,
    questRewards,
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
  const challenge = service.challenge;
  if (!challenge) return;
  const { score, date, happy } = challenge;
  const previousBest = state.dailyChallenge?.date === date ? state.dailyChallenge.best : 0;
  const isNewBest = score > previousBest;
  state.dailyChallenge = { date, best: Math.max(score, previousBest) };
  state.bestChallengeScore = Math.max(state.bestChallengeScore, score);
  state.lifetime.dailyChallenges += 1;
  state.challengeResult = { date, score, served: service.stats.served, happy, isNewBest };
  state.service = null;
  state.phase = "prep";
}

const isDayOver = (service: Service): boolean => service.customersToCome === 0 && service.customers.length === 0;

// Who walks in next: the critic and birthday regulars show up at a random point of the evening
// (surely by the last arrival), deliveries come in with the delivery upgrade.
function nextCustomerKind(state: GameState, service: Service): CustomerKind {
  if (service.criticPending && Math.random() < 1 / service.customersToCome) return "critic";
  if (state.upgrades.livraison > 0 && Math.random() < DELIVERY_CHANCE) return "delivery";
  return "regular";
}

// A birthday regular, if one is due now and not already at the counter.
function nextBirthdayGuest(service: Service): string | undefined {
  const guests = (service.birthdayGuests ?? []).filter((name) => !service.customers.some((customer) => customer.name === name));
  if (!guests.length || Math.random() >= guests.length / service.customersToCome) return undefined;
  return guests[0];
}

// How many people come in together: 1, or a table of 2 to 4 when there is room.
function partySize(state: GameState, service: Service): number {
  if (levelForXp(state.xp) < TABLES_LEVEL || Math.random() >= TABLE_CHANCE) return 1;
  const room = Math.min(service.customersToCome, maxQueueLength(state) - service.customers.length);
  return Math.min(room, 2 + randomIndex(MAX_TABLE_SIZE - 1));
}

function seatCustomers(service: Service, customers: Customer[]): void {
  service.customers.push(...customers);
  service.customersToCome -= customers.length;
  if (!service.selectedCustomerId) service.selectedCustomerId = customers[0].id;
}

function letChallengeCustomerIn(service: Service): void {
  const challenge = service.challenge;
  if (!challenge) return;
  const waitingNames = new Set(service.customers.map((customer) => customer.name));
  service.customers.push(createChallengeCustomer(challenge, waitingNames));
  service.customersToCome -= 1;
  service.nextArrivalIn = nextChallengeArrival(challenge);
  if (!service.selectedCustomerId) service.selectedCustomerId = service.customers[0].id;
}

function letCustomersIn(state: GameState, service: Service): void {
  if (service.challenge) return letChallengeCustomerIn(service);
  service.nextArrivalIn = randomBetween(MIN_SECONDS_BETWEEN_ARRIVALS, MAX_SECONDS_BETWEEN_ARRIVALS);

  const birthdayGuest = nextBirthdayGuest(service);
  if (birthdayGuest) {
    service.birthdayGuests = (service.birthdayGuests ?? []).filter((name) => name !== birthdayGuest);
    const guest = createCustomer(state, "regular", { name: birthdayGuest, isBirthday: true });
    if (guest) return seatCustomers(service, [guest]);
  }

  const kind = nextCustomerKind(state, service);
  const size = kind === "regular" ? partySize(state, service) : 1;
  const tableId = size > 1 ? makeId() : undefined;
  const party: Customer[] = [];
  for (let seat = 0; seat < size; seat++) {
    // Each member is created after the previous one joined the queue, so names never repeat.
    const customer = createCustomer({ ...state, service: { ...service, customers: [...service.customers, ...party] } }, kind, { tableId });
    if (customer) party.push(customer);
  }
  if (!party.length) {
    // The menu was emptied mid-service: nobody else comes tonight.
    service.customersToCome = 0;
    if (isDayOver(service)) endDay(state, service);
    return;
  }
  if (kind === "critic") service.criticPending = false;
  if (tableId !== undefined) {
    service.tables = service.tables ?? {};
    const color = Object.keys(service.tables).length % TABLE_COLORS;
    service.tables[tableId] = { size: party.length, served: 0, allHappy: true, color };
  }
  seatCustomers(service, party);
}

export const serviceActions = {
  openRestaurant(state) {
    const customerCount = forecastCustomers(state);
    if (!customerCount) {
      pushToast(state, { key: "emptyMenu" }, "warn");
      return;
    }
    // Kept to start the day over. Copied, so later changes to the game never reach it.
    const { toasts, pops, dayStart, ...beforeOpening } = state;
    state.dayStart = structuredClone(beforeOpening);
    state.service = createService(customerCount);
    state.service.criticPending = state.event === "critic";
    state.service.birthdayGuests = birthdaysToday(state);
    state.phase = "service";
  },

  // Two minutes for fun, the same for everyone on that date: free ingredients, nothing at stake but the score.
  startChallenge(state, { date }) {
    if (state.phase !== "prep" || !state.settings.tutorialDone) return;
    state.service = { ...createService(CHALLENGE_CUSTOMERS), challenge: createChallenge(date) };
    state.phase = "service";
    state.challengeResult = null;
  },

  togglePause(state) {
    if (state.service) state.service.paused = !state.service.paused;
  },

  // Closes for today: whoever is still waiting goes home (no hard feelings), and the day ends as usual.
  closeEarly(state) {
    const { service } = state;
    if (!service || service.challenge) return;
    service.customers = [];
    service.customersToCome = 0;
    endDay(state, service);
  },

  // Back to this morning's prep, as if the restaurant had not opened yet. Settings stay as they are now.
  restartDay(state) {
    if (!state.dayStart || state.service?.challenge) return;
    const restarted: GameState = { ...structuredClone(state.dayStart), settings: state.settings, dayStart: null, toasts: [], pops: [] };
    pushToast(restarted, { key: "dayRestarted" });
    return restarted;
  },

  // Bins every baked pizza nobody is waiting for, in one go.
  trashUnwantedPizzas(state) {
    const { service } = state;
    if (!service) return;
    const unwanted = service.ready.filter((pizza) => !customerForPizza(service, pizza.ingredients));
    unwanted.forEach((pizza) => addWaste(service, pizza.ingredients));
    service.ready = service.ready.filter((pizza) => !unwanted.includes(pizza));
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
    service.oven.filter(isBaked).forEach((pizza) => service.ready.push({ id: pizza.id, ingredients: pizza.ingredients, secret: pizza.secret }));
    service.oven = service.oven.filter((pizza) => !isBaked(pizza));

    if (service.challenge) {
      service.challenge.secondsLeft = Math.max(0, service.challenge.secondsLeft - seconds);
      if (service.challenge.secondsLeft === 0) return finishChallenge(state, service);
    }

    service.nextArrivalIn -= seconds;
    const someoneCanArrive =
      service.nextArrivalIn <= 0 && service.customersToCome > 0 && service.customers.length < maxQueueLength(state);
    if (someoneCanArrive) letCustomersIn(state, service);
  },

  selectCustomer(state, { customerId }) {
    if (state.service) state.service.selectedCustomerId = customerId;
  },

  // Gives up on remembering a regular's usual: the ticket shows the recipe, without the bonus.
  revealUsualOrder(state, { customerId }) {
    const customer = state.service?.customers.find((c) => c.id === customerId);
    if (customer) customer.asUsual = false;
  },

  // Drinks come straight from the bar fridge: to the selected customer if they want it, otherwise to the first who does.
  serveDrink(state, { drinkId }) {
    const { service } = state;
    if (!service) return;
    const wantsIt = (customer: Customer) => customer.drink === drinkId && !customer.drinkServed;
    const customer = service.customers.find((c) => c.id === service.selectedCustomerId && wantsIt(c)) ?? service.customers.find(wantsIt);
    if (!customer) {
      pushToast(state, { key: "nobodyWantsDrink", params: { drinkId } });
      return;
    }
    customer.drinkServed = true;
    const { price } = DRINKS[drinkId];
    receivePayment(state, price);
    pushPop(state, price, "drink");
    service.stats.revenue += price;
    service.stats.drinks = (service.stats.drinks ?? 0) + price;
    state.lifetime.revenue += price;
    state.lifetime.drinksSold += 1;
  },

  // A regular's drink on the house: no money, but they remember it in the tip.
  offerDrink(state) {
    const { service } = state;
    const customer = service && selectedCustomer(service);
    if (!customer?.drink || customer.drinkServed || !isRegularCustomer(state, customer)) return;
    customer.drinkServed = true;
    customer.drinkOffered = true;
    pushToast(state, { key: "drinkOffered", params: { name: customer.name } });
  },

  // A jar of Nonna's secret on the pizza being built (or back on the shelf): nothing changes in the recipe.
  toggleSecret(state) {
    const { service } = state;
    if (!service || !state.secretIngredient) return;
    if (service.secretOnBoard) {
      service.secretOnBoard = false;
      state.secretStock += 1;
      return;
    }
    if (!hasBase(service.board) || state.secretStock < 1) return;
    service.secretOnBoard = true;
    state.secretStock -= 1;
  },

  toggleIngredient(state, { ingredientId: id }) {
    const { service } = state;
    if (!service) return;
    if (service.board.includes(id)) {
      if (isBase(id) && service.board.length > 1) {
        pushToast(state, { key: "removeToppingsFirst" });
        return;
      }
      service.board = service.board.filter((x) => x !== id);
      addToStock(state, id);
      // No dough left: the secret goes back on its shelf.
      if (!hasBase(service.board) && service.secretOnBoard) {
        service.secretOnBoard = false;
        state.secretStock += 1;
      }
      return;
    }
    if (!isBase(id) && !hasBase(service.board)) {
      pushToast(state, { key: "spreadDoughFirst" });
      return;
    }
    if (inStock(state, id) < 1) {
      pushToast(state, { key: "outOfStock", params: { ingredientId: id } }, "warn");
      return;
    }
    // Only one dough and one sauce per pizza: the new one replaces the old.
    const replaced = service.board.find((x) => (isBase(id) && isBase(x)) || (isSauce(id) && isSauce(x)));
    if (replaced) {
      service.board = service.board.filter((x) => x !== replaced);
      addToStock(state, replaced);
    }
    service.board.push(id);
    takeFromStock(state, id);
  },

  trashBoard(state) {
    const { service } = state;
    if (!service) return;
    addWaste(service, service.board);
    service.board = [];
    service.secretOnBoard = false;
  },

  bake(state) {
    const { service } = state;
    if (!service || !hasBase(service.board)) return;
    const oven = ovenWithRoom(state, service);
    if (!oven) {
      pushToast(state, { key: "ovenFull" });
      return;
    }
    service.oven.push({
      id: makeId(),
      ovenIndex: oven.index,
      secret: service.secretOnBoard,
      ingredients: sortByLayer(service.board),
      bakedSeconds: 0,
      bakeDuration: oven.bakeSeconds,
    });
    service.board = [];
    service.secretOnBoard = false;
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

    const levelBefore = levelForXp(state.xp);
    const isHappy = moodForWait(customer.waitedSeconds) === 0;
    const tip = collectPayment(state, customer) + settleTable(state, service, customer) + secretBonus(state, customer, pizza.secret);
    const isPerson = !customer.critic && !customer.delivery;
    if (isPerson && recordVisit(state, customer)) pushToast(state, { key: "newRegular", params: { name: customer.name } }, "gold");
    // The first pizza served completes the tutorial.
    state.settings.tutorialDone = true;
    recordLifetime(state, customer, tip);
    maybeShareNonnasSecret(state);

    const newPairings = discoverPairings(state, customer.ingredients);
    if (newPairings.length) pushToast(state, { key: "newPairing", params: { pairings: newPairings } }, "gold");

    const xpGained = reputationFor(state, customer, newPairings);
    state.xp += xpGained;
    advanceQuest(state, customer, isHappy, newPairings.length);
    const levelAfter = levelForXp(state.xp);

    const { stats } = service;
    stats.served += 1;
    if (isHappy) stats.happyServed += 1;
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
      // Nonna shares her recipes as the pizzeria grows.
      discoverClassics(state);
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
    state.dayStart = null;
    expireQuest(state);
    maybeOfferQuest(state);
  },
} satisfies Partial<ActionHandlers>;
