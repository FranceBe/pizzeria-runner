import type { AchievementId } from "../data/achievements";
import type { DayEventId } from "../data/events";
import type { IngredientId } from "../data/ingredients";
import type { UpgradeKey } from "../data/progression";
import type { ClassicRecipeId } from "../data/recipes";
import type { Language, MessageInput, ToastKey, TutorialKey } from "../i18n";
import type { JsonObject } from "../utils/saveCode";

export type Phase = "prep" | "service" | "summary";

/** 0 = happy, 1 = patient, 2 = getting hungry, 3 = starving. */
export type Mood = 0 | 1 | 2 | 3;

export type CustomRecipeId = `c-${string}`;
export type RecipeId = ClassicRecipeId | CustomRecipeId;

export interface Recipe {
  id: RecipeId;
  /** Null for classics: their name is translated from the id when shown. */
  name: string | null;
  ingredients: readonly IngredientId[];
  price: number;
  classic: boolean;
  custom: boolean;
  onMenu: boolean;
  /** Last day the recipe counts as new (boosted demand, tagged in the UI). */
  newUntil: number;
}

export interface Looks {
  skin: string;
  hair: string;
  hairStyle: number;
}

export interface Customer extends Looks {
  id: string;
  /** A name is a person: it keys the customer book. */
  name: string;
  /** Missing on customers from saves made before regulars existed. */
  visitNumber?: number;
  recipeId: RecipeId;
  recipeName: string | null;
  ingredients: readonly IngredientId[];
  extraIngredient: IngredientId | null;
  removedIngredient: IngredientId | null;
  price: number;
  waitedSeconds: number;
  /** Which of the mood's lines the customer says. */
  lineIndex: number;
  /** A regular ordering "the usual": the ticket hides the recipe. Missing on older saves. */
  asUsual?: boolean;
  /** The food critic of a critic day: not in the customer book, rewards reputation. */
  critic?: boolean;
  /** A delivery order: nobody at the counter, an express bonus instead of a tip. */
  delivery?: boolean;
}

export interface OvenPizza {
  id: string;
  ingredients: readonly IngredientId[];
  bakedSeconds: number;
  bakeDuration: number;
}

export interface ReadyPizza {
  id: string;
  ingredients: readonly IngredientId[];
}

export interface RecipeSales {
  name: string | null;
  count: number;
}

export interface OrderRecord {
  customerName: string;
  recipeId: RecipeId;
  recipeName: string | null;
  ingredients: readonly IngredientId[];
  price: number;
  tip: number;
}

export interface ServiceStats {
  served: number;
  /** Customers served while still happy (mood 0). */
  happyServed: number;
  revenue: number;
  tips: number;
  waste: number;
  xp: number;
  levelUps: number[];
  /** Keyed by recipe id, or by recipe name for sales migrated from old saves. */
  byRecipe: Record<string, RecipeSales>;
  orders: OrderRecord[];
}

export interface Service {
  customersToCome: number;
  /** Seconds until the next customer may come in. */
  nextArrivalIn: number;
  customers: Customer[];
  /** The pizza being built. */
  board: IngredientId[];
  oven: OvenPizza[];
  /** The pass: baked pizzas waiting to be served. */
  ready: ReadyPizza[];
  selectedCustomerId: string | null;
  stats: ServiceStats;
  /** Still to come on a critic day. */
  criticPending?: boolean;
  /** Set for a timed challenge, which uses free ingredients and leaves the game untouched. */
  challenge?: Challenge | null;
}

export interface Challenge {
  secondsLeft: number;
  score: number;
}

export interface ChallengeResult {
  score: number;
  served: number;
  isNewBest: boolean;
}

export interface BestSeller {
  /** A recipe id, or a recipe name for days migrated from old saves. */
  recipeId: string;
  name: string | null;
  count: number;
}

export interface DaySummary {
  day: number;
  served: number;
  revenue: number;
  tips: number;
  purchases: number;
  charges: number;
  waste: number;
  xp: number;
  levelUps: number[];
  debt: number;
  net: number;
  bestSeller: BestSeller | null;
  /** Missing on summaries from saves made before the order recap existed. */
  orders?: OrderRecord[];
  event?: DayEventId | null;
}

/** A finished day, kept for the journal (without the order list, to keep saves small). */
export interface DayRecord {
  day: number;
  served: number;
  revenue: number;
  tips: number;
  net: number;
  xp: number;
  event: DayEventId | null;
}

