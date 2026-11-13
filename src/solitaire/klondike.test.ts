import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import {
  autoTarget, canFinish, cardsAt, colorOf, deal, draw, finishStep, isPlayable, move, newDeck, SCORES, timeBonus,
  type Card, type Game, type Suit,
} from "./klondike";

const card = (suit: Suit, rank: number, faceUp = true): Card => ({ id: `${suit}-${rank}`, suit, rank, faceUp });

// An empty table to set up by hand; the deck's other cards wait in the stock so the game stays one of 52 cards.
const table = (setup: Partial<Game>): Game => {
  const game: Game = {
    stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []],
    drawCount: 1, score: 0, moves: 0, passes: 0, seconds: 0, won: false, ...setup,
  };
  const used = new Set([game.stock, game.waste, ...game.foundations, ...game.tableau].flat().map((c) => c.id));
  if (!setup.stock) game.stock = newDeck().filter((c) => !used.has(c.id));
  return game;
};

describe("dealing", () => {
  it("lays seven columns of 1 to 7 cards, the last one turned up, and 24 cards in the stock", () => {
    const game = deal(1, seededRandom(1));
    expect(game.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    game.tableau.forEach((pile) => {
      expect(pile.at(-1)?.faceUp).toBe(true);
      expect(pile.slice(0, -1).every((c) => !c.faceUp)).toBe(true);
    });
    expect(game.stock).toHaveLength(24);
    expect(isPlayable(game)).toBe(true);
  });

  it("shuffles differently from one game to the next, the same way for the same seed", () => {
    expect(deal(1, seededRandom(1))).toEqual(deal(1, seededRandom(1)));
    expect(deal(1, seededRandom(1)).stock).not.toEqual(deal(1, seededRandom(2)).stock);
  });

  it("has two colours: tomatoes and salami, basil and olives", () => {
    expect(["tomato", "salami", "basil", "olive"].map((suit) => colorOf(suit as Suit))).toEqual(["red", "red", "green", "green"]);
  });
});

describe("the stock", () => {
  it("turns one card at a time, or three, and goes back over when empty, at a cost", () => {
    let one = deal(1, seededRandom(3));
    one = draw(one)!;
    expect(one.waste).toHaveLength(1);
    expect(one.waste[0].faceUp).toBe(true);
    expect(one.moves).toBe(1);
    let three = draw(deal(3, seededRandom(3)))!;
    expect(three.waste).toHaveLength(3);
    for (let i = 0; i < 7; i++) three = draw(three)!;
    expect(three.stock).toHaveLength(0);
    const order = three.waste.map((c) => c.id);
    three = draw({ ...three, score: 50 })!;
    expect(three.waste).toHaveLength(0);
    expect(three.stock.every((c) => !c.faceUp)).toBe(true);
    // Drawn again, the cards come in the same order.
    for (let i = 0; i < 8; i++) three = draw(three)!;
    expect(three.waste.map((c) => c.id)).toEqual(order);
    expect(three.score).toBe(50);
  });

  it("costs 100 points a pass with one card, 20 from the fourth pass with three, never below zero", () => {
    const recycled = (drawCount: 1 | 3, passes: number) => draw(table({ drawCount, stock: [], waste: [card("tomato", 5)], score: 150, passes }))!;
    expect(recycled(1, 0).score).toBe(150 + SCORES.passOne);
    expect(recycled(3, 0).score).toBe(150);
    expect(recycled(3, 3).score).toBe(150 + SCORES.passThree);
    expect(draw(table({ drawCount: 1, stock: [], waste: [card("tomato", 5)], score: 30 }))!.score).toBe(0);
    expect(draw(table({ stock: [], waste: [] }))).toBeNull();
  });
});

describe("moves", () => {
  it("build down the columns in alternating colours, a king alone on an empty column", () => {
    const game = table({ tableau: [[card("tomato", 9)], [card("basil", 8)], [card("salami", 8)], [], [card("olive", 13)], [], []] });
    expect(move(game, { pile: "tableau", index: 1, cardIndex: 0 }, { pile: "tableau", index: 0 })).not.toBeNull();
    expect(move(game, { pile: "tableau", index: 2, cardIndex: 0 }, { pile: "tableau", index: 0 })).toBeNull();
    expect(move(game, { pile: "tableau", index: 1, cardIndex: 0 }, { pile: "tableau", index: 3 })).toBeNull();
    expect(move(game, { pile: "tableau", index: 4, cardIndex: 0 }, { pile: "tableau", index: 3 })?.tableau[3]).toEqual([card("olive", 13)]);
  });

  it("carry a run of cards together, and turn over the card left face down (+5)", () => {
    const game = table({
      tableau: [[card("salami", 2, false), card("tomato", 7), card("olive", 6), card("salami", 5)], [card("basil", 8)], [], [], [], [], []],
    });
    expect(cardsAt(game, { pile: "tableau", index: 0, cardIndex: 0 })).toBeNull();
    const next = move(game, { pile: "tableau", index: 0, cardIndex: 1 }, { pile: "tableau", index: 1 })!;
    expect(next.tableau[1].map((c) => c.rank)).toEqual([8, 7, 6, 5]);
    expect(next.tableau[0]).toEqual([card("salami", 2, true)]);
    expect(next.score).toBe(SCORES.turnOver);
    expect(next.moves).toBe(1);
    // The game given is left as it was.
    expect(game.tableau[0]).toHaveLength(4);
  });

  it("go up the foundations by suit from the ace, one card at a time", () => {
    const game = table({ waste: [card("tomato", 1)], tableau: [[card("tomato", 2)], [card("basil", 2)], [], [], [], [], []] });
    const ace = move(game, { pile: "waste" }, { pile: "foundation", index: 2 })!;
    expect(ace.score).toBe(SCORES.toFoundation);
    expect(move(ace, { pile: "tableau", index: 1, cardIndex: 0 }, { pile: "foundation", index: 2 })).toBeNull();
    const two = move(ace, { pile: "tableau", index: 0, cardIndex: 0 }, { pile: "foundation", index: 2 })!;
    expect(two.foundations[2].map((c) => c.id)).toEqual(["tomato-1", "tomato-2"]);
    expect(two.score).toBe(2 * SCORES.toFoundation);
    expect(move(game, { pile: "tableau", index: 0, cardIndex: 0 }, { pile: "foundation", index: 0 })).toBeNull();
  });

  it("score the classic way: +5 from the waste to a column, −15 back down from a foundation", () => {
    const game = table({ waste: [card("basil", 8)], foundations: [[card("olive", 1), card("olive", 2), card("olive", 3), card("olive", 4)], [], [], []], tableau: [[card("tomato", 9)], [card("salami", 5)], [], [], [], [], []], score: 40 });
    expect(move(game, { pile: "waste" }, { pile: "tableau", index: 0 })!.score).toBe(40 + SCORES.wasteToTableau);
    expect(move(game, { pile: "foundation", index: 0 }, { pile: "tableau", index: 1 })!.score).toBe(40 + SCORES.fromFoundation);
  });

  it("win once all four foundations are full, with a time bonus", () => {
    const full = (suit: Suit, upTo: number) => Array.from({ length: upTo }, (_, i) => card(suit, i + 1));
    const game = table({ stock: [], foundations: [full("tomato", 13), full("salami", 13), full("basil", 13), full("olive", 12)], tableau: [[card("olive", 13)], [], [], [], [], [], []], seconds: 140, score: 500 });
    const won = move(game, { pile: "tableau", index: 0, cardIndex: 0 }, { pile: "foundation", index: 3 })!;
    expect(won.won).toBe(true);
    expect(won.score).toBe(500 + SCORES.toFoundation + timeBonus(140));
    expect(timeBonus(140)).toBe(5000);
    expect(timeBonus(20)).toBe(0);
    expect(move(won, { pile: "foundation", index: 3 }, { pile: "tableau", index: 0 })).toBeNull();
  });
});

describe("a tap or a double click", () => {
  it("sends a card up to the foundations first, otherwise onto a column with cards, otherwise a king to an empty one", () => {
    const game = table({
      waste: [card("basil", 1)],
      foundations: [[card("salami", 1)], [], [], []],
      tableau: [[card("tomato", 9)], [card("olive", 8)], [], [card("salami", 2)], [card("olive", 13, false), card("basil", 13)], [card("tomato", 13)], [card("basil", 5)]],
    });
    expect(autoTarget(game, { pile: "waste" })).toEqual({ pile: "foundation", index: 1 });
    expect(autoTarget(game, { pile: "tableau", index: 3, cardIndex: 0 })).toEqual({ pile: "foundation", index: 0 });
    expect(autoTarget(game, { pile: "tableau", index: 1, cardIndex: 0 })).toEqual({ pile: "tableau", index: 0 });
    expect(autoTarget(game, { pile: "tableau", index: 4, cardIndex: 1 })).toEqual({ pile: "tableau", index: 2 });
    // A king already at the bottom of its column stays; a card with nowhere to go too.
    expect(autoTarget(game, { pile: "tableau", index: 5, cardIndex: 0 })).toBeNull();
    expect(autoTarget(game, { pile: "tableau", index: 6, cardIndex: 0 })).toBeNull();
  });
});

describe("the finish", () => {
  it("puts every card up on its own once nothing is hidden, and wins", () => {
    const suits = ["tomato", "salami", "basil", "olive"] as const;
    // Four columns, each one suit from king down to ace, all face up.
    const tableau = [...suits.map((suit) => Array.from({ length: 13 }, (_, i) => card(suit, 13 - i))), [], [], []];
    let game = table({ stock: [], tableau });
    expect(canFinish(game)).toBe(true);
    let steps = 0;
    while (!game.won) {
      game = finishStep(game)!;
      steps += 1;
    }
    expect(steps).toBe(52);
    expect(game.foundations.every((pile) => pile.length === 13)).toBe(true);
    expect(canFinish(deal(1, seededRandom(5)))).toBe(false);
  });

  it("plays whole games by itself without ever breaking a rule (52 cards, one of each, all the time)", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = seededRandom(seed);
      let game = deal(seed % 2 ? 1 : 3, random);
      for (let step = 0; step < 600 && !game.won; step++) {
        expect(isPlayable(game)).toBe(true);
        if (canFinish(game)) {
          game = finishStep(game) ?? game;
          continue;
        }
        const sources = [
          { pile: "waste" } as const,
          ...game.tableau.flatMap((pile, index) => pile.map((_, cardIndex) => ({ pile: "tableau", index, cardIndex }) as const)),
        ];
        const moves = sources.map((from) => ({ from, to: autoTarget(game, from) })).filter((m) => m.to);
        const pick = moves[Math.floor(random() * moves.length)];
        const next = pick && random() < 0.8 ? move(game, pick.from, pick.to!) : draw(game);
        if (!next) break;
        expect(next.score).toBeGreaterThanOrEqual(0);
        expect(next.moves).toBe(game.moves + 1);
        game = next;
      }
    }
  }, 30_000);
});

describe("saved games", () => {
  it("are kept only when they hold 52 different cards and sensible numbers", () => {
    const game = deal(3, seededRandom(9));
    expect(isPlayable(JSON.parse(JSON.stringify(game)))).toBe(true);
    expect(isPlayable({ ...game, stock: game.stock.slice(1) })).toBe(false);
    expect(isPlayable({ ...game, stock: [...game.stock.slice(1), game.waste[0] ?? game.tableau[0][0]] })).toBe(false);
    expect(isPlayable({ ...game, score: -5 })).toBe(false);
    expect(isPlayable({ ...game, drawCount: 2 })).toBe(false);
    expect(isPlayable(null)).toBe(false);
    expect(isPlayable("nope")).toBe(false);
  });
});
