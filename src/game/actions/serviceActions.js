import { INGREDIENTS } from "../../data/ingredients.js";
import { BAKE_SECONDS, COMMIS_SPREADS_DOUGH } from "../../data/progression.js";
import { randomBetween, makeId } from "../../utils/random.js";
import { createCustomer, hasSpecialRequest, rollTip } from "../customers.js";
import { recordVisit } from "../regulars.js";
import { dailyCharges, forecastCustomers, payCharges, receivePayment } from "../economy.js";
import { ingredientCost, isSauce, fillingsOf, sortByLayer } from "../pizza.js";
import { levelForXp } from "../progression.js";
import { customerForPizza, maxQueueLength, ovenSlots } from "../service.js";
import { pushToast, pushPop } from "../toasts.js";

const FIRST_ARRIVAL_DELAY = 0.6;
const MIN_SECONDS_BETWEEN_ARRIVALS = 3.5;
const MAX_SECONDS_BETWEEN_ARRIVALS = 6.5;
const SPECIAL_REQUEST_XP_BONUS = 3;

const DOUGH = "pate";

const addToStock = (state, id, quantity = 1) => (state.stock[id] = (state.stock[id] || 0) + quantity);
const inStock = (state, id) => state.stock[id] || 0;

function createService(customerCount) {
  return {
    customersToCome: customerCount,
    nextArrivalIn: FIRST_ARRIVAL_DELAY,
    customers: [],
    board: [],
    oven: [],
    ready: [],
    selectedCustomerId: null,
    stats: { served: 0, revenue: 0, tips: 0, waste: 0, xp: 0, levelUps: [], byRecipe: {}, orders: [] },
  };
}

// byRecipe: { [recipeId]: { name, count } }. Returns the most ordered one, or null.
function bestSellerOf(byRecipe) {
  const [recipeId, sales] = Object.entries(byRecipe).sort((a, b) => b[1].count - a[1].count)[0] ?? [];
  return recipeId ? { recipeId, name: sales.name, count: sales.count } : null;
}

function endDay(state) {
  const { service } = state;
  const unservedPizzas = [...service.ready, ...service.oven];
  const waste = service.stats.waste + unservedPizzas.reduce((total, pizza) => total + ingredientCost(pizza.ingredients), 0);
  // Whatever is still on the board goes back in the fridge.
  service.board.forEach((id) => addToStock(state, id));

  const charges = dailyCharges(state);
  payCharges(state, charges);

  const { stats } = service;
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
    net: stats.revenue + stats.tips - charges - state.purchasesToday,
    bestSeller: bestSellerOf(stats.byRecipe),
    orders: stats.orders ?? [],
  };
  state.service = null;
  state.phase = "summary";
}

const isDayOver = (service) => service.customersToCome === 0 && service.customers.length === 0;

