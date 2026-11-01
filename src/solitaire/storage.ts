// What the solitaire keeps on the device, under one small key: the options, the game being played (so a reload or
// a closed tab picks it up where it was) and the records for each way of drawing. A few kilobytes at most.
import { isPlayable, type DrawCount, type Game } from "./klondike";

export const STORAGE_KEY = "forno-lento-solitaire-v1";

export interface Records {
  wins: number;
  bestScore: number;
  fewestMoves: number | null;
  fastest: number | null;
}

export interface SolitaireSave {
  drawCount: DrawCount;
  tapToSend: boolean;
  game: Game | null;
  records: Record<"draw1" | "draw3", Records>;
}

const noRecords = (): Records => ({ wins: 0, bestScore: 0, fewestMoves: null, fastest: null });

export const emptySave = (): SolitaireSave => ({ drawCount: 1, tapToSend: true, game: null, records: { draw1: noRecords(), draw3: noRecords() } });

const count = (value: unknown, fallback: number | null): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;

const readRecords = (value: unknown): Records => {
  const saved = (typeof value === "object" && value !== null ? value : {}) as Partial<Records>;
  return {
    wins: count(saved.wins, 0) ?? 0,
    bestScore: count(saved.bestScore, 0) ?? 0,
    fewestMoves: count(saved.fewestMoves, null),
    fastest: count(saved.fastest, null),
  };
};

// Whatever is stored, read with care: anything missing or odd falls back to its default.
export const parseSave = (raw: string | null): SolitaireSave => {
  const save = emptySave();
  try {
    const saved = JSON.parse(raw ?? "null") as Partial<Record<keyof SolitaireSave, unknown>> | null;
    if (!saved || typeof saved !== "object") return save;
    const records = (saved.records ?? {}) as Record<string, unknown>;
    return {
      drawCount: saved.drawCount === 3 ? 3 : 1,
      tapToSend: saved.tapToSend !== false,
      game: isPlayable(saved.game) && !saved.game.won ? saved.game : null,
      records: { draw1: readRecords(records.draw1), draw3: readRecords(records.draw3) },
    };
  } catch {
    return save;
  }
};

export const loadSave = (): SolitaireSave => {
  try {
    return parseSave(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptySave();
  }
};

export const writeSave = (save: SolitaireSave): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Private browsing or a full storage: the game simply isn't kept.
  }
};

export const recordsKey = (drawCount: DrawCount): "draw1" | "draw3" => (drawCount === 1 ? "draw1" : "draw3");

// A won game's place in the records. Returns the new records and whether the score is a new best.
export const withWin = (records: Records, game: Game): { records: Records; isNewBest: boolean } => ({
  records: {
    wins: records.wins + 1,
    bestScore: Math.max(records.bestScore, game.score),
    fewestMoves: records.fewestMoves === null ? game.moves : Math.min(records.fewestMoves, game.moves),
    fastest: records.fastest === null ? game.seconds : Math.min(records.fastest, game.seconds),
  },
  isNewBest: game.score > records.bestScore,
});
