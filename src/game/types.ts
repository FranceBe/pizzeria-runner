import type { AchievementId } from "../data/achievements";
import type { AccessoryId } from "../data/customers";
import type { AwningId, CosmeticId, CosmeticSlot, SignId, WallId } from "../data/cosmetics";
import type { DrinkId } from "../data/drinks";
import type { FestivalId } from "../data/festivals";
import type { WeeklyKind } from "../data/weekly";
import type { TonightKind } from "../data/tonight";
import type { StoryId } from "../data/stories";
import type { PostcardId } from "../data/postcards";
import type { QuestGiver, QuestKind } from "../data/quests";
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
  /** Missing on customers met before accessories existed. */
  accessory?: AccessoryId | null;
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
  /** The mystery guest (a day event): never shown, revealed on the receipt. */
  mystery?: boolean;
  /** A delivery order: nobody at the counter, an express bonus instead of a tip. */
  delivery?: boolean;
  /** Only orders recipes that fit; gluten-free swaps the dough for the gluten-free one. */
  diet?: Diet | null;
  /** Customers who came in together share a table id; serving the whole table happy earns a bonus. */
  tableId?: string | null;
  drink?: DrinkId | null;
  drinkServed?: boolean;
  /** A regular's drink, on the house: a better tip and a little reputation. */
  drinkOffered?: boolean;
  /** Pizza served, drink not yet: they stay at the counter until it comes. */
  pizzaServed?: boolean;
  /** Had a slice of a pizza nobody ordered (game/slice.ts), once an evening: the seconds it took off their wait. */
  sliceSeconds?: number;
  /** Came back the same evening for a dessert pizza: a bonus if it comes quickly. */
  forDessert?: boolean;
  /** Heard good things from the customer before (Mamma's secret): patience back to full, and a tip for sure. */
  charmed?: boolean;
  /** A regular on their birthday: their favourite earns a gift. */
  birthday?: boolean;
  /** A regular here for a chapter of their story (game/stories.ts). */
  story?: { id: StoryId; chapter: number };
  /** A (made-up) celebrity: not in the customer book, a big tip and a signed photo. */
  celebrity?: boolean;
}

export type Diet = "veggie" | "noPork" | "glutenFree";

export interface TableProgress {
  size: number;
  served: number;
  /** Everyone served so far was still happy or patient. */
  allHappy: boolean;
  /** Colour index of the table badge. */
  color: number;
}

export interface OvenPizza {
  id: string;
  /** With a pinch of Nonna's secret: it looks and matches like any other pizza. */
  secret?: boolean;
  /** With Mamma's secret: whoever eats it charms the next customer. */
  mamma?: boolean;
  /** Baked in a wood-fired oven: a better pizza. */
  woodFired?: boolean;
  /** Which oven it bakes in (see ovensOf); missing on older saves, meaning the first. */
  ovenIndex?: number;
  ingredients: readonly IngredientId[];
  bakedSeconds: number;
  bakeDuration: number;
}

export interface ReadyPizza {
  id: string;
  secret?: boolean;
  mamma?: boolean;
  woodFired?: boolean;
  /** Seconds on the pass: it cools down, and tips with it. */
  waitingSeconds?: number;
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
  /** They came as a table: its size, and its colour on the tickets. */
  table?: { size: number; color: number };
  /** How it went, for a possible review (see reviews.ts); missing for critics, who write their own. */
  stars?: number;
  reason?: ReviewReason;
}

// What a review talks about: the best of evenings, or what went wrong.
export type ReviewReason = "perfect" | "woodFired" | "wait" | "lukewarm" | "cold";

export interface Review {
  day: number;
  name: string;
  /** 1 to 5. */
  stars: number;
  reason: ReviewReason;
  /** Which of the reason's lines (see src/i18n). */
  line: number;
  recipeId: RecipeId;
  recipeName: string | null;
}

