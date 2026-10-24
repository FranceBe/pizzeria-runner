import { DRINKS, TRAY_SIZE, type DrinkId } from "../../data/drinks";
import { canAfford } from "../../utils/math";
import { INGREDIENTS, type IngredientId } from "../../data/ingredients";
import {
  ANNEXE_INCOME, BARMAN_SECONDS, COMMIS_SPREADS_DOUGH, DELIVERY_CHANCE, DESSERT_RETURN_CHANCE, DESSERT_RETURN_SECONDS, WOOD_FIRED_XP_BONUS,
} from "../../data/progression";
import { randomBetween, randomIndex, makeId, pickSome } from "../../utils/random";
import { createChallenge, createChallengeCustomer, createTrapCustomer, nextChallengeArrival } from "../challenge";
import { createCustomer, isRegularCustomer, moodForWait, type CustomerKind } from "../customers";
import { birthdaysToday, ensureLocals, lapseAbsentRegulars, recordVisit } from "../regulars";
import { CUSTOMER_NAMES } from "../../data/customers";
import { dailyCharges, forecastCustomers, payCharges, receivePayment, spend } from "../economy";
import { pickLateIngredient, rollDayEvent } from "../events";
import {
  advanceEvening, announceLastOrders, arrivalPace, bringGroupOrderForward, deliverToBatch, isGroupOrderPending, isStillComing, planEvening, ensureRushPlan, RUSH_ARRIVAL_FACTOR,
  settleUnfinishedBatch,
} from "../evening";
import { syncFestival } from "../calendar";
import { BATCH_ID } from "../batch";
import { starCount, starGoals } from "../stars";
import { nextStreak } from "../streak";
import { ensureWeek, recordWeekly } from "../weekly";
import { ensureSpecialWeek, serveSpecial, specialReputation } from "../special";
import { offerSlice } from "../slice";
import { commisLevel, restCommisOvernight, tireCommis, toggleCommisOff } from "../commis";
import { countWeeklySale, isNewWeek, publishGazette } from "../gazette";
import { deliverLoyaltyGifts } from "../loyalty";
import { isFamilyDue, isFamilyExpected } from "../family";
import { pickSpoilingIngredient, spoilAtClosing, weatherWaiting } from "../incidents";
import { FAMILY_NAMES, FAMILY_SIZE } from "../../data/events";
import { PACE_ARRIVALS, PACE_WAITING, paceFor } from "../difficulty";
import { ensureTonightGoal, settleTonightGoal, trackTonightClock, trackTonightServe } from "../tonight";
import { noteMysteryLeaving, noteMysteryServed, settleMysteryGuest, welcomeMaybeMystery } from "../mystery";
import { companionsOf, maybeStartStory, storyGuestsToday, turnStoryPage } from "../stories";
import { competitorDay, countStarsAgainstCompetitor, endCompetitorRun, maybeOpenCompetitor } from "../competitor";
import { isDayFull } from "../dayLoad";
import { sendPostcard } from "../postcards";
import { CELEBRITY_CHANCE, CELEBRITY_LEVEL, INSPECTION_MIN_SERVED, INSPECTION_XP } from "../../data/events";
import { activeMenu, discoverClassics } from "../menu";
import { discoverPairings } from "../pairings";
import { hasBase, haveSameIngredients, ingredientCost, isBase, isDessert, isSauce, sortByLayer } from "../pizza";
import { levelForXp } from "../progression";
import { advanceQuest, expireQuest, maybeOfferQuest, prepareWedding } from "../quests";
import { barmanTarget, destinationOf, maxQueueLength, ovenWithRoom, selectedCustomer } from "../service";
import {
  collectPayment, maybeShareMammasSecret, maybeShareNonnasSecret, recordLifetime, reputationFor, secretBonus, serveForChallenge, settleTable, themeBonus, isPerfectServe,
} from "../serving";
import { pushToast, pushPop } from "../toasts";
import type { ActionHandlers, BestSeller, Customer, GameState, RecipeSales, RoyaleMistake, Service } from "../types";
import { rateOrder, writeReviews } from "../reviews";

const FIRST_ARRIVAL_DELAY = 0.6;
export const MIN_SECONDS_BETWEEN_ARRIVALS = 3.5;
export const MAX_SECONDS_BETWEEN_ARRIVALS = 6.5;
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

const createService = (customerCount: number): Service => {
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
};

// The most ordered recipe of the day, or null.
const bestSellerOf = (byRecipe: Record<string, RecipeSales>): BestSeller | null => {
  const [best] = Object.entries(byRecipe).sort((a, b) => b[1].count - a[1].count);
  if (!best) return null;
  const [recipeId, sales] = best;
  return { recipeId, name: sales.name, count: sales.count };
};

