import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { seededRandom } from "../utils/random";
import { deal, draw, type Game } from "./klondike";
import { dropPlace, layoutFor, locate } from "./layout";
import { emptySave, parseSave, withWin } from "./storage";
import { pickLanguage, TEXTS } from "./texts";
import { formatTime, Solitaire } from "./Solitaire";

describe("the table's layout", () => {
  it("places seven columns across the width, the top row above, every card somewhere", () => {
    const game = deal(1, seededRandom(4));
    const layout = layoutFor(game, 358, 640);
    expect(layout.cardWidth * 7 + layout.gap * 6).toBeCloseTo(358);
    expect(layout.spots.size).toBe(52);
    const last = game.tableau[6].at(-1)!;
    expect(layout.spots.get(last.id)?.x).toBeCloseTo(layout.columnX(6));
    expect(layout.spots.get(last.id)!.y).toBeGreaterThan(layout.tableauTop);
  });

  it("fans the last three cards of the waste when drawing three", () => {
    const game = draw(deal(3, seededRandom(4)))!;
    const layout = layoutFor(game, 700, 800);
    const xs = game.waste.map((card) => layout.spots.get(card.id)!.x);
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[2]).toBeGreaterThan(xs[1]);
  });

  it("closes up a long column so it fits the screen", () => {
    const game = deal(1, seededRandom(4));
    const long: Game = { ...game, tableau: game.tableau.map((pile, i) => (i === 0 ? [...pile, ...game.stock.slice(0, 18).map((c) => ({ ...c, faceUp: true }))] : pile)), stock: game.stock.slice(18) };
    const roomy = layoutFor(long, 358, 2000);
    const tight = layoutFor(long, 358, 360);
    expect(tight.height).toBeLessThanOrEqual(360);
    expect(tight.height).toBeLessThan(roomy.height);
  });

  it("finds where a card was dropped: a foundation along the top, a column below, nothing over the stock", () => {
    const layout = layoutFor(deal(1, seededRandom(4)), 700, 800);
    const middle = (column: number, y: number) => [layout.columnX(column) + layout.cardWidth / 2, y] as const;
    expect(dropPlace(layout, ...middle(5, 20))).toEqual({ pile: "foundation", index: 2 });
    expect(dropPlace(layout, ...middle(1, 20))).toBeNull();
    expect(dropPlace(layout, ...middle(2, layout.tableauTop + 200))).toEqual({ pile: "tableau", index: 2 });
  });

  it("knows where each card is", () => {
    const game = deal(1, seededRandom(4));
    expect(locate(game, game.stock[0].id)).toEqual({ pile: "stock" });
    expect(locate(game, game.tableau[3][2].id)).toEqual({ pile: "tableau", index: 3, cardIndex: 2 });
    expect(locate(game, "nope")).toBeNull();
  });
});

describe("what is kept on the device", () => {
  it("reads back a save, and anything broken as a fresh start", () => {
    const game = deal(3, seededRandom(2));
    const save = { ...emptySave(), drawCount: 3, tapToSend: false, game };
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    expect(parseSave("{not json")).toEqual(emptySave());
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave(JSON.stringify({ drawCount: 7, game: { stock: [] }, records: { draw1: { wins: -3, bestScore: "lots" } } }))).toEqual(emptySave());
  });

  it("stays small: a game under way and the records are a few kilobytes", () => {
    const save = { ...emptySave(), game: deal(1, seededRandom(2)) };
    expect(JSON.stringify(save).length).toBeLessThan(6000);
  });

  it("keeps the best score, the fewest moves and the fastest win, and counts the wins", () => {
    const won = { ...deal(1, seededRandom(2)), score: 3000, moves: 120, seconds: 300, won: true };
    const first = withWin(emptySave().records.draw1, won);
    expect(first).toEqual({ records: { wins: 1, bestScore: 3000, fewestMoves: 120, fastest: 300 }, isNewBest: true });
    const second = withWin(first.records, { ...won, score: 2500, moves: 100, seconds: 400 });
    expect(second).toEqual({ records: { wins: 2, bestScore: 3000, fewestMoves: 100, fastest: 300 }, isNewBest: false });
  });
});

describe("the page", () => {
  it("speaks Forno Lento's language on this device, otherwise the browser's", () => {
    expect(pickLanguage(JSON.stringify({ settings: { language: "zh" } }), "fr-FR")).toBe("zh");
    expect(pickLanguage(null, "fr-CA")).toBe("fr");
    expect(pickLanguage("garbage", "de-DE")).toBe("en");
  });

  it("has every text in every language, with a name for each rank", () => {
    const keys = Object.keys(TEXTS.fr).sort();
    Object.values(TEXTS).forEach((texts) => {
      expect(Object.keys(texts).sort()).toEqual(keys);
      expect(texts.ranks).toHaveLength(13);
      expect(texts.rules).toHaveLength(TEXTS.fr.rules.length);
    });
  });

  it("renders in every language", () => {
    Object.values(TEXTS).forEach((texts) => {
      const html = renderToString(<Solitaire texts={texts} />);
      expect(html).toContain(texts.newGame);
      expect(html).toContain(texts.backToGame);
    });
  });

  it("shows the time as minutes and seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(251)).toBe("4:11");
    expect(formatTime(3725)).toBe("1:02:05");
  });
});
