import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import { canFinish, deal, draw, finishStep, move, type Card, type Game, type Suit } from "./klondike";
import { findHint } from "./hint";

const up = (suit: Suit, rank: number): Card => ({ id: `${suit}-${rank}`, suit, rank, faceUp: true });
const down = (suit: Suit, rank: number): Card => ({ ...up(suit, rank), faceUp: false });
const game = (setup: Partial<Game>): Game => ({
  stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []],
  drawCount: 1, score: 0, moves: 0, passes: 0, seconds: 0, won: false, ...setup,
});

// Every column taken, nothing fits anywhere, and nothing in the stock fits either.
const stuckTableau = (): Card[][] => [
  [down("basil", 2), up("tomato", 5)],
  [up("olive", 13)], [up("basil", 13)], [up("tomato", 13)], [up("salami", 13)],
  [down("olive", 3), up("salami", 7)],
  [down("tomato", 3), up("olive", 10)],
];

describe("help", () => {
  it("points at a card that can go up to the foundations", () => {
    const hint = findHint(game({ stock: [up("basil", 9)], tableau: [[down("olive", 4), up("tomato", 1)], ...stuckTableau().slice(1)] }));
    expect(hint).toEqual({ kind: "move", from: { pile: "tableau", index: 0, cardIndex: 1 }, to: { pile: "foundation", index: 0 } });
  });

  it("points at a run to move when it turns a card over", () => {
    const tableau = stuckTableau();
    tableau[0] = [down("basil", 2), up("olive", 9)];
    tableau[5] = [down("olive", 3), up("salami", 7)];
    tableau[6] = [down("tomato", 3), up("salami", 10)];
    expect(findHint(game({ tableau }))).toEqual({ kind: "move", from: { pile: "tableau", index: 0, cardIndex: 1 }, to: { pile: "tableau", index: 6 } });
  });

  it("says to draw when the card that helps is somewhere in the stock, even deep down or in the waste", () => {
    const deep = game({ stock: [up("tomato", 1), down("basil", 9), down("tomato", 8), down("salami", 12)].map((c) => ({ ...c, faceUp: false })), tableau: stuckTableau() });
    expect(findHint(deep)).toEqual({ kind: "draw" });
    // Already gone by in the waste: the stock has to go round again.
    const passed = game({ stock: [], waste: [up("tomato", 1), up("basil", 9)], tableau: stuckTableau() });
    expect(findHint(passed)).toEqual({ kind: "draw" });
  });

  it("finds a card reachable only every third draw, and not one that never comes up", () => {
    const stock = (cards: Card[]) => cards.map((c) => ({ ...c, faceUp: false }));
    // Drawing three, from the end of the stock: the third card drawn is the one showing.
    const reachable = game({ drawCount: 3, stock: stock([up("basil", 9), up("tomato", 1), up("tomato", 8), up("salami", 12)]), tableau: stuckTableau() });
    expect(findHint(reachable)).toEqual({ kind: "draw" });
  });

  it("calls the game stuck only when nothing gets anywhere, the stock gone through and every shuffle tried", () => {
    const stuck = game({ stock: [down("basil", 9), down("tomato", 8)], tableau: stuckTableau() });
    expect(findHint(stuck)).toEqual({ kind: "stuck" });
    expect(findHint({ ...stuck, drawCount: 3 })).toEqual({ kind: "stuck" });
    // A move is possible (the 9 of basil onto a red 10) but leads nowhere: still stuck.
    const tableau = stuckTableau();
    tableau[6] = [up("salami", 10)];
    tableau[5] = [up("basil", 13)];
    const pointless = game({ stock: [down("tomato", 8)], waste: [], tableau: [...tableau.slice(0, 5), tableau[5], [up("tomato", 10), up("basil", 9)]] });
    expect(findHint(pointless).kind).toBe("stuck");
    // Not when the help is a few steps away.
    expect(findHint(game({ stock: [down("basil", 9), down("tomato", 1)], tableau: stuckTableau() }))).toEqual({ kind: "draw" });
  });

  it("gives up being sure past a limit, rather than calling a game stuck", () => {
    expect(findHint(game({ stock: [down("basil", 9), down("tomato", 8)], tableau: stuckTableau() }), 2)).toEqual({ kind: "unsure", fallback: { kind: "draw" } });
  });

  it("only ever suggests legal moves, and following it plays games through (40 deals)", () => {
    let wins = 0;
    let stuck = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let current = deal(seed % 3 ? 1 : 3, seededRandom(seed));
      for (let step = 0; step < 400 && !current.won; step++) {
        if (canFinish(current)) {
          current = finishStep(current) ?? current;
          continue;
        }
        const hint = findHint(current, 3000);
        if (hint.kind === "stuck" || hint.kind === "unsure") {
          stuck += hint.kind === "stuck" ? 1 : 0;
          break;
        }
        const next = hint.kind === "draw" ? draw(current) : move(current, hint.from, hint.to);
        expect(next, `seed ${seed} step ${step}`).not.toBeNull();
        current = next!;
      }
      if (current.won) wins += 1;
    }
    // A greedy player wins some deals and gets stuck in others; both happen.
    expect(wins).toBeGreaterThan(0);
    expect(stuck).toBeGreaterThan(0);
  }, 60_000);
});