const endDay = (state: GameState, service: Service): void => {
  settleUnfinishedBatch(state, service);
  settleTonightGoal(state, service);
  const mystery = settleMysteryGuest(state, service);
  const unservedPizzas = [...service.ready, ...service.oven];
  const waste = service.stats.waste + unservedPizzas.reduce((total, pizza) => total + ingredientCost(pizza.ingredients), 0);
  // Whatever is still on the board goes back in the fridge, and the secrets back on their shelf.
  service.board.forEach((id) => addToStock(state, id));
  if (service.secretOnBoard) state.secretStock += 1;
  if (service.mammaOnBoard) state.mammaStock += 1;

  const annexeIncome = ANNEXE_INCOME[state.upgrades.annexe] ?? 0;
  if (annexeIncome) receivePayment(state, annexeIncome);
  const charges = dailyCharges(state);
  payCharges(state, charges);

  const { stats } = service;
  const questRewards = stats.questRewards ?? 0;
  const bonuses = stats.bonuses ?? 0;
  const net = stats.revenue + stats.tips + annexeIncome + questRewards + bonuses - charges - state.purchasesToday;
  const inspectionPassed = state.event === "inspection" && waste === 0 && stats.served >= INSPECTION_MIN_SERVED;
  const spoiled = spoilAtClosing(state);
  tireCommis(state, service);
  if (inspectionPassed) {
    state.xp += INSPECTION_XP;
    stats.xp += INSPECTION_XP;
  }
  const goals = starGoals({ served: stats.served, hungryServed: stats.hungryServed ?? 0, closedEarly: Boolean(service.closedEarly), waste, net, charges });
  const stars = starCount(goals);
  state.lifetime.stars += stars;
  countStarsAgainstCompetitor(state, stars);
  if (stars === 3) sendPostcard(state, "perfectDay");
  if (state.event === "powerCut") sendPostcard(state, "powerCut");
  if (state.event === "festival") sendPostcard(state, "streetParty");
  const day = competitorDay(state);
  const reviews = writeReviews(state, stats.orders);
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
    bonuses,
    happyServed: stats.happyServed,
    perfectServed: stats.perfect ?? 0,
    stars,
    starGoals: goals,
    inspectionPassed,
    ...(spoiled ? { spoiled } : {}),
    reviews,
    ...(state.tonightGoal?.day === state.day ? { tonightGoal: { ...state.tonightGoal } } : {}),
    ...(state.event === "mysteryGuest" ? { mystery } : {}),
    ...(day !== null && state.competitor ? { competitor: { name: state.competitor.name, day, stars: state.competitor.stars } } : {}),
  };

  state.history = [
    ...state.history,
    { day: state.day, served: stats.served, revenue: stats.revenue, tips: stats.tips, net, xp: stats.xp, event: state.event, stars, happyServed: stats.happyServed },
  ].slice(-MAX_HISTORY_DAYS);
  maybeShareMammasSecret(state);
  const { lifetime } = state;
  if (stats.served >= WASTE_FREE_MIN_SERVED && waste === 0) lifetime.wasteFreeDays += 1;
  if (!lifetime.bestDay || net > lifetime.bestDay.net) lifetime.bestDay = { day: state.day, net };

  state.service = null;
  state.phase = "summary";
};

const finishChallenge = (state: GameState, service: Service): void => {
  const challenge = service.challenge;
  if (!challenge) return;
  const { score, date, happy } = challenge;
  if (challenge.multiplayer) {
    // A match against friends: its result is theirs to compare, it doesn't count as a daily challenge.
    state.challengeResult = {
      multiplayer: true,
      ...(challenge.coop ? { coop: true } : {}),
      ...(challenge.royale ? { royale: true } : {}),
      ...(challenge.out ? { out: challenge.out } : {}),
      date,
      score,
      served: service.stats.served,
      happy,
      isNewBest: false,
    };
    state.service = null;
    state.phase = "prep";
    return;
  }
  const previousBest = state.dailyChallenge?.date === date ? state.dailyChallenge.best : 0;
  const isNewBest = score > previousBest;
  state.dailyChallenge = { date, best: Math.max(score, previousBest) };
  state.bestChallengeScore = Math.max(state.bestChallengeScore, score);
  state.lifetime.dailyChallenges += 1;
  state.challengeResult = { date, score, served: service.stats.served, happy, isNewBest };
  state.service = null;
  state.phase = "prep";
};

// Pizza Royale: one mistake and the player is out, their match over.
const isRoyale = (service: Service): boolean => Boolean(service.challenge?.royale);
const knockOut = (state: GameState, service: Service, mistake: RoyaleMistake): void => {
  if (!service.challenge) return;
  service.challenge.out = mistake;
  finishChallenge(state, service);
};
// A pizza nobody is waiting for: as many of it already in the oven or on the pass as there are customers wanting it.
const isUnwanted = (service: Service, ingredients: readonly IngredientId[]): boolean => {
  const same = (other: readonly IngredientId[]) => haveSameIngredients(other, ingredients);
  const wanted = service.customers.filter((customer) => !customer.pizzaServed && same(customer.ingredients)).length;
  const coming = [...service.oven, ...service.ready].filter((pizza) => same(pizza.ingredients)).length;
  return coming >= wanted;
};

const isDayOver = (state: GameState, service: Service): boolean =>
  service.customersToCome === 0 && service.customers.length === 0 && !isGroupOrderPending(state, service) && !isFamilyExpected(state, service);

