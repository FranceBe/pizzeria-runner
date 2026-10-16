import { INGREDIENTS, ingredientName } from "../../data/ingredients.js";
import { BAKE_SECONDS, COMMIS_SPREADS_DOUGH, tipChanceForDecor } from "../../data/progression.js";
import { formatEuro } from "../../utils/format.js";
import { randomBetween, makeId } from "../../utils/random.js";
import { createCustomer, hasSpecialRequest } from "../customers.js";
import { dailyCharges, forecastCustomers, payCharges, receivePayment } from "../economy.js";
import { ingredientCost, isSauce, fillingsOf, sortByLayer } from "../pizza.js";
import { levelForXp } from "../progression.js";
import { customerForPizza, maxQueueLength, ovenSlots } from "../service.js";
import { pushToast } from "../toasts.js";

const FIRST_ARRIVAL_DELAY = 0.6;
const MIN_SECONDS_BETWEEN_ARRIVALS = 3.5;
const MAX_SECONDS_BETWEEN_ARRIVALS = 6.5;
const SPECIAL_REQUEST_TIP_BONUS = 0.15;
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
    stats: { served: 0, revenue: 0, tips: 0, waste: 0, xp: 0, levelUps: [], byRecipe: {} },
  };
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
    bestSeller: Object.entries(stats.byRecipe).sort((a, b) => b[1] - a[1])[0] || null,
  };
  state.service = null;
  state.phase = "summary";
}

const isDayOver = (service) => service.customersToCome === 0 && service.customers.length === 0;

export const serviceActions = {
  openRestaurant(state) {
    const customerCount = forecastCustomers(state);
    if (!customerCount) {
      pushToast(state, "Ta carte est vide : ajoute au moins une pizza dans l'onglet Carte.", "warn");
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
        pushToast(state, "Retire d'abord la garniture, ou jette la pizza.");
        return;
      }
      service.board = service.board.filter((x) => x !== id);
      addToStock(state, id);
      return;
    }
    if (id !== DOUGH && !service.board.includes(DOUGH)) {
      pushToast(state, "Étale d'abord la pâte.");
      return;
    }
    if (inStock(state, id) < 1) {
      pushToast(state, `Plus de ${ingredientName(id).toLowerCase()} en stock : passe au marché.`, "warn");
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
      pushToast(state, "Le four est plein.");
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
      pushToast(state, `Il manque : ${missing.map(ingredientName).join(", ")}.`, "warn");
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
      pushToast(state, "Personne n'a commandé cette pizza. Garde-la au chaud ou jette-la.");
      return;
    }
    service.ready = service.ready.filter((p) => p.id !== pizza.id);
    service.customers = service.customers.filter((c) => c.id !== customer.id);

    const tipChance = tipChanceForDecor(state.upgrades.deco) + (customer.extraIngredient ? SPECIAL_REQUEST_TIP_BONUS : 0);
    const tip =
      Math.random() < tipChance ? Math.round(randomBetween(0.5, 1 + 0.8 * state.upgrades.deco) * 10) / 10 : 0;
    receivePayment(state, customer.price + tip);

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
    stats.byRecipe[customer.recipeName] = (stats.byRecipe[customer.recipeName] || 0) + 1;

    pushToast(state, `${customer.name} a payé ${formatEuro(customer.price)}${tip ? ` + ${formatEuro(tip)} de pourboire` : ""}.`);
    if (levelAfter > levelBefore) {
      stats.levelUps.push(levelAfter);
      const newSuppliers = INGREDIENTS.filter((i) => i.requiredLevel === levelAfter).map((i) => i.name.toLowerCase());
      const news = newSuppliers.length ? `Nouveaux fournisseurs : ${newSuppliers.join(", ")}.` : "La carte s'agrandit.";
      pushToast(state, `Niveau ${levelAfter} ! ${news}`, "gold");
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
