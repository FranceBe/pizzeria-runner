// Co-op: two players in one kitchen. The host's phone runs the shared kitchen (a game of its own, apart from either
// player's pizzeria); each player has their own board and their own selected order, swapped in for each of their moves,
// so the game's reducer runs as it does in solo.
import { ACHIEVEMENT_IDS } from "../data/achievements";
import { DRINK_IDS } from "../data/drinks";
import { INGREDIENTS, type IngredientId } from "../data/ingredients";
import { gameReducer } from "../game/reducer";
import { createInitialState } from "../game/state";
import type { GameAction, GameState } from "../game/types";
import type { Language } from "../i18n";
import type { DuoInfo } from "./duoSaves";

export interface CoopBoard {
  board: IngredientId[];
  selectedCustomerId: string | null;
  /** Picked by the game, not by the player: moved to a free order when one comes. */
  isAutoPick?: boolean;
}

export interface CoopGame {
  game: GameState;
  /** By player id. */
  boards: Record<string, CoopBoard>;
  /** A duo pizzeria: which one, so the partner can keep a copy of it. */
  duo?: DuoInfo;
}

// What a player may do in the shared kitchen. Anything else coming from the other phone is ignored.
const PLAYER_MOVES: ReadonlySet<string> = new Set([
  "toggleIngredient", "bake", "trashBoard", "selectCustomer", "servePizza", "trashReadyPizza", "trashUnwantedPizzas",
  "dismissToast", "dismissChallengeResult",
]);

// A move's values, checked as well as its kind: the other phone could send anything, say buying -1000 mozzarellas to
// make money. Each value must be one the game's own buttons could send.
const INGREDIENT_IDS: ReadonlySet<string> = new Set(INGREDIENTS.map(({ id }) => id));
const DRINK_ID_SET: ReadonlySet<string> = new Set(DRINK_IDS);
const isId = (value: unknown): boolean => typeof value === "string" && value.length > 0 && value.length <= 64;
const isCount = (value: unknown, max: number): boolean => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
const hasValidValues = (move: Record<string, unknown>): boolean => {
  switch (move.type) {
    case "toggleIngredient":
      return INGREDIENT_IDS.has(String(move.ingredientId));
    case "buyIngredient":
      return INGREDIENT_IDS.has(String(move.ingredientId)) && isCount(move.quantity, 50) && (move.quantity as number) > 0;
    case "restock":
      return isCount(move.targetQuantity, 50);
    case "pourDrink":
      return DRINK_ID_SET.has(String(move.drinkId));
    case "serveTrayDrink":
      return isCount(move.index, 10);
    case "selectCustomer":
    case "revealUsualOrder":
      return isId(move.customerId);
    case "servePizza":
    case "trashReadyPizza":
    case "offerSlice":
      return isId(move.pizzaId);
    case "dismissToast":
      return isId(move.toastId);
    default:
      return true;
  }
};
const isMoveIn = (allowed: ReadonlySet<string>, action: unknown): action is GameAction =>
  typeof action === "object" && action !== null && allowed.has(String((action as { type?: unknown }).type)) && hasValidValues(action as Record<string, unknown>);

export const isCoopMove = (action: unknown): action is GameAction => isMoveIn(PLAYER_MOVES, action);

// In a duo pizzeria, the partner also serves drinks, adds the secrets and restocks; the host makes the big decisions
// (upgrades, the menu, suppliers, opening, the next day).
const PARTNER_DUO_MOVES: ReadonlySet<string> = new Set([
  ...PLAYER_MOVES, "buyIngredient", "restock", "pourDrink", "serveTrayDrink", "binTray", "offerDrink", "toggleSecret", "toggleMamma",
  "revealUsualOrder", "selectBatch", "togglePause", "offerSlice",
]);

// Not even the host does these in a duo pizzeria: they belong to the player's own game.
const NOT_IN_A_DUO: ReadonlySet<string> = new Set(["startChallenge", "importSave", "resetGame", "enterSecretCode", "setPlayerName"]);
export const isAllowedInDuo = (action: GameAction): boolean => !NOT_IN_A_DUO.has(action.type);

export const isPartnerDuoMove = (action: unknown): action is GameAction => isMoveIn(PARTNER_DUO_MOVES, action);

// A duo pizzeria in play: its game, a board per player, and which pizzeria it is.
export const createDuoKitchen = (game: GameState, playerIds: readonly string[], duo: DuoInfo): CoopGame => {
  const boards = Object.fromEntries(playerIds.map((id): [string, CoopBoard] => [id, { board: [], selectedCustomerId: null }]));
  return keepSelectionsValid({ game, boards, duo });
};

