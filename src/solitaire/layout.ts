// Where every card sits on the table, for a given size: the stock, the waste and the four foundations along the top,
// the seven columns below. Columns too long for the screen close up their cards so they always fit.
import type { Card, Game, Place } from "./klondike";

export interface CardSpot {
  x: number;
  y: number;
  z: number;
}

export interface Layout {
  cardWidth: number;
  cardHeight: number;
  gap: number;
  /** Where the columns start. */
  tableauTop: number;
  height: number;
  columnX: (column: number) => number;
  spots: Map<string, CardSpot>;
}

// Stacking order, low to high: the stock, the columns, the waste, the foundations.
const Z = { stock: 0, tableau: 100, waste: 200, foundation: 300 };
const FACE_DOWN_STEP = 0.11;
const FACE_UP_STEP = 0.27;
const SMALLEST_SQUEEZE = 0.3;
const WASTE_FAN = 0.3;

export const layoutFor = (game: Game, width: number, availableHeight: number): Layout => {
  const gap = Math.max(4, Math.round(width * 0.018));
  const cardWidth = (width - 6 * gap) / 7;
  const cardHeight = cardWidth * 1.4;
  const tableauTop = cardHeight + gap * 2;
  const columnX = (column: number) => column * (cardWidth + gap);
  const spots = new Map<string, CardSpot>();

  game.stock.forEach((card, i) => spots.set(card.id, { x: columnX(0), y: 0, z: Z.stock + i }));
  // With three at a time, the last three drawn fan out, the top one on the right.
  const fanned = game.drawCount === 3 ? Math.min(3, game.waste.length) : 1;
  game.waste.forEach((card, i) => {
    const fanIndex = Math.max(0, i - (game.waste.length - fanned));
    spots.set(card.id, { x: columnX(1) + fanIndex * cardWidth * WASTE_FAN, y: 0, z: Z.waste + i });
  });
  game.foundations.forEach((pile, f) => pile.forEach((card, i) => spots.set(card.id, { x: columnX(3 + f), y: 0, z: Z.foundation + i })));

  const room = Math.max(cardHeight, availableHeight - tableauTop - gap);
  let height = tableauTop + cardHeight;
  game.tableau.forEach((pile, column) => {
    const steps = pile.slice(0, -1).map((card) => (card.faceUp ? FACE_UP_STEP : FACE_DOWN_STEP) * cardHeight);
    const total = steps.reduce((sum, step) => sum + step, 0);
    const squeeze = total > 0 ? Math.min(1, Math.max(SMALLEST_SQUEEZE, (room - cardHeight) / total)) : 1;
    let y = tableauTop;
    pile.forEach((card, i) => {
      spots.set(card.id, { x: columnX(column), y, z: Z.tableau + i });
      if (i < steps.length) y += steps[i] * squeeze;
    });
    height = Math.max(height, y + cardHeight);
  });
  return { cardWidth, cardHeight, gap, tableauTop, height, columnX, spots };
};

// The pile a card was dropped on, from where the middle of the dragged card ends up: along the top, the foundations
// (above the stock and the waste, nothing); below, the nearest column.
export const dropPlace = (layout: Layout, centerX: number, centerY: number): Place | null => {
  const column = Math.min(6, Math.max(0, Math.round((centerX - layout.cardWidth / 2) / (layout.cardWidth + layout.gap))));
  if (centerY < layout.tableauTop - layout.gap / 2) return column >= 3 ? { pile: "foundation", index: column - 3 } : null;
  return { pile: "tableau", index: column };
};

export type Location =
  | { pile: "stock" }
  | { pile: "waste" }
  | { pile: "foundation"; index: number }
  | { pile: "tableau"; index: number; cardIndex: number };

export const locate = (game: Game, cardId: string): Location | null => {
  const has = (pile: Card[]) => pile.findIndex((card) => card.id === cardId);
  if (has(game.stock) >= 0) return { pile: "stock" };
  if (has(game.waste) >= 0) return { pile: "waste" };
  const foundation = game.foundations.findIndex((pile) => has(pile) >= 0);
  if (foundation >= 0) return { pile: "foundation", index: foundation };
  for (let index = 0; index < game.tableau.length; index++) {
    const cardIndex = has(game.tableau[index]);
    if (cardIndex >= 0) return { pile: "tableau", index, cardIndex };
  }
  return null;
};