// A happy customer may come back later tonight for a dessert pizza, if the menu has one and the evening goes on.
const maybePlanDessertReturn = (state: GameState, service: Service, customer: Customer, mood: number): void => {
  const canComeBack = !customer.forDessert && !customer.critic && !customer.delivery && !customer.celebrity && mood <= 1;
  const hasDessert = activeMenu(state).some((recipe) => isDessert(recipe.ingredients));
  if (!canComeBack || !hasDessert || isDessert(customer.ingredients) || service.customersToCome === 0) return;
  if (Math.random() >= DESSERT_RETURN_CHANCE) return;
  const inSeconds = randomBetween(DESSERT_RETURN_SECONDS[0], DESSERT_RETURN_SECONDS[1]);
  service.dessertReturns = [...(service.dessertReturns ?? []), { name: customer.name, inSeconds }];
};

// Brings back, when their time comes and there is room at the counter, those coming back for dessert. They come on
// top of the evening's customers. Mutates the service.
const bringBackForDessert = (state: GameState, service: Service, seconds: number): void => {
  if (!service.dessertReturns?.length) return;
  service.dessertReturns.forEach((planned) => (planned.inSeconds -= seconds));
  const due = service.dessertReturns.filter((planned) => planned.inSeconds <= 0);
  for (const planned of due) {
    if (service.customers.length >= maxQueueLength(state)) break;
    const waiting = service.customers.some((customer) => customer.name === planned.name);
    const customer = waiting ? null : createCustomer(state, "regular", { name: planned.name, forDessert: true });
    service.dessertReturns = service.dessertReturns.filter((candidate) => candidate !== planned);
    if (!customer) continue;
    service.customers.push(customer);
    if (!service.selectedCustomerId) service.selectedCustomerId = customer.id;
  }
};

// The drink goes out and is paid; then the customer may leave (and that may end the day). Mutates state.
// pourCost: the glass, when it is paid along with the sale (the barman's), after the money comes in.
const sellDrink = (state: GameState, service: Service, customer: Customer, pourCost = 0): void => {
  if (!customer.drink) return;
  // Served by hand while the barman was pouring it: he starts over on the next one.
  if (barmanTarget(state, service) === customer) service.barmanSeconds = 0;
  customer.drinkServed = true;
  const { price } = DRINKS[customer.drink];
  receivePayment(state, price);
  if (pourCost) spend(state, pourCost);
  pushPop(state, price, "drink");
  service.stats.revenue += price;
  service.stats.drinks = (service.stats.drinks ?? 0) + price;
  state.lifetime.revenue += price;
  state.lifetime.drinksSold += 1;
  recordWeekly(state, "drinks", 1);
  leaveIfDone(state, service, customer);
};

// Who a glass of this drink goes to: the selected customer first, then the first one waiting for it.
const thirstyFor = (service: Service, drinkId: DrinkId): Customer | undefined => {
  const wantsIt = (customer: Customer) => customer.drink === drinkId && !customer.drinkServed;
  return service.customers.find((c) => c.id === service.selectedCustomerId && wantsIt(c)) ?? service.customers.find(wantsIt);
};

// The barman pours one drink at a time, for the first customer still waiting for one; he never gets it wrong.
// Mutates state.
const pourWithBarman = (state: GameState, service: Service, seconds: number): void => {
  const customer = barmanTarget(state, service);
  if (!customer) {
    service.barmanSeconds = 0;
    return;
  }
  service.barmanSeconds = (service.barmanSeconds ?? 0) + seconds;
  if (service.barmanSeconds < BARMAN_SECONDS) return;
  service.barmanSeconds = 0;
  if (customer.drink) sellDrink(state, service, customer, DRINKS[customer.drink].cost);
};

// Both secrets go back on their shelf (the dough came off the board). Mutates state.
const putSecretsBack = (state: GameState, service: Service): void => {
  if (service.secretOnBoard) state.secretStock += 1;
  if (service.mammaOnBoard) state.mammaStock += 1;
  service.secretOnBoard = false;
  service.mammaOnBoard = false;
};

// Mamma's secret: whoever ate it tells the next customer about the place. That one, if they tip at all (not a critic,
// a delivery or a celebrity), gets their patience back and will tip for sure. Nobody waiting: the next one to come in.
const canBeCharmed = (customer: Customer): boolean =>
  !customer.charmed && !customer.pizzaServed && !customer.critic && !customer.delivery && !customer.celebrity;

const charmNextCustomer = (service: Service, eater: Customer): void => {
  const next = service.customers.find((customer) => customer.id !== eater.id && canBeCharmed(customer));
  if (!next) {
    service.charmsPending = (service.charmsPending ?? 0) + 1;
    return;
  }
  charm(next);
};

const charm = (customer: Customer): void => {
  customer.charmed = true;
  customer.waitedSeconds = 0;
};

const charmWaitingCustomers = (service: Service): void => {
  while (service.charmsPending) {
    const next = service.customers.find(canBeCharmed);
    if (!next) return;
    charm(next);
    service.charmsPending -= 1;
  }
};

