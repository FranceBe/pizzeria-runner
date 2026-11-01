// Help: the next move that gets the game somewhere, and whether there is none at all.
//
// The game gets somewhere when a card goes up to the foundations or a face-down card is turned over. From the game as
// it is, a search tries every sequence of moves and draws (going through the stock as many times as it takes, the
// cards it shuffles between columns too), never twice from the same position, until one of them gets somewhere: its
// first step is the hint. When none does, whatever is tried, the game is stuck. The search stops after a few thousand
// positions; past that, the game is never called stuck.
import { cardsAt, draw, move, type Card, type Game, type Place, type Source } from "./klondike";

export type Hint =
  | { kind: "move"; from: Source; to: Place }
  | { kind: "draw" }
  /** Nothing gets the game anywhere, even going through the whole stock. */
  | { kind: "stuck" }
  /** Too many positions to be sure: not stuck, and the hint is just something to try (a draw, or a move). */
  | { kind: "unsure"; fallback: Step | null };

export type Step = { kind: "move"; from: Source; to: Place } | { kind: "draw" };

const MAX_POSITIONS = 6000;

const faceDownCount = (game: Game): number => game.tableau.reduce((sum, pile) => sum + pile.filter((card) => !card.faceUp).length, 0);
const foundationCount = (game: Game): number => game.foundations.reduce((sum, pile) => sum + pile.length, 0);

const ids = (cards: Card[]) => cards.map((card) => (card.faceUp ? card.id : `~${card.id}`)).join(",");
const positionKey = (game: Game): string =>
  [ids(game.stock), ids(game.waste), ...game.foundations.map((pile) => pile.length), ...game.tableau.map(ids)].join("|");

// Every move that might lead somewhere: not a king that already heads an empty column going to another, nor a card
// going from one foundation to another.
const stepsFrom = (game: Game): { step: Step; next: Game }[] => {
  const steps: { step: Step; next: Game }[] = [];
  // A card taken back down from a foundation comes last: it is rarely the move to suggest first.
  const sources: Source[] = [
    { pile: "waste" },
    ...game.tableau.flatMap((pile, index) =>
      pile.map((card, cardIndex) => ({ card, source: { pile: "tableau", index, cardIndex } as const }))
        .filter(({ card }) => card.faceUp)
        .map(({ source }) => source),
    ),
    ...game.foundations.map((_, index) => ({ pile: "foundation", index }) as const),
  ];
  for (const from of sources) {
    const cards = cardsAt(game, from);
    if (!cards) continue;
    const isLoneKingAtBottom = from.pile === "tableau" && from.cardIndex === 0;
    const targets: Place[] = [
      ...(from.pile === "foundation" ? [] : game.foundations.map((_, index) => ({ pile: "foundation", index }) as const)),
      ...game.tableau.map((_, index) => ({ pile: "tableau", index }) as const).filter(({ index }) => !(isLoneKingAtBottom && !game.tableau[index].length)),
    ];
    for (const to of targets) {
      const next = move(game, from, to);
      if (next) steps.push({ step: { kind: "move", from, to }, next });
    }
  }
  const drawn = draw(game);
  if (drawn) steps.push({ step: { kind: "draw" }, next: drawn });
  return steps;
};

// When the search can't tell: a draw if there is a stock, otherwise the first move there is.
const somethingToTry = (game: Game): Step | null => {
  const steps = stepsFrom(game).map(({ step }) => step);
  return steps.find((step) => step.kind === "draw") ?? steps[0] ?? null;
};

export const findHint = (game: Game, maxPositions = MAX_POSITIONS): Hint => {
  if (game.won) return { kind: "stuck" };
  const startFaceDown = faceDownCount(game);
  const startFoundations = foundationCount(game);
  const getsSomewhere = (next: Game) => next.won || faceDownCount(next) < startFaceDown || foundationCount(next) > startFoundations;
  const seen = new Set([positionKey(game)]);
  // Breadth first, so the hint is the first step of the shortest way forward.
  let frontier: { game: Game; first: Step | null }[] = [{ game, first: null }];
  while (frontier.length) {
    const nextFrontier: { game: Game; first: Step | null }[] = [];
    for (const { game: position, first } of frontier) {
      for (const { step, next } of stepsFrom(position)) {
        const firstStep = first ?? step;
        if (getsSomewhere(next)) return firstStep;
        const key = positionKey(next);
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > maxPositions) return { kind: "unsure", fallback: somethingToTry(game) };
        nextFrontier.push({ game: next, first: firstStep });
      }
    }
    frontier = nextFrontier;
  }
  return { kind: "stuck" };
};
