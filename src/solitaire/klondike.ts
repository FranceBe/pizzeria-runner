// Klondike solitaire, the rules only: dealing, moves, scoring. Every function returns a new game (or null when the move
// isn't allowed) and never changes the one it is given.
//
// Scoring, as in the classic Windows solitaire:
//   waste → tableau +5, waste → foundation +10, tableau → foundation +10, a tableau card turned over +5,
//   foundation → tableau −15, going through the deck again −100 (draw one) or −20 (draw three, from the fourth pass).
//   The score never goes below 0. A win adds a time bonus: 700 000 / seconds, for games of 30 seconds or more.

export const SUITS = ["tomato", "salami", "basil", "olive"] as const;
export type Suit = (typeof SUITS)[number];
export type Color = "red" | "green";
// The pizza's two colours stand for red and black: tomatoes and salami, basil and olives.
export const colorOf = (suit: Suit): Color => (suit === "tomato" || suit === "salami" ? "red" : "green");

export interface Card {
  id: string;
  suit: Suit;
  /** 1 (ace) to 13 (king). */
  rank: number;
  faceUp: boolean;
}

export type DrawCount = 1 | 3;

export interface Game {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  drawCount: DrawCount;
  score: number;
  moves: number;
  /** Times the waste went back to the stock. */
  passes: number;
  seconds: number;
  won: boolean;
}

export type Place = { pile: "waste" } | { pile: "foundation"; index: number } | { pile: "tableau"; index: number };
/** Where a move starts: for the tableau, the card it starts from (with every card on it). */
export type Source = { pile: "waste" } | { pile: "foundation"; index: number } | { pile: "tableau"; index: number; cardIndex: number };

export const SCORES = { wasteToTableau: 5, toFoundation: 10, turnOver: 5, fromFoundation: -15, passOne: -100, passThree: -20 };
const FREE_PASSES_DRAW_THREE = 3;
const RANKS = 13;

export const timeBonus = (seconds: number): number => (seconds >= 30 ? Math.round(700_000 / seconds) : 0);

const copy = (game: Game): Game => ({
  ...game,
  stock: [...game.stock],
  waste: [...game.waste],
  foundations: game.foundations.map((pile) => [...pile]),
  tableau: game.tableau.map((pile) => [...pile]),
});

const withScore = (game: Game, points: number): void => {
  game.score = Math.max(0, game.score + points);
};

export const newDeck = (): Card[] =>
  SUITS.flatMap((suit) => Array.from({ length: RANKS }, (_, i) => ({ id: `${suit}-${i + 1}`, suit, rank: i + 1, faceUp: false })));

// A fresh deal: seven columns of 1 to 7 cards, the last one of each turned up, the rest in the stock.
export const deal = (drawCount: DrawCount, random: () => number = Math.random): Game => {
  const deck = newDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau = Array.from({ length: 7 }, (_, column) => {
    const pile = deck.splice(0, column + 1);
    pile[pile.length - 1] = { ...pile[pile.length - 1], faceUp: true };
    return pile;
  });
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, drawCount, score: 0, moves: 0, passes: 0, seconds: 0, won: false };
};

// Draws one or three cards from the stock, or turns the waste back over when the stock is empty.
export const draw = (game: Game): Game | null => {
  if (!game.stock.length && !game.waste.length) return null;
  const next = copy(game);
  if (!next.stock.length) {
    next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    next.waste = [];
    next.passes += 1;
    if (next.drawCount === 1) withScore(next, SCORES.passOne);
    else if (next.passes > FREE_PASSES_DRAW_THREE) withScore(next, SCORES.passThree);
  } else {
    const drawn = next.stock.splice(-next.drawCount).reverse();
    next.waste.push(...drawn.map((card) => ({ ...card, faceUp: true })));
  }
  next.moves += 1;
  return next;
};

// The cards a move would carry, if they may be picked up: the waste's top card, a foundation's top card, or a
// face-up card of the tableau with every card on it (in order, alternating colours).
export const cardsAt = (game: Game, from: Source): Card[] | null => {
  if (from.pile === "waste") return game.waste.length ? [game.waste[game.waste.length - 1]] : null;
  if (from.pile === "foundation") {
    const pile = game.foundations[from.index];
    return pile?.length ? [pile[pile.length - 1]] : null;
  }
  const pile = game.tableau[from.index];
  if (!pile || from.cardIndex < 0 || from.cardIndex >= pile.length) return null;
  const cards = pile.slice(from.cardIndex);
  const isRun = cards.every((card, i) => card.faceUp && (i === 0 || (card.rank === cards[i - 1].rank - 1 && colorOf(card.suit) !== colorOf(cards[i - 1].suit))));
  return isRun ? cards : null;
};

const fitsFoundation = (card: Card, pile: Card[]): boolean => {
  const top = pile[pile.length - 1];
  return top ? top.suit === card.suit && card.rank === top.rank + 1 : card.rank === 1;
};