// A food critic's article about the pizzeria.
export interface PressReview {
  day: number;
  /** Written by the mystery guest, for the guide. */
  mystery?: boolean;
  /** Index in PRESS_PAPERS. */
  paper: number;
  critic: string;
  /** 3 to 5, as the critic's toast said. */
  stars: number;
  line: number;
  recipeId: RecipeId;
  recipeName: string | null;
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
  /** Revenue from drinks (also counted in revenue). */
  drinks?: number;
  /** Neighbourhood quest rewards paid today (not counted in revenue). */
  questRewards?: number;
  /** Bonuses paid today: tonight's goal, weekly missions, the mystery guest (see payBonus). */
  bonuses?: number;
  /** Happy customers served in a row (see game/streak.ts). */
  streak?: number;
  bestStreak?: number;
  /** Customers served once already hungry or starving: none means a star for the day. */
  hungryServed?: number;
  /** Pizzas nobody ordered, sliced for the queue instead of binned. */
  slices?: number;
  /** Keyed by recipe id, or by recipe name for sales migrated from old saves. */
  byRecipe: Record<string, RecipeSales>;
  orders: OrderRecord[];
}

/** The evening's pace, from how the latest ones went (game/difficulty.ts). */
export type Pace = "gentle" | "normal" | "brisk";

export interface Service {
  /** Unset in challenges and older saves: normal. */
  pace?: Pace;
  customersToCome: number;
  /** Seconds until the next customer may come in. */
  nextArrivalIn: number;
  customers: Customer[];
  /** The pizza being built. */
  board: IngredientId[];
  /** Nonna's secret is on the pizza being built. */
  secretOnBoard?: boolean;
  /** Mamma's secret is on the pizza being built. */
  mammaOnBoard?: boolean;
  /** Co-op: what the other player is working on, shown on their ticket in their colour. Only in a player's view. */
  partner?: { selectedCustomerId: string | null; color: number; name: string };
  /** Happy customers who will come back later tonight for a dessert pizza, and in how many seconds. */
  dessertReturns?: { name: string; inSeconds: number }[];
  /** Customers to charm as soon as they come in (Mamma's secret, served while nobody else was waiting). */
  charmsPending?: number;
  /** Drinks poured that nobody took yet. */
  tray?: DrinkId[];
  /** How far the barman is with the drink he is pouring (seconds). */
  barmanSeconds?: number;
  /** The clock is stopped: nobody waits, nothing bakes, nobody comes in. */
  paused?: boolean;
  /** Seconds since the restaurant opened. */
  elapsed?: number;
  /** How long tonight should last (seconds), for the evening's clock (game/clock.ts). */
  expectedSeconds?: number;
  /** Late delivery day: the ingredient has arrived. */
  lateArrived?: boolean;
  /** Rush hour: customers come in quick succession, tips are doubled. */
  rush?: { secondsLeft: number } | null;
  /** Tonight's rush hour, at this time on the evening's clock (null: none tonight, or it already came). */
  rushAtMinutes?: number | null;
  /** The kitchen was told the rush is near. */
  rushWarned?: boolean;
  /** Tonight's group order: seconds before it comes in, then seconds since it came in. */
  batchArrivesIn?: number | null;
  batch?: { elapsed: number } | null;
  celebrityCame?: boolean;
  /** The match evening: the kick-off and the half-time already happened. */
  matchKickedOff?: boolean;
  halftimeCame?: boolean;
  /** The last customer of the evening came in, and the kitchen was told. */
  lastOrdersSaid?: boolean;
  /** The mystery guest's evening: the arrival they come with (counting customers in), and how they were served. */
  mysteryArrival?: number | null;
  arrivals?: number;
  mysteryVisit?: MysteryVisit | null;
  /** Closed before the end: the day can't earn its "everyone served" star. */
  closedEarly?: boolean;
  oven: OvenPizza[];
  /** The pass: baked pizzas waiting to be served. */
  ready: ReadyPizza[];
  selectedCustomerId: string | null;
  stats: ServiceStats;
  /** Still to come on a critic day. */
  criticPending?: boolean;
  /** Regulars whose birthday it is, still to come. */
  birthdayGuests?: string[];
  /** Regulars coming tonight for a chapter of their story. */
  storyGuests?: string[];
  tables?: Record<string, TableProgress>;
  /** Set for a timed challenge, which uses free ingredients and leaves the game untouched. */
  challenge?: Challenge | null;
}