// After a pizza goes out, the next order to work on: the first customer still waiting for a pizza.
const selectNextForPizza = (service: Service): void => {
  service.selectedCustomerId = service.customers.find((customer) => !customer.pizzaServed)?.id ?? service.customers[0]?.id ?? null;
};

// A customer who had their pizza and now their drink goes home. Mutates state.
const leaveIfDone = (state: GameState, service: Service, customer: Customer): void => {
  if (!customer.pizzaServed || !customer.drinkServed) return;
  service.customers = service.customers.filter((c) => c.id !== customer.id);
  if (service.selectedCustomerId === customer.id) selectNextForPizza(service);
  if (isDayOver(state, service)) endDay(state, service);
};

// Who walks in next: the critic and birthday regulars show up at a random point of the evening
// (surely by the last arrival), deliveries come in with the delivery upgrade.
const nextCustomerKind = (state: GameState, service: Service): CustomerKind => {
  if (service.criticPending && Math.random() < 1 / service.customersToCome) return "critic";
  if (!service.celebrityCame && levelForXp(state.xp) >= CELEBRITY_LEVEL && Math.random() < CELEBRITY_CHANCE) return "celebrity";
  const deliveriesToday = state.upgrades.livraison > 0 && state.event !== "scooterStrike";
  if (deliveriesToday && Math.random() < DELIVERY_CHANCE) return "delivery";
  return "regular";
};

// A birthday regular, if one is due now and not already at the counter.
// Regulars expected tonight who haven't come in yet (birthdays, stories): the evening keeps a seat for each, so a
// table never takes the last ones, and they come in for sure once only their seats are left.
const expectedGuests = (service: Service): string[] =>
  [...(service.birthdayGuests ?? []), ...(service.storyGuests ?? [])].filter((name) => !service.customers.some((customer) => customer.name === name));

// One of these guests now, now and then until they all came: at random, or for sure once only their seats are left.
const nextExpected = (service: Service, list: readonly string[] | undefined): string | undefined => {
  const guests = (list ?? []).filter((name) => !service.customers.some((customer) => customer.name === name));
  if (!guests.length) return undefined;
  const isNow = expectedGuests(service).length >= service.customersToCome || Math.random() < guests.length / service.customersToCome;
  return isNow ? guests[0] : undefined;
};

const nextBirthdayGuest = (service: Service): string | undefined => nextExpected(service, service.birthdayGuests);

// A regular here for their story's next chapter.
const nextStoryGuest = (service: Service): string | undefined => nextExpected(service, service.storyGuests);

// The story guest and whoever comes with them for this chapter (as a table), as far as there is room. Empty when
// they can't come (nothing on the menu).
const storyParty = (state: GameState, service: Service, name: string): Customer[] => {
  const story = state.customerBook[name]?.story;
  if (!story) return [];
  // Their company never takes the seats of the other guests expected tonight.
  const room = Math.min(service.customersToCome - expectedGuests(service).length, maxQueueLength(state) - service.customers.length);
  const companions = Math.max(0, Math.min(companionsOf(state, name), room - 1));
  const tableId = companions > 0 ? makeId() : undefined;
  const guest = createCustomer(state, "regular", { name, story: { id: story.id, chapter: story.chapter }, tableId });
  if (!guest) return [];
  const party: Customer[] = [guest];
  for (let seat = 0; seat < companions; seat++) {
    const companion = createCustomer({ ...state, service: { ...service, customers: [...service.customers, ...party] } }, "regular", { tableId });
    if (companion) party.push(companion);
  }
  if (tableId !== undefined && party.length > 1) openTable(service, tableId, party.length);
  return party;
};

const openTable = (service: Service, tableId: string, size: number): void => {
  service.tables = service.tables ?? {};
  const color = Object.keys(service.tables).length % TABLE_COLORS;
  service.tables[tableId] = { size, served: 0, allHappy: true, color };
};

// How many people come in together: 1, or a table of 2 to 4 when there is room.
const partySize = (state: GameState, service: Service): number => {
  if (levelForXp(state.xp) < TABLES_LEVEL || Math.random() >= TABLE_CHANCE) return 1;
  // Never the seats kept for the regulars expected tonight.
  const room = Math.min(service.customersToCome - expectedGuests(service).length, maxQueueLength(state) - service.customers.length);
  return Math.max(1, Math.min(room, 2 + randomIndex(MAX_TABLE_SIZE - 1)));
};

// Nonna's family, all at once at one table, on top of the evening's customers. Mutates the service.
const seatFamily = (state: GameState, service: Service): void => {
  service.familyCame = true;
  const tableId = makeId();
  const names = pickSome(FAMILY_NAMES, FAMILY_SIZE);
  const family: Customer[] = [];
  for (const name of names) {
    const member = createCustomer({ ...state, service: { ...service, customers: [...service.customers, ...family] } }, "regular", { name, tableId, family: true });
    if (member) family.push(member);
  }
  if (!family.length) return;
  openTable(service, tableId, family.length);
  if (service.tables?.[tableId]) service.tables[tableId].family = true;
  service.customers.push(...family);
  if (!service.selectedCustomerId) service.selectedCustomerId = family[0].id;
  pushToast(state, { key: "familyArrived", params: { count: family.length } }, "gold");
};

