// Group orders: a neighbourhood quest delivered in one go during tonight's service. A big ticket comes in,
// the pizzas can be made in any order, and the reward depends on how fast the whole order is delivered.
import type { IngredientId } from "../data/ingredients";
import { haveSameIngredients } from "./pizza";
import type { BatchItem, GameState, Medal, Quest, Recipe, Service } from "./types";

// The ticket of the group order is selected with this id, like a customer.
export const BATCH_ID = "batch";
// Seconds into the service before the order comes in.
export const BATCH_ARRIVES_AFTER = 15;
// Seconds per pizza to earn each medal.
const GOLD_SECONDS_PER_PIZZA = 25;
const SILVER_SECONDS_PER_PIZZA = 40;
const MEDAL_FACTOR: Record<Medal, number> = { gold: 1.3, silver: 1, bronze: 0.7 };
// An order not finished by closing time is paid this share of its pizzas' price, for those delivered.
const UNFINISHED_FACTOR = 0.5;
export const BATCH_XP_PER_PIZZA = 8;
export const BATCH_GOLD_XP = 20;

export const pizzaCount = (items: readonly BatchItem[]): number => items.reduce((total, item) => total + item.count, 0);
export const deliveredCount = (items: readonly BatchItem[]): number => items.reduce((total, item) => total + item.delivered, 0);

export const medalFor = (elapsed: number, count: number): Medal => {
  if (elapsed <= GOLD_SECONDS_PER_PIZZA * count) return "gold";
  if (elapsed <= SILVER_SECONDS_PER_PIZZA * count) return "silver";
  return "bronze";
};

// The medal still within reach right now, and the seconds left to keep it (null for bronze).
export const medalInReach = (elapsed: number, count: number): { medal: Medal; secondsLeft: number | null } => {
  const medal = medalFor(elapsed, count);
  if (medal === "bronze") return { medal, secondsLeft: null };
  const limit = (medal === "gold" ? GOLD_SECONDS_PER_PIZZA : SILVER_SECONDS_PER_PIZZA) * count;
  return { medal, secondsLeft: Math.max(0, limit - elapsed) };
};

const recipeOf = (state: GameState, item: BatchItem): Recipe | undefined => state.recipes.find((recipe) => recipe.id === item.recipeId);

const valueOf = (state: GameState, items: readonly BatchItem[], pick: (item: BatchItem) => number): number =>
  items.reduce((total, item) => total + (recipeOf(state, item)?.price ?? 0) * pick(item), 0);

// `factor`: a group order paid more than usual (the wedding banquet).
export const rewardFor = (state: GameState, items: readonly BatchItem[], medal: Medal, factor = 1): number =>
  Math.round(valueOf(state, items, (item) => item.count) * MEDAL_FACTOR[medal] * factor);

export const unfinishedPay = (state: GameState, items: readonly BatchItem[]): number =>
  Math.round(valueOf(state, items, (item) => item.delivered) * UNFINISHED_FACTOR);

// Tonight's group order, if it has come in and isn't complete.
export const openBatch = (state: GameState, service: Service): Quest | null => {
  const { quest } = state;
  return service.batch && quest?.kind === "batch" && quest.items ? quest : null;
};

// The line of the open group order this pizza would complete, if any.
export const batchItemFor = (state: GameState, service: Service, ingredients: readonly IngredientId[]): BatchItem | undefined => {
  return openBatch(state, service)?.items?.find((item) => {
    const recipe = recipeOf(state, item);
    return item.delivered < item.count && recipe !== undefined && haveSameIngredients(recipe.ingredients, ingredients);
  });
};

// What to make next for the group order: the first line still missing pizzas.
export const nextBatchRecipe = (state: GameState, service: Service): Recipe | undefined => {
  const item = openBatch(state, service)?.items?.find((candidate) => candidate.delivered < candidate.count);
  return item ? recipeOf(state, item) : undefined;
};