/** The daily challenge: the same customers, in the same order, for everyone on a given date. */
export interface Challenge {
  /** A match against friends (see src/multiplayer): same customers, no pause, nothing recorded as a daily challenge. */
  multiplayer?: boolean;
  /** Two players in one shared kitchen, for a team score. */
  coop?: boolean;
  /** Pizza Royale: sudden death, customers coming faster and faster. */
  royale?: boolean;
  /** Pizza Royale: the mistake that put this player out. */
  out?: RoyaleMistake;
  secondsLeft: number;
  score: number;
  /** "2026-10-17" */
  date: string;
  /** State of the seeded random generator, so the sequence survives a reload. */
  seed: number;
  menu: ClassicRecipeId[];
  happy: number;
}

// In Pizza Royale: baking a pizza nobody is waiting for, or throwing anything away.
export type RoyaleMistake = "unwantedPizza" | "waste";

export interface Competitor {
  name: string;
  firstDay: number;
  /** The day's stars won while it is open. */
  stars: number;
  outcome?: "gaveUp" | "stayed";
  /** Once it gave up: its customers come until this day. */
  boostUntil?: number;
}

export interface MysteryVisit {
  name: string;
  recipeId: RecipeId;
  recipeName: string | null;
  stars: number;
  xp: number;
  money: number;
}

export interface TonightGoal {
  day: number;
  kind: TonightKind;
  target: number;
  progress: number;
  status: "open" | "done" | "missed";
}

export interface ChallengeResult {
  multiplayer?: boolean;
  coop?: boolean;
  royale?: boolean;
  out?: RoyaleMistake;
  date: string;
  score: number;
  served: number;
  happy: number;
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
  /** Of the revenue, what the bar brought in. */
  drinks?: number;
  /** What the second address brought in tonight. */
  annexeIncome?: number;
  /** Neighbourhood quest rewards paid that day. */
  questRewards?: number;
  /** Bonuses paid that day (tonight's goal, weekly missions, the mystery guest). */
  bonuses?: number;
  /** Customers served still happy. */
  happyServed?: number;
  /** The day's stars (0–3) and which goals earned them. */
  stars?: number;
  starGoals?: StarGoals;
  /** Inspection day passed. */
  inspectionPassed?: boolean;
  /** Tonight's goal, as it ended. */
  tonightGoal?: TonightGoal;
  /** A mystery guest's evening: who it was and their stars, or null if they never came in. */
  mystery?: MysteryVisit | null;
  /** The competitor across the street that day: which of its days, and the stars against it so far. */
  competitor?: { name: string; day: number; stars: number };
  /** Reviews written tonight. */
  reviews?: Review[];
}

export interface StarGoals {
  /** Nobody served hungry, nobody sent home early. */
  happy: boolean;
  /** Nothing binned. */
  waste: boolean;
  /** Profit target reached. */
  profit: boolean;
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
  stars?: number;
  /** Served before getting impatient (not in older saves). */
  happyServed?: number;
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
  sweetServed: number;
  drinksSold: number;
  happyTables: number;
  birthdays: number;
  questsDone: number;
  dailyChallenges: number;
  /** Money earned from neighbourhood quests. */
  questRewards: number;
  stars: number;
  bestStreak: number;
  celebrities: number;
  batchGolds: number;
}

export type Medal = "gold" | "silver" | "bronze";

/** One line of a group order. */
export interface BatchItem {
  recipeId: RecipeId;
  recipeName: string | null;
  count: number;
  delivered: number;
}

export interface WeeklyMission {
  kind: WeeklyKind;
  target: number;
  progress: number;
  done: boolean;
}

export interface Weekly {
  /** Week number: (day - 1) / 7, rounded down. */
  week: number;
  missions: WeeklyMission[];
  bonusPaid: boolean;
}

/** A completed neighbourhood quest, for the journal. */
export type QuestRecord = Pick<Quest, "kind" | "giver" | "target" | "recipeId" | "recipeName" | "reward" | "items"> & {
  day: number;
  medal?: Medal;
};