export const serviceActions = {
  openRestaurant(state) {
    const customerCount = forecastCustomers(state);
    if (!customerCount) {
      pushToast(state, "emptyMenu", {}, "warn");
      return;
    }
    state.service = createService(customerCount);
    state.phase = "service";
  },

  tick(state, { seconds }) {
    const { service } = state;
    service.customers.forEach((customer) => (customer.waitedSeconds += seconds));
    service.oven.forEach((pizza) => (pizza.bakedSeconds += seconds));

    const isBaked = (pizza) => pizza.bakedSeconds >= pizza.bakeDuration;
    service.oven.filter(isBaked).forEach((pizza) => service.ready.push({ id: pizza.id, ingredients: pizza.ingredients }));
    service.oven = service.oven.filter((pizza) => !isBaked(pizza));

    service.nextArrivalIn -= seconds;
    const someoneCanArrive =
      service.nextArrivalIn <= 0 && service.customersToCome > 0 && service.customers.length < maxQueueLength(state);
    if (!someoneCanArrive) return;

    const customer = createCustomer(state);
    if (!customer) {
      // The menu was emptied mid-service: nobody else comes tonight.
      service.customersToCome = 0;
      if (isDayOver(service)) endDay(state);
      return;
    }
    service.customers.push(customer);
    service.customersToCome -= 1;
    service.nextArrivalIn = randomBetween(MIN_SECONDS_BETWEEN_ARRIVALS, MAX_SECONDS_BETWEEN_ARRIVALS);
    if (!service.selectedCustomerId) service.selectedCustomerId = customer.id;
  },

  selectCustomer(state, { customerId }) {
    state.service.selectedCustomerId = customerId;
  },

  toggleIngredient(state, { ingredientId: id }) {
    const { service } = state;
    if (service.board.includes(id)) {
      if (id === DOUGH && service.board.length > 1) {
        pushToast(state, "removeToppingsFirst");
        return;
      }
      service.board = service.board.filter((x) => x !== id);
      addToStock(state, id);
      return;
    }
    if (id !== DOUGH && !service.board.includes(DOUGH)) {
      pushToast(state, "spreadDoughFirst");
      return;
    }
    if (inStock(state, id) < 1) {
      pushToast(state, "outOfStock", { ingredientId: id }, "warn");
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
    state.stock[id] -= 1;
  },

  trashBoard(state) {
    const { service } = state;
    service.stats.waste += ingredientCost(service.board);
    service.board = [];
  },

  bake(state) {
    const { service } = state;
    if (!service.board.includes(DOUGH)) return;
    if (service.oven.length >= ovenSlots(state)) {
      pushToast(state, "ovenFull");
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
      state.stock[DOUGH] -= 1;
    }
  },

  // Commis level 2: puts exactly the selected order on the board.
  assembleOrder(state) {
    const { service } = state;
    const customer = service.customers.find((c) => c.id === service.selectedCustomerId);
    if (!customer) return;
    const toAdd = customer.ingredients.filter((id) => !service.board.includes(id));
    const missing = toAdd.filter((id) => inStock(state, id) < 1);
    if (missing.length) {
      pushToast(state, "missingIngredients", { ingredientIds: missing }, "warn");
      return;
    }
    service.board.filter((id) => !customer.ingredients.includes(id)).forEach((id) => addToStock(state, id));
    toAdd.forEach((id) => (state.stock[id] -= 1));
    service.board = [...customer.ingredients];
  },

  servePizza(state, { pizzaId }) {
    const { service } = state;
    const pizza = service.ready.find((p) => p.id === pizzaId);
    if (!pizza) return;
    const customer = customerForPizza(service, pizza.ingredients);
    if (!customer) {
      pushToast(state, "nobodyOrdered");
      return;
    }
    service.ready = service.ready.filter((p) => p.id !== pizza.id);
    service.customers = service.customers.filter((c) => c.id !== customer.id);

    const tip = rollTip(state, customer);
    receivePayment(state, customer.price + tip);
    if (recordVisit(state, customer)) pushToast(state, "newRegular", { name: customer.name }, "gold");
    // The first pizza served completes the tutorial.
    state.settings.tutorialDone = true;

    const xpGained =
      6 + 2 * fillingsOf(customer.ingredients).length + (hasSpecialRequest(customer) ? SPECIAL_REQUEST_XP_BONUS : 0);
    const levelBefore = levelForXp(state.xp);
    state.xp += xpGained;
    const levelAfter = levelForXp(state.xp);

    const { stats } = service;
    stats.served += 1;
    stats.revenue += customer.price;
    stats.tips += tip;
    stats.xp += xpGained;
    const sales = stats.byRecipe[customer.recipeId] ?? { name: customer.recipeName, count: 0 };
    stats.byRecipe[customer.recipeId] = { ...sales, count: sales.count + 1 };

    stats.orders = [
      ...(stats.orders ?? []),
      { customerName: customer.name, recipeId: customer.recipeId, recipeName: customer.recipeName, ingredients: customer.ingredients, price: customer.price, tip },
    ];

    pushPop(state, customer.price, "money");
    if (tip) pushPop(state, tip, "tip");
    if (levelAfter > levelBefore) {
      stats.levelUps.push(levelAfter);
      const newSupplierIds = INGREDIENTS.filter((i) => i.requiredLevel === levelAfter).map((i) => i.id);
      pushToast(state, "levelUp", { level: levelAfter, ingredientIds: newSupplierIds }, "gold");
    }

    if (service.selectedCustomerId === customer.id) service.selectedCustomerId = service.customers[0]?.id ?? null;
    if (isDayOver(service)) endDay(state);
  },

  trashReadyPizza(state, { pizzaId }) {
    const { service } = state;
    const pizza = service.ready.find((p) => p.id === pizzaId);
    if (!pizza) return;
    service.stats.waste += ingredientCost(pizza.ingredients);
    service.ready = service.ready.filter((p) => p.id !== pizzaId);
  },

  startNextDay(state) {
    state.day += 1;
    state.phase = "prep";
    state.summary = null;
    state.purchasesToday = 0;
  },
};