export interface LifetimeStats {
  served: number;
  revenue: number;
  tips: number;
  happyServed: number;
  asUsualServed: number;
  deliveries: number;
  criticsPleased: number;
  /** Days with at least a few pizzas served and nothing binned. */
  wasteFreeDays: number;
  bestDay: { day: number; net: number } | null;
  /** Keyed like ServiceStats.byRecipe. */
  byRecipe: Record<string, RecipeSales>;
}

export interface CustomerBookEntry extends Looks {
  visits: number;
  /** How many times they ordered each recipe, by recipe id. */
  orders: Record<string, number>;
}

export interface Settings {
  showHelp: boolean;
  language: Language;
  tutorialDone: boolean;
}

export type ToastKind = "" | "gold" | "warn";
export type ToastInput = MessageInput<"toasts", ToastKey>;
export type Toast = ToastInput & { id: string; kind: ToastKind };

export type PopKind = "money" | "tip" | "express";
export interface Pop {
  id: string;
  amount: number;
  kind: PopKind;
}

/** UI elements the tutorial can point at. */
export type CoachTarget = "open" | "dough" | "toppings" | "bake" | "serve";
export type TutorialStep = MessageInput<"tutorial", TutorialKey> & { target: CoachTarget | null };

export type Stock = Partial<Record<IngredientId, number>>;

export interface GameState {
  version: number;
  name: string;
  money: number;
  debt: number;
  day: number;
  xp: number;
  stock: Stock;
  unlocked: Partial<Record<IngredientId, boolean>>;
  recipes: Recipe[];
  upgrades: Record<UpgradeKey, number>;
  settings: Settings;
  phase: Phase;
  purchasesToday: number;
  lastNonnaVisitDay: number;
  /** Everyone ever served, by name. */
  customerBook: Record<string, CustomerBookEntry>;
  /** Today's event, picked when the day starts. */
  event: DayEventId | null;
  /** Ordered more often, highlighted on the menu. */
  chefSpecial: RecipeId | null;
  /** Flavour pairings found by serving them, as pairingKey() strings. */
  discoveredPairings: string[];
  /** Unlocked achievements, with the day they were unlocked. */
  achievements: Partial<Record<AchievementId, number>>;
  history: DayRecord[];
  lifetime: LifetimeStats;
  bestChallengeScore: number;
  challengeResult: ChallengeResult | null;
  service: Service | null;
  summary: DaySummary | null;
  toasts: Toast[];
  pops: Pop[];
}

/** What gets saved: toasts and pops are transient. */
export type SaveData = Omit<GameState, "toasts" | "pops">;

export type GameAction =
  // Service
  | { type: "openRestaurant" }
  | { type: "tick"; seconds: number }
  | { type: "selectCustomer"; customerId: string }
  | { type: "toggleIngredient"; ingredientId: IngredientId }
  | { type: "trashBoard" }
  | { type: "bake" }
  | { type: "assembleOrder" }
  | { type: "servePizza"; pizzaId: string }
  | { type: "trashReadyPizza"; pizzaId: string }
  | { type: "revealUsualOrder"; customerId: string }
  | { type: "startChallenge" }
  | { type: "dismissChallengeResult" }
  | { type: "startNextDay" }
  // Shop
  | { type: "buyIngredient"; ingredientId: IngredientId; quantity: number }
  | { type: "restock"; targetQuantity: number }
  | { type: "signSupplier"; ingredientId: IngredientId }
  | { type: "callNonna" }
  | { type: "buyUpgrade"; upgradeKey: UpgradeKey }
  // Menu
  | { type: "changePrice"; recipeId: RecipeId; delta: number }
  | { type: "toggleOnMenu"; recipeId: RecipeId }
  | { type: "addRecipe"; name: string; ingredients: readonly IngredientId[]; price: number }
  | { type: "deleteRecipe"; recipeId: RecipeId }
  | { type: "setChefSpecial"; recipeId: RecipeId | null }
  // Settings
  | { type: "renamePizzeria"; name: string }
  | { type: "toggleHelp" }
  | { type: "skipTutorial" }
  | { type: "setLanguage"; language: Language }
  | { type: "dismissToast"; toastId: string }
  | { type: "dismissPop"; popId: string }
  | { type: "importSave"; saveData: JsonObject }
  | { type: "resetGame" };

export type ActionType = GameAction["type"];
export type ActionOf<Type extends ActionType> = Extract<GameAction, { type: Type }>;

/** Receives a deep copy of the state to mutate; returns nothing, or a whole new state to replace it. */
export type ActionHandler<Type extends ActionType> = (state: GameState, action: ActionOf<Type>) => GameState | void;
export type ActionHandlers = { [Type in ActionType]: ActionHandler<Type> };

export type Dispatch = (action: GameAction) => void;