const seatCustomers = (service: Service, customers: Customer[]): void => {
  service.customers.push(...customers);
  service.customersToCome -= customers.length;
  if (!service.selectedCustomerId) service.selectedCustomerId = customers[0].id;
};

const letChallengeCustomerIn = (service: Service): void => {
  const challenge = service.challenge;
  if (!challenge) return;
  const waitingNames = new Set(service.customers.map((customer) => customer.name));
  service.customers.push(createChallengeCustomer(challenge, waitingNames));
  service.customersToCome -= 1;
  service.nextArrivalIn = nextChallengeArrival(challenge);
  if (!service.selectedCustomerId) service.selectedCustomerId = service.customers[0].id;
};

const letCustomersIn = (state: GameState, service: Service): void => {
  if (service.challenge) return letChallengeCustomerIn(service);
  service.nextArrivalIn =
    randomBetween(MIN_SECONDS_BETWEEN_ARRIVALS, MAX_SECONDS_BETWEEN_ARRIVALS) * (service.rush ? RUSH_ARRIVAL_FACTOR : 1) * arrivalPace(state, service) *
    PACE_ARRIVALS[service.pace ?? "normal"];

  const birthdayGuest = nextBirthdayGuest(service);
  if (birthdayGuest) {
    service.birthdayGuests = (service.birthdayGuests ?? []).filter((name) => name !== birthdayGuest);
    const guest = createCustomer(state, "regular", { name: birthdayGuest, isBirthday: true });
    if (guest) {
      welcomeMaybeMystery(state, service, [guest]);
      return seatCustomers(service, [guest]);
    }
  }

  const storyGuest = nextStoryGuest(service);
  if (storyGuest) {
    service.storyGuests = (service.storyGuests ?? []).filter((name) => name !== storyGuest);
    const party = storyParty(state, service, storyGuest);
    if (party.length) {
      welcomeMaybeMystery(state, service, party);
      return seatCustomers(service, party);
    }
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
    if (isDayOver(state, service)) endDay(state, service);
    return;
  }
  if (kind === "critic") service.criticPending = false;
  if (kind === "celebrity") service.celebrityCame = true;
  if (tableId !== undefined) openTable(service, tableId, party.length);
  welcomeMaybeMystery(state, service, party);
  seatCustomers(service, party);
};