export interface Quest {
  kind: QuestKind;
  giver: QuestGiver;
  target: number;
  progress: number;
  /** For serveRecipe. */
  recipeId?: RecipeId;
  recipeName?: string | null;
  /** For a group order (kind "batch"): what to make, delivered all together tonight. */
  items?: BatchItem[];
  /** Last day to complete it. */
  deadlineDay: number;
  reward: number;
  xp: number;
  /** A group order paid more than usual (the wedding banquet). */
  rewardFactor?: number;
}

export interface Cosmetics {
  owned: CosmeticId[];
  awning: AwningId;
  sign: SignId;
  wall: WallId;
}

export type Theme = "auto" | "light" | "dark";
export type SoundChannel = "music" | "effects";

export interface CustomerBookEntry extends Looks {
  visits: number;
  /** How many times they ordered each recipe, by recipe id. */
  orders: Record<string, number>;
  /** Given when they become a regular: they never order a pizza with it. */
  dislikes?: IngredientId;
  /** Day of the 28-day month (1–28), given when they become a regular. */
  birthday?: number;
  /** The last day they came; missing on older saves until the next day starts. */
  lastVisit?: number;
  /** Like orders, but only the visits when the menu offered a real choice (see regulars.ts). */
  choiceOrders?: Record<string, number>;
  /** A regular for now: set when they qualify (see regulars.ts), cleared when they stay away too long. */
  regular?: boolean;
  /** Their story (game/stories.ts), once they have one: which, and how far it has come. */
  story?: { id: StoryId; chapter: number; dueDay: number };
}

export interface Settings {
  showHelp: boolean;
  language: Language;
  theme: Theme;
  largeText: boolean;
  /** 0 to 1. */
  musicVolume: number;
  effectsVolume: number;
  musicMuted: boolean;
  effectsMuted: boolean;
  tutorialDone: boolean;
  /** Comfort upgrades can be switched off for free, for those who play better without them. */
  useDrawer: boolean;
  commisFade: boolean;
  /** The nickname shown to others in multiplayer; empty until chosen. */
  playerName: string;
}

export type ToastKind = "" | "gold" | "warn";
export type ToastInput = MessageInput<"toasts", ToastKey>;
export type Toast = ToastInput & { id: string; kind: ToastKind };

export type PopKind = "money" | "tip" | "express" | "table" | "gift" | "drink" | "secret" | "batch" | "special" | "theme";

export interface WeeklySpecial {
  recipeId: RecipeId;
  /** weekOf() the day it was chosen: it is this week's special only. */
  week: number;
  /** It can be changed on the morning it was chosen. */
  chosenDay: number;
  /** Served this week. */
  served: number;
}
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
  /** Last day Nonna lent money (once a day at most). */
  lastNonnaLoanDay: number;
  /** The game as it was when the restaurant opened, to start the day over. */
  dayStart: DayStart | null;
  /** Everyone ever served, by name. */
  customerBook: Record<string, CustomerBookEntry>;
  /** Today's event, picked when the day starts. */
  event: DayEventId | null;
  /** The week's special (game/special.ts): ordered more often, a bonus when it goes out quickly. */
  special: WeeklySpecial | null;
  /** Flavour pairings found by serving them, as pairingKey() strings. */
  discoveredPairings: string[];
  /** Unlocked achievements, with the day they were unlocked. */
  achievements: Partial<Record<AchievementId, number>>;
  history: DayRecord[];
  lifetime: LifetimeStats;
  bestChallengeScore: number;
  challengeResult: ChallengeResult | null;
  /** Best score of the latest daily challenge played. */
  dailyChallenge: { date: string; best: number } | null;
  quest: Quest | null;
  /** Completed quests, most recent last (the latest few only). */
  questLog: QuestRecord[];
  cosmetics: Cosmetics;
  /** Nonna's secret ingredient, once she has shared it. */
  secretIngredient: boolean;
  /** Jars of it made at the market and not used yet. */
  secretStock: number;
  /** The neighbourhood: names who come often (see regulars.ts). */
  locals: string[];
  /** The latest online reviews, and the score over every review ever written. Only for show. */
  reviews: Review[];
  reviewScore: { count: number; total: number };
  /** Food critics' articles, latest last. */
  press: PressReview[];
  /** Mamma's secret ingredient, once she has shared it. */
  mammaSecret: boolean;
  /** Portions of it made at the market and not used yet. */
  mammaStock: number;
  /** Late delivery day: the ingredient that comes late. */
  lateIngredient: IngredientId | null;
  /** The calendar festival going on, if any. */
  festival: FestivalId | null;
  weekly: Weekly | null;
  /** Tonight's optional goal (game/tonight.ts), for the day it was drawn. */
  tonightGoal: TonightGoal | null;
  /** Tonight's rush hour, drawn in the morning so it can be announced: the time on the evening's clock. */
  rushPlan: { day: number; at: number } | null;
  /** The last competitor across the street (game/competitor.ts): its days, the stars against it, how it ended. */
  competitor: Competitor | null;
  /** Postcards received (game/postcards.ts), with the day each came. */
  postcards: Partial<Record<PostcardId, number>>;
  /** Signed photos of the celebrities who came, shown on the front. */
  celebrityWall: string[];
  /** Someone typed the code. */
  secretCodeFound: boolean;
  service: Service | null;
  summary: DaySummary | null;
  toasts: Toast[];
  pops: Pop[];
}