// The shared kitchen: two ovens of two pizzas, the challenge's four recipes with endless pans, the room's clock.
export const createCoopGame = (seed: string, playerIds: readonly string[], language: Language, seconds?: number): CoopGame => {
  const base = createInitialState(language);
  base.settings = { ...base.settings, tutorialDone: true, showHelp: true };
  base.upgrades = { ...base.upgrades, oven: 1, oven2: 2 };
  // A kitchen for one match, not a pizzeria: it never announces achievements (nobody would keep them anyway).
  base.achievements = Object.fromEntries(ACHIEVEMENT_IDS.map((id) => [id, 0]));
  const game = gameReducer(base, { type: "startChallenge", date: seed, multiplayer: true, seconds });
  if (game.service?.challenge) game.service.challenge.coop = true;
  const boards = Object.fromEntries(playerIds.map((id): [string, CoopBoard] => [id, { board: [], selectedCustomerId: null }]));
  return keepSelectionsValid({ game, boards });
};

// Everyone's selected order still exists. A player without one, or with one the game picked that the other player is
// also on, gets the first order nobody else is on. A player who chose the same order as the other keeps it: making the
// same pizza twice is theirs to avoid.
const keepSelectionsValid = (coop: CoopGame): CoopGame => {
  const customers = coop.game.service?.customers ?? [];
  const boards = { ...coop.boards };
  Object.keys(boards).forEach((id) => {
    const mine = boards[id];
    const taken = new Set(Object.entries(boards).filter(([other]) => other !== id).map(([, board]) => board.selectedCustomerId));
    const free = customers.find((customer) => !taken.has(customer.id) && !customer.pizzaServed);
    const isValid = mine.selectedCustomerId !== null && customers.some((customer) => customer.id === mine.selectedCustomerId);
    const isSharedAutoPick = mine.isAutoPick && mine.selectedCustomerId !== null && taken.has(mine.selectedCustomerId) && free;
    if (isValid && !isSharedAutoPick) return;
    const pick = free ?? customers[0];
    boards[id] = { ...mine, selectedCustomerId: pick?.id ?? null, isAutoPick: true };
  });
  return { ...coop, boards };
};

// A move by one player: their board goes on the counter, the move is played, their board goes back. Pure.
export const playCoopMove = (coop: CoopGame, playerId: string, action: GameAction): CoopGame => {
  const service = coop.game.service;
  if (!service) return { ...coop, game: gameReducer(coop.game, action) };
  const mine = coop.boards[playerId] ?? { board: [], selectedCustomerId: null };
  const next = gameReducer({ ...coop.game, service: { ...service, board: mine.board, selectedCustomerId: mine.selectedCustomerId } }, action);
  // Choosing an order is the player's own pick; any other move keeps the pick as it was.
  const isAutoPick = action.type === "selectCustomer" ? false : mine.isAutoPick;
  const boards = next.service
    ? { ...coop.boards, [playerId]: { board: next.service.board, selectedCustomerId: next.service.selectedCustomerId, isAutoPick } }
    : coop.boards;
  return keepSelectionsValid({ ...coop, game: next, boards });
};

// The clock moves on, on the host's phone only.
export const tickCoop = (coop: CoopGame, seconds: number): CoopGame => keepSelectionsValid({ ...coop, game: gameReducer(coop.game, { type: "tick", seconds }) });

// What one player sees: their own board and selection, and what their partner is on.
export const coopViewFor = (coop: CoopGame, playerId: string, partner?: { id: string; color: number; name: string }): GameState => {
  const service = coop.game.service;
  if (!service) return coop.game;
  const mine = coop.boards[playerId] ?? { board: [], selectedCustomerId: null };
  return {
    ...coop.game,
    service: {
      ...service,
      board: mine.board,
      selectedCustomerId: mine.selectedCustomerId,
      ...(partner ? { partner: { selectedCustomerId: coop.boards[partner.id]?.selectedCustomerId ?? null, color: partner.color, name: partner.name } } : {}),
    },
  };
};

// The kitchen as it travels to the other phone, and back from it. Null for anything that isn't one.
export const encodeCoop = (coop: CoopGame): string => JSON.stringify(coop);
export const decodeCoop = (raw: string): CoopGame | null => {
  try {
    const data = JSON.parse(raw) as CoopGame;
    return data && typeof data === "object" && data.game && data.boards ? data : null;
  } catch {
    return null;
  }
};