export const serviceActions = {
  openRestaurant(state) {
    const customerCount = forecastCustomers(state);
    if (!customerCount) {
      pushToast(state, { key: "emptyMenu" }, "warn");
      return;
    }
    // The first day, or an older save: the neighbourhood is set up before anyone comes in.
    ensureLocals(state, CUSTOMER_NAMES);
    // The very first day has no week yet: its sales count for the first gazette too. Set before the copy below, so
    // starting the day over keeps the same missions.
    ensureWeek(state);
    // Kept to start the day over. Copied, so later changes to the game never reach it.
    const { toasts, pops, messageLog, dayStart, ...beforeOpening } = state;
    state.dayStart = structuredClone(beforeOpening);
    state.service = createService(customerCount);
    state.service.pace = paceFor(state);
    // A new evening, a new thread of messages (the morning's stay out of it).
    state.messageLog = [];
    state.service.criticPending = state.event === "critic";
    state.service.birthdayGuests = birthdaysToday(state);
    state.service.storyGuests = storyGuestsToday(state);
    planEvening(state, state.service, customerCount);
    state.phase = "service";
  },

  // Two minutes for fun, the same for everyone on that date: free ingredients, nothing at stake but the score.
  startChallenge(state, { date, multiplayer = false, seconds, royale = false }) {
    // A friend's match doesn't wait for the tutorial: it may be someone's very first game.
    if (state.phase !== "prep" || (!state.settings.tutorialDone && !multiplayer)) return;
    // Only a match against friends picks its length (one of the room's: a minute to five).
    const length = multiplayer && seconds !== undefined ? Math.min(300, Math.max(60, Math.round(seconds))) : undefined;
    state.service = { ...createService(CHALLENGE_CUSTOMERS), challenge: createChallenge(date, multiplayer, length, multiplayer && royale) };
    state.phase = "service";
    state.challengeResult = null;
  },

  endMatch(state) {
    if (state.service?.challenge?.multiplayer) finishChallenge(state, state.service);
  },

  leaveMatch(state) {
    if (!state.service?.challenge?.multiplayer) return;
    state.service = null;
    state.phase = "prep";
    state.challengeResult = null;
  },

  togglePause(state) {
    // A match against friends runs on a shared clock: no pause.
    if (state.service && !state.service.challenge?.multiplayer) state.service.paused = !state.service.paused;
  },

  // Closes for today: whoever is still waiting goes home (no hard feelings), and the day ends as usual.
  closeEarly(state) {
    const { service } = state;
    if (!service || service.challenge) return;
    service.closedEarly = service.customers.length > 0 || service.customersToCome > 0;
    noteMysteryLeaving(service);
    service.customers = [];
    service.customersToCome = 0;
    endDay(state, service);
  },

  // Back to this morning's prep, as if the restaurant had not opened yet. Settings stay as they are now.
  restartDay(state) {
    if (!state.dayStart || state.service?.challenge) return;
    const restarted: GameState = { ...structuredClone(state.dayStart), settings: state.settings, dayStart: null, toasts: [], pops: [], messageLog: [] };
    pushToast(restarted, { key: "dayRestarted" });
    return restarted;
  },

  // Bins every baked pizza nobody is waiting for, in one go.
  // Pizza Royale: another player sent a tricky customer. Comes in at once, on top of the match's customers.
  receiveTrap(state, { from }) {
    const service = state.service;
    if (!service?.challenge?.royale || service.challenge.out) return;
    const waitingNames = new Set(service.customers.map((customer) => customer.name));
    const customer = createTrapCustomer(service.challenge, from, waitingNames);
    service.customers.push(customer);
    if (!service.selectedCustomerId) service.selectedCustomerId = customer.id;
    pushToast(state, { key: "trapReceived", params: { name: from } }, "warn");
  },

  toggleCommisOff(state) {
    toggleCommisOff(state);
  },

  offerSlice(state, { pizzaId }) {
    if (state.service) offerSlice(state, state.service, pizzaId);
  },

  trashUnwantedPizzas(state) {
    const { service } = state;
    if (!service) return;
    const unwanted = service.ready.filter((pizza) => !destinationOf(state, service, pizza.ingredients));
    if (isRoyale(service) && unwanted.length) return knockOut(state, service, "waste");
    unwanted.forEach((pizza) => addWaste(service, pizza.ingredients));
    service.ready = service.ready.filter((pizza) => !unwanted.includes(pizza));
  },

  dismissChallengeResult(state) {
    state.challengeResult = null;
  },

  tick(state, { seconds }) {
    const { service } = state;
    if (!service) return;
    const waiting = seconds * PACE_WAITING[service.pace ?? "normal"] * weatherWaiting(state);
    service.customers.forEach((customer) => (customer.waitedSeconds += waiting));
    service.oven.forEach((pizza) => (pizza.bakedSeconds += seconds));

    const isBaked = (pizza: { bakedSeconds: number; bakeDuration: number }) => pizza.bakedSeconds >= pizza.bakeDuration;
    service.oven
      .filter(isBaked)
      .forEach(({ id, ingredients, secret, mamma, woodFired }) => service.ready.push({ id, ingredients, secret, mamma, woodFired, waitingSeconds: 0 }));
    service.oven = service.oven.filter((pizza) => !isBaked(pizza));
    if (!service.challenge) {
      bringGroupOrderForward(service);
      advanceEvening(state, service, seconds);
      trackTonightClock(state, service);
    }
    pourWithBarman(state, service, seconds);
    if (state.phase !== "service") return;

    if (service.challenge) {
      service.challenge.secondsLeft = Math.max(0, service.challenge.secondsLeft - seconds);
      if (service.challenge.secondsLeft === 0) return finishChallenge(state, service);
    }

    service.nextArrivalIn -= seconds;
    const someoneCanArrive =
      service.nextArrivalIn <= 0 && service.customersToCome > 0 && service.customers.length < maxQueueLength(state);
    if (someoneCanArrive) {
      letCustomersIn(state, service);
      announceLastOrders(state, service);
    }
    if (isFamilyDue(state, service)) seatFamily(state, service);
    if (service.charmsPending) charmWaitingCustomers(service);
    if (!service.challenge) bringBackForDessert(state, service, seconds);
    // Nobody left and nothing more to wait for (a group order that can no longer be completed, say): the day is over.
    if (!service.challenge && isDayOver(state, service)) endDay(state, service);
  },

  selectBatch(state) {
    if (state.service?.batch) state.service.selectedCustomerId = BATCH_ID;
  },

  // Follows the real date for calendar festivals (dispatched by the app when a day starts or the game opens).
  syncCalendar(state, { date }) {
    syncFestival(state, date);
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
  // Pours a glass: it goes straight to the selected customer if that is their drink, onto the tray otherwise.
  pourDrink(state, { drinkId }) {
    const { service } = state;
    if (!service || service.challenge || DRINKS[drinkId].barLevel > state.upgrades.bar) return;
    const selected = selectedCustomer(service);
    const isForSelected = selected?.drink === drinkId && !selected.drinkServed;
    const tray = service.tray ?? [];
    if (!isForSelected && tray.length >= TRAY_SIZE) {
      pushToast(state, { key: "trayFull" }, "warn");
      return;
    }
    if (!canAfford(state.money, DRINKS[drinkId].cost)) {
      pushToast(state, { key: "notEnoughMoney" }, "warn");
      return;
    }
    spend(state, DRINKS[drinkId].cost);
    if (isForSelected) sellDrink(state, service, selected);
    else service.tray = [...tray, drinkId];
  },

  // A glass from the tray: to the selected customer if they want it, otherwise to whoever ordered that drink.
  serveTrayDrink(state, { index }) {
    const { service } = state;
    const drinkId = service?.tray?.[index];
    if (!service || !drinkId) return;
    const customer = thirstyFor(service, drinkId);
    if (!customer) {
      pushToast(state, { key: "nobodyWantsDrink", params: { drinkId } });
      return;
    }
    service.tray = service.tray?.filter((_, i) => i !== index);
    sellDrink(state, service, customer);
  },

  binTray(state) {
    if (state.service) state.service.tray = [];
  },

  // A regular's drink on the house: no money, but they remember it in the tip.
  offerDrink(state) {
    const { service } = state;
    const customer = service && selectedCustomer(service);
    // Before the pizza only: the gesture shows in the tip, which comes with the pizza.
    if (!customer?.drink || customer.drinkServed || customer.pizzaServed || !isRegularCustomer(state, customer)) return;
    if (!canAfford(state.money, DRINKS[customer.drink].cost)) {
      pushToast(state, { key: "notEnoughMoney" }, "warn");
      return;
    }
    spend(state, DRINKS[customer.drink].cost);
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

  // A spoon of Mamma's secret on the pizza being built (or back in the jar).
  toggleMamma(state) {
    const { service } = state;
    if (!service || !state.mammaSecret || service.challenge) return;
    if (service.mammaOnBoard) {
      service.mammaOnBoard = false;
      state.mammaStock += 1;
      return;
    }
    if (!hasBase(service.board) || state.mammaStock < 1) return;
    service.mammaOnBoard = true;
    state.mammaStock -= 1;
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
      // No dough left: the secrets go back on their shelf.
      if (!hasBase(service.board)) putSecretsBack(state, service);
      return;
    }
    if (!isBase(id) && !hasBase(service.board)) {
      pushToast(state, { key: "spreadDoughFirst" });
      return;
    }
    if (isStillComing(state, service, id)) {
      pushToast(state, { key: "notDeliveredYet", params: { ingredientId: id } }, "warn");
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
    if (isRoyale(service) && service.board.length) return knockOut(state, service, "waste");
    addWaste(service, service.board);
    service.board = [];
    service.secretOnBoard = false;
    service.mammaOnBoard = false;
  },

  bake(state) {
    const { service } = state;
    if (!service || !hasBase(service.board)) return;
    const oven = ovenWithRoom(state, service);
    if (!oven) {
      pushToast(state, { key: "ovenFull" });
      return;
    }
    if (isRoyale(service) && isUnwanted(service, service.board)) return knockOut(state, service, "unwantedPizza");
    service.oven.push({
      id: makeId(),
      ovenIndex: oven.index,
      secret: service.secretOnBoard,
      mamma: service.mammaOnBoard,
      woodFired: oven.isWoodFired,
      ingredients: sortByLayer(service.board),
      bakedSeconds: 0,
      bakeDuration: oven.bakeSeconds,
    });
    service.board = [];
    service.secretOnBoard = false;
    service.mammaOnBoard = false;
    // The commis rolls out the dough the selected order needs (gluten-free when asked).
    const dough = selectedCustomer(service)?.ingredients.find(isBase) ?? DOUGH;
    if (commisLevel(state) >= COMMIS_SPREADS_DOUGH && inStock(state, dough) > 0) {
      service.board = [dough];
      takeFromStock(state, dough);
    }
  },

  servePizza(state, { pizzaId }) {
    const { service } = state;
    if (!service) return;
    const pizza = service.ready.find((p) => p.id === pizzaId);
    if (!pizza) return;
    const destination = destinationOf(state, service, pizza.ingredients);
    if (!destination) {
      pushToast(state, { key: "nobodyOrdered" });
      return;
    }
    if ("batch" in destination) {
      deliverToBatch(state, service, pizza);
      // The group order was the last thing the evening waited for.
      if (isDayOver(state, service)) endDay(state, service);
      return;
    }
    const { customer } = destination;
    service.ready = service.ready.filter((p) => p.id !== pizza.id);
    // Someone still waiting for their drink stays at the counter until it comes; everyone else leaves.
    if (customer.drink && !customer.drinkServed && !service.challenge) customer.pizzaServed = true;
    else service.customers = service.customers.filter((c) => c.id !== customer.id);
    if (service.selectedCustomerId === customer.id) selectNextForPizza(service);

    if (service.challenge) {
      serveForChallenge(service, customer);
      return;
    }

    const levelBefore = levelForXp(state.xp);
    const mood = moodForWait(customer.waitedSeconds);
    noteMysteryServed(service, customer, mood, pizza);
    const isHappy = mood === 0;
    // The streak counts this customer before the tip, so the one who extends it gets the raise.
    const streak = nextStreak(service.stats.streak ?? 0, mood);
    service.stats.streak = streak;
    service.stats.bestStreak = Math.max(service.stats.bestStreak ?? 0, streak);
    state.lifetime.bestStreak = Math.max(state.lifetime.bestStreak, streak);
    recordWeekly(state, "streak", streak, "max");
    if (mood >= 2) service.stats.hungryServed = (service.stats.hungryServed ?? 0) + 1;
    // Read before settling: the table is forgotten once its last guest is served.
    const table = customer.tableId ? service.tables?.[customer.tableId] : undefined;
    const tip =
      collectPayment(state, service, customer, pizza) +
      settleTable(state, service, customer) +
      secretBonus(state, customer, pizza.secret) +
      serveSpecial(state, customer, mood) +
      themeBonus(state, customer);
    if (pizza.mamma) charmNextCustomer(service, customer);
    if (isPerfectServe(customer, pizza)) {
      service.stats.perfect = (service.stats.perfect ?? 0) + 1;
      pushPop(state, 0, "perfect");
    }
    // Critics, deliveries, celebrities and Nonna's family are passing through: they never join the customer book.
    const isPerson = !customer.critic && !customer.delivery && !customer.celebrity && !customer.mystery && !customer.family;
    // Back for dessert, they already counted as a visit tonight.
    if (isPerson && !customer.forDessert && recordVisit(state, customer)) pushToast(state, { key: "newRegular", params: { name: customer.name } }, "gold");
    // The first pizza served completes the tutorial.
    state.settings.tutorialDone = true;
    recordLifetime(state, customer, tip);
    maybeShareNonnasSecret(state);
    maybePlanDessertReturn(state, service, customer, mood);

    const newPairings = discoverPairings(state, customer.ingredients);
    if (newPairings.length) pushToast(state, { key: "newPairing", params: { pairings: newPairings } }, "gold");

    const xpGained = reputationFor(state, customer, newPairings) + (pizza.woodFired ? WOOD_FIRED_XP_BONUS : 0) + specialReputation(state, customer);
    state.xp += xpGained;
    advanceQuest(state, customer, isHappy, newPairings.length);
    const levelAfter = levelForXp(state.xp);

    const { stats } = service;
    stats.served += 1;
    if (isHappy) stats.happyServed += 1;
    stats.revenue += customer.price;
    stats.tips += tip;
    stats.xp += xpGained;
    countWeeklySale(state, customer.recipeId, customer.recipeName);
    if (service.rush) service.stats.rushServed = (service.stats.rushServed ?? 0) + 1;
    const sales = stats.byRecipe[customer.recipeId] ?? { name: customer.recipeName, count: 0 };
    stats.byRecipe[customer.recipeId] = { ...sales, count: sales.count + 1 };

    stats.orders = [
      ...stats.orders,
      {
        customerName: customer.name,
        recipeId: customer.recipeId,
        recipeName: customer.recipeName,
        ingredients: customer.ingredients,
        price: customer.price,
        tip,
        ...(table ? { table: { size: table.size, color: table.color } } : {}),
        ...(customer.critic ? {} : rateOrder(customer, pizza)),
      },
    ];

    if (levelAfter > levelBefore) {
      stats.levelUps.push(levelAfter);
      const newSupplierIds = INGREDIENTS.filter((i) => i.requiredLevel === levelAfter).map((i) => i.id);
      pushToast(state, { key: "levelUp", params: { level: levelAfter, ingredientIds: newSupplierIds } }, "gold");
      // Nonna shares her recipes as the pizzeria grows.
      discoverClassics(state);
    }

    trackTonightServe(state, service, customer, pizza);
    turnStoryPage(state, customer);
    if (isDayOver(state, service)) endDay(state, service);
  },

  trashReadyPizza(state, { pizzaId }) {
    const { service } = state;
    if (!service) return;
    const pizza = service.ready.find((p) => p.id === pizzaId);
    if (!pizza) return;
    if (isRoyale(service)) return knockOut(state, service, "waste");
    addWaste(service, pizza.ingredients);
    service.ready = service.ready.filter((p) => p.id !== pizzaId);
  },

  startNextDay(state) {
    state.day += 1;
    state.phase = "prep";
    state.summary = null;
    state.purchasesToday = 0;
    restCommisOvernight(state);
    // What today already holds: the quest still running, the regulars' birthdays and story chapters, the competitor.
    lapseAbsentRegulars(state);
    expireQuest(state);
    endCompetitorRun(state);
    ensureLocals(state, CUSTOMER_NAMES);
    // Then what may come, as long as the day has room (see game/dayLoad.ts): the day's event first.
    const yesterday = state.event;
    state.event = isDayFull(state) ? null : rollDayEvent(state, yesterday);
    state.lateIngredient = state.event === "lateDelivery" ? pickLateIngredient(state) : null;
    state.spoilingIngredient = state.event === "fridgeFailure" ? pickSpoilingIngredient(state) : null;
    prepareWedding(state);
    if (!isDayFull(state)) maybeOpenCompetitor(state);
    if (!isDayFull(state)) maybeStartStory(state);
    if (!isDayFull(state)) maybeOfferQuest(state);
    if (isNewWeek(state)) {
      publishGazette(state);
      deliverLoyaltyGifts(state);
    }
    ensureWeek(state);
    ensureSpecialWeek(state);
    ensureTonightGoal(state);
    ensureRushPlan(state);
    state.dayStart = null;
  },
} satisfies Partial<ActionHandlers>;
