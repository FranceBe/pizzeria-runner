// Duo pizzerias: whole pizzerias run by two players, kept in this browser apart from the solo game. The host's phone
// holds the pizzeria while it is played; the partner's keeps a copy, so either one can host it next time.
import { createInitialState, hydrateState, toSaveData } from "../game/state";
import type { GameState, SaveData } from "../game/types";
import type { Language } from "../i18n";
import type { JsonObject } from "../utils/saveCode";

const STORAGE_KEY = "forno-lento-duos-v1";
// A few duo pizzerias per browser, the most recently played first.
export const MAX_DUOS = 6;

export interface DuoInfo {
  id: string;
  name: string;
  /** The two players' nicknames, as last seen. */
  members: string[];
}

export interface DuoSave extends DuoInfo {
  /** When this copy was saved (ms): the most recent copy is the one to host. */
  savedAt: number;
  day: number;
  state: SaveData;
}

const isDuoSave = (value: unknown): value is DuoSave => {
  const duo = value as Partial<DuoSave> | null;
  return Boolean(duo && typeof duo.id === "string" && typeof duo.name === "string" && duo.state && typeof duo.state === "object");
};

export const loadDuos = (): DuoSave[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isDuoSave).sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
};

const storeDuos = (duos: readonly DuoSave[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...duos].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_DUOS)));
  } catch {
    // Storage full or blocked: the duo still plays, it just isn't kept on this device.
  }
};

// Saves this copy of a duo pizzeria, in place of an older copy of the same one.
export const saveDuo = (info: DuoInfo, game: GameState, now: number = Date.now()): DuoSave => {
  const duo: DuoSave = { ...info, savedAt: now, day: game.day, state: toSaveData(game) };
  storeDuos([duo, ...loadDuos().filter((other) => other.id !== info.id)]);
  return duo;
};

export const deleteDuo = (id: string): void => storeDuos(loadDuos().filter((duo) => duo.id !== id));

// A new duo pizzeria: a fresh game under its own name, without the solo tutorial (both already know how to play).
export const newDuo = (name: string, members: string[], language: Language): { info: DuoInfo; game: GameState } => {
  const game = createInitialState(language);
  game.name = name;
  game.settings = { ...game.settings, tutorialDone: true };
  return { info: { id: crypto.randomUUID(), name, members }, game };
};

// A saved duo pizzeria, ready to play (older saves are brought up to date like the solo game's).
export const openDuo = (duo: DuoSave): GameState => hydrateState(JSON.parse(JSON.stringify(duo.state)) as JsonObject);