const fitsTableau = (card: Card, pile: Card[]): boolean => {
  const top = pile[pile.length - 1];
  if (!top) return card.rank === RANKS;
  return top.faceUp && card.rank === top.rank - 1 && colorOf(card.suit) !== colorOf(top.suit);
};

const samePlace = (from: Source, to: Place): boolean => from.pile === to.pile && (from.pile === "waste" || ("index" in to && from.index === to.index));

export const move = (game: Game, from: Source, to: Place): Game | null => {
  if (game.won || to.pile === "waste" || samePlace(from, to)) return null;
  const cards = cardsAt(game, from);
  if (!cards) return null;
  if (to.pile === "foundation") {
    const pile = game.foundations[to.index];
    if (!pile || cards.length !== 1 || !fitsFoundation(cards[0], pile)) return null;
  } else {
    const pile = game.tableau[to.index];
    if (!pile || !fitsTableau(cards[0], pile)) return null;
  }
  const next = copy(game);
  // Takes the cards off their pile; a tableau card left face down is turned over.
  if (from.pile === "waste") next.waste.pop();
  else if (from.pile === "foundation") next.foundations[from.index].pop();
  else {
    const pile = next.tableau[from.index];
    pile.splice(from.cardIndex);
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) {
      pile[pile.length - 1] = { ...top, faceUp: true };
      withScore(next, SCORES.turnOver);
    }
  }
  if (to.pile === "foundation") {
    next.foundations[to.index].push(cards[0]);
    if (from.pile !== "foundation") withScore(next, SCORES.toFoundation);
  } else {
    next.tableau[to.index].push(...cards);
    if (from.pile === "waste") withScore(next, SCORES.wasteToTableau);
    if (from.pile === "foundation") withScore(next, SCORES.fromFoundation);
  }
  next.moves += 1;
  if (next.foundations.every((pile) => pile.length === RANKS)) {
    next.won = true;
    withScore(next, timeBonus(next.seconds));
  }
  return next;
};

// Where a tap or a double click sends a card: up to the foundations if it can go, otherwise onto a column (one with
// cards first; an empty one only for a king that isn't already at the bottom of its own column).
export const autoTarget = (game: Game, from: Source): Place | null => {
  const cards = cardsAt(game, from);
  if (!cards) return null;
  if (cards.length === 1 && from.pile !== "foundation") {
    const index = game.foundations.findIndex((pile) => fitsFoundation(cards[0], pile));
    if (index >= 0) return { pile: "foundation", index };
  }
  const columns = game.tableau.map((pile, index) => ({ pile, index })).filter(({ index }) => !(from.pile === "tableau" && from.index === index));
  const onCards = columns.find(({ pile }) => pile.length > 0 && fitsTableau(cards[0], pile));
  if (onCards) return { pile: "tableau", index: onCards.index };
  const isAlreadyAtBottom = from.pile === "tableau" && from.cardIndex === 0;
  const empty = columns.find(({ pile }) => pile.length === 0 && fitsTableau(cards[0], pile));
  return empty && !isAlreadyAtBottom ? { pile: "tableau", index: empty.index } : null;
};

// Nothing left hidden: every card can go up on its own, one after the other.
export const canFinish = (game: Game): boolean =>
  !game.won && !game.stock.length && !game.waste.length && game.tableau.every((pile) => pile.every((card) => card.faceUp));

// One card up to the foundations, the lowest first, for the finish.
export const finishStep = (game: Game): Game | null => {
  const tops = game.tableau
    .map((pile, index) => ({ card: pile[pile.length - 1], index }))
    .filter((top): top is { card: Card; index: number } => Boolean(top.card))
    .sort((a, b) => a.card.rank - b.card.rank);
  for (const { index } of tops) {
    const from: Source = { pile: "tableau", index, cardIndex: game.tableau[index].length - 1 };
    const to = autoTarget(game, from);
    if (to?.pile === "foundation") return move(game, from, to);
  }
  return null;
};

// A saved game that can be played on: 52 different cards, each where it may be. Anything else is dropped.
export const isPlayable = (value: unknown): value is Game => {
  if (typeof value !== "object" || value === null) return false;
  const game = value as Partial<Game>;
  const piles = [game.stock, game.waste, ...(game.foundations ?? []), ...(game.tableau ?? [])];
  if (!piles.every(Array.isArray) || game.foundations?.length !== 4 || game.tableau?.length !== 7) return false;
  const cards = (piles as Card[][]).flat();
  const ids = new Set(newDeck().map((card) => card.id));
  const isCard = (card: Card) =>
    typeof card === "object" && card !== null && ids.has(card.id) && card.id === `${card.suit}-${card.rank}` && typeof card.faceUp === "boolean";
  const numbers = [game.score, game.moves, game.passes, game.seconds];
  return (
    cards.length === 52 &&
    new Set(cards.map((card) => card?.id)).size === 52 &&
    cards.every(isCard) &&
    (game.drawCount === 1 || game.drawCount === 3) &&
    numbers.every((n) => Number.isFinite(n) && (n as number) >= 0) &&
    typeof game.won === "boolean"
  );
};