/** A copy of the game taken when the restaurant opens. */
export type DayStart = Omit<GameState, "toasts" | "pops" | "dayStart">;

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
  | { type: "servePizza"; pizzaId: string }
  | { type: "trashReadyPizza"; pizzaId: string }
  | { type: "revealUsualOrder"; customerId: string }
  /** date: the day's date for the daily challenge, or the room's seed for a multiplayer match. */
  | { type: "startChallenge"; date: string; multiplayer?: boolean; seconds?: number; royale?: boolean }
  // The match ended for everyone (a Pizza Royale with one player left): this one's game stops too.
  | { type: "endMatch" }
  // Out of a match against friends before its end: back to the morning prep, nothing recorded.
  | { type: "leaveMatch" }
  | { type: "setPlayerName"; name: string }
  | { type: "pourDrink"; drinkId: DrinkId }
  | { type: "serveTrayDrink"; index: number }
  | { type: "binTray" }
  | { type: "offerDrink" }
  | { type: "toggleSecret" }
  | { type: "craftSecret" }
  | { type: "toggleMamma" }
  | { type: "craftMamma" }
  | { type: "enterSecretCode" }
  | { type: "dismissChallengeResult" }
  | { type: "startNextDay" }
  | { type: "togglePause" }
  | { type: "selectBatch" }
  | { type: "syncCalendar"; date: string }
  | { type: "closeEarly" }
  | { type: "restartDay" }
  | { type: "trashUnwantedPizzas" }
  | { type: "offerSlice"; pizzaId: string }
  // Shop
  | { type: "buyIngredient"; ingredientId: IngredientId; quantity: number }
  | { type: "restock"; targetQuantity: number }
  | { type: "signSupplier"; ingredientId: IngredientId }
  | { type: "callNonna" }
  | { type: "borrowFromNonna" }
  | { type: "buyUpgrade"; upgradeKey: UpgradeKey }
  | { type: "chooseCosmetic"; slot: CosmeticSlot; id: string }
  // Menu
  | { type: "changePrice"; recipeId: RecipeId; delta: number }
  | { type: "toggleOnMenu"; recipeId: RecipeId }
  | { type: "addRecipe"; name: string; ingredients: readonly IngredientId[]; price: number }
  | { type: "deleteRecipe"; recipeId: RecipeId }
  | { type: "setSpecial"; recipeId: RecipeId | null }
  // Settings
  | { type: "renamePizzeria"; name: string }
  | { type: "toggleHelp" }
  | { type: "setTheme"; theme: Theme }
  | { type: "toggleLargeText" }
  | { type: "toggleComfort"; option: "useDrawer" | "commisFade" }
  | { type: "sellUpgrade"; upgradeKey: UpgradeKey }
  | { type: "setVolume"; channel: SoundChannel; volume: number }
  | { type: "toggleMute"; channel: SoundChannel }
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
