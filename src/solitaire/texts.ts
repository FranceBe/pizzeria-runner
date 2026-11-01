// The solitaire's few words, in the three languages of the game. The language is Forno Lento's, when the player has a
// pizzeria on this device, otherwise the browser's.
import type { Suit } from "./klondike";

export type SolitaireLanguage = "fr" | "en" | "zh";

const FR = {
  htmlLang: "fr",
  title: "Solitaire",
  subtitle: "de Forno Lento",
  score: "Points",
  moves: "Coups",
  time: "Temps",
  best: "Record",
  newGame: "Nouvelle partie",
  confirmNewGame: "Abandonner ?",
  undo: "Annuler",
  options: "Options",
  close: "Fermer",
  drawLabel: "Pioche",
  drawOne: "1 carte",
  drawThree: "3 cartes",
  drawNextGame: "S'applique à la prochaine partie.",
  tapToSend: "Un tap (ou un double-clic) envoie la carte au bon endroit",
  records: "Records",
  recordsFor: (draw: number) => `Pioche ${draw === 1 ? "1 carte" : "3 cartes"}`,
  wins: "Parties gagnées",
  bestScore: "Meilleur score",
  fewestMoves: "Moins de coups",
  fastest: "Plus rapide",
  none: "—",
  won: "Gagné !",
  newRecord: "Nouveau record !",
  timeBonus: "Bonus de temps",
  playAgain: "Rejouer",
  rulesTitle: "Les points",
  rules: [
    "Pioche → colonne : +5",
    "Vers les fondations : +10",
    "Carte retournée dans une colonne : +5",
    "Fondation → colonne : −15",
    "Repasser la pioche : −100 (1 carte), −20 dès le 4ᵉ tour (3 cartes)",
    "À la victoire, bonus de temps : 700 000 ÷ secondes (dès 30 s)",
  ],
  backToGame: "← Forno Lento",
  ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R"],
  suits: { tomato: "tomate", salami: "salami", basil: "basilic", olive: "olive" } satisfies Record<Suit, string>,
  cardName: (rank: string, suit: string) => `${rank} ${suit}`,
  stock: "Pioche",
  emptyStock: "Repasser la pioche",
};

export type SolitaireTexts = typeof FR;

const EN: SolitaireTexts = {
  htmlLang: "en",
  title: "Solitaire",
  subtitle: "by Forno Lento",
  score: "Score",
  moves: "Moves",
  time: "Time",
  best: "Best",
  newGame: "New game",
  confirmNewGame: "Give up?",
  undo: "Undo",
  options: "Options",
  close: "Close",
  drawLabel: "Draw",
  drawOne: "1 card",
  drawThree: "3 cards",
  drawNextGame: "Applies to the next game.",
  tapToSend: "A tap (or a double click) sends the card where it goes",
  records: "Records",
  recordsFor: (draw: number) => `Draw ${draw === 1 ? "1 card" : "3 cards"}`,
  wins: "Games won",
  bestScore: "Best score",
  fewestMoves: "Fewest moves",
  fastest: "Fastest",
  none: "—",
  won: "You won!",
  newRecord: "New record!",
  timeBonus: "Time bonus",
  playAgain: "Play again",
  rulesTitle: "Scoring",
  rules: [
    "Stock → column: +5",
    "To the foundations: +10",
    "Card turned over in a column: +5",
    "Foundation → column: −15",
    "Going through the stock again: −100 (1 card), −20 from the 4th pass (3 cards)",
    "On a win, a time bonus: 700,000 ÷ seconds (from 30 s)",
  ],
  backToGame: "← Forno Lento",
  ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
  suits: { tomato: "tomatoes", salami: "salami", basil: "basil", olive: "olives" },
  cardName: (rank: string, suit: string) => `${rank} of ${suit}`,
  stock: "Stock",
  emptyStock: "Turn the stock over",
};

const ZH: SolitaireTexts = {
  htmlLang: "zh",
  title: "接龙",
  subtitle: "Forno Lento 出品",
  score: "分数",
  moves: "步数",
  time: "时间",
  best: "最高分",
  newGame: "新游戏",
  confirmNewGame: "放弃本局？",
  undo: "撤销",
  options: "选项",
  close: "关闭",
  drawLabel: "翻牌",
  drawOne: "1 张",
  drawThree: "3 张",
  drawNextGame: "下一局生效。",
  tapToSend: "轻点（或双击）把牌送到该去的地方",
  records: "纪录",
  recordsFor: (draw: number) => `每次翻 ${draw} 张`,
  wins: "胜局",
  bestScore: "最高分",
  fewestMoves: "最少步数",
  fastest: "最快",
  none: "—",
  won: "赢了！",
  newRecord: "新纪录！",
  timeBonus: "时间奖励",
  playAgain: "再来一局",
  rulesTitle: "计分",
  rules: [
    "牌堆 → 牌列：+5",
    "放上基础堆：+10",
    "翻开牌列中的牌：+5",
    "基础堆 → 牌列：−15",
    "重新翻牌堆：−100（翻 1 张），第 4 轮起 −20（翻 3 张）",
    "获胜时的时间奖励：700 000 ÷ 秒数（30 秒起）",
  ],
  backToGame: "← Forno Lento",
  ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
  suits: { tomato: "番茄", salami: "萨拉米", basil: "罗勒", olive: "橄榄" },
  cardName: (rank: string, suit: string) => `${suit} ${rank}`,
  stock: "牌堆",
  emptyStock: "重新翻牌堆",
};

export const TEXTS: Record<SolitaireLanguage, SolitaireTexts> = { fr: FR, en: EN, zh: ZH };

const isLanguage = (value: unknown): value is SolitaireLanguage => value === "fr" || value === "en" || value === "zh";

// Forno Lento's language on this device, or the browser's (French, Chinese, otherwise English).
export const pickLanguage = (gameSave: string | null, browserLanguage: string): SolitaireLanguage => {
  try {
    const language = (JSON.parse(gameSave ?? "null") as { settings?: { language?: unknown } } | null)?.settings?.language;
    if (isLanguage(language)) return language;
  } catch {
    // Not a save we can read: the browser decides.
  }
  const browser = browserLanguage.slice(0, 2).toLowerCase();
  return isLanguage(browser) ? browser : "en";
};
