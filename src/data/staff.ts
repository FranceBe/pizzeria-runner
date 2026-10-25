// The people who work at the pizzeria. An upgrade opens a post (the commis's, the barman's at bar level 3, the
// waiter's); someone fills it, picked among a few candidates who change every week. Each has their own ways, told by
// what they do (never by what they are), and a wage, added to the evening's charges. One in each post is flawless and
// asks for no wage at all, but keeps a share of the evening's tips. Names are stored in saves: never rename them.

export const STAFF_ROLES = ["commis", "barman", "waiter"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface CommisProfile {
  /** Multiplies the fatigue of each evening. */
  fatigue: number;
  /** The chance, at each bake, that no dough is rolled out for the next pizza. */
  forget: number;
  /** Multiplies how fast waiting counts for the customers (below 1: they wait more patiently). */
  patience: number;
  /** Multiplies how fast pizzas cool on the pass (below 1: they stay hot longer). */
  warmth: number;
  /** Learning: helps as if a level lower for their first APPRENTICE_DAYS. */
  apprentice: boolean;
  /** What they cost each evening, added to the charges. */
  wage: number;
  /** The share of the evening's tips they keep, taken at closing. */
  tipShare: number;
}

export interface BarmanProfile {
  /** Seconds to pour a drink. */
  pourSeconds: number;
  /** The chance a pour is the wrong drink (it goes on the tray). */
  mistake: number;
  /** Tip added to each drink they serve. */
  charm: number;
  wage: number;
  tipShare: number;
}

export interface WaiterProfile {
  /** Multiplies the time between two pizzas they take to the tables. */
  pace: number;
  /** Tip added to each pizza they serve. */
  charm: number;
  wage: number;
  tipShare: number;
}

const commis = (profile: Partial<CommisProfile> & { wage: number }): CommisProfile => ({
  fatigue: 1, forget: 0, patience: 1, warmth: 1, apprentice: false, tipShare: 0, ...profile,
});
const barman = (profile: Partial<BarmanProfile> & { pourSeconds: number; wage: number }): BarmanProfile => ({ mistake: 0, charm: 0, tipShare: 0, ...profile });
const waiter = (profile: Partial<WaiterProfile> & { pace: number; wage: number }): WaiterProfile => ({ charm: 0, tipShare: 0, ...profile });

// Of the evening's tips, what the flawless ones keep.
export const GREEDY_TIP_SHARE = 0.25;

// The commis: the twelve names commis have always had, so a commis from an older save keeps who they were.
export const COMMIS_PROFILES: Record<string, CommisProfile> = {
  Lou: commis({ fatigue: 1.6, warmth: 0.85, wage: 5 }),
  Andrea: commis({ fatigue: 0.45, forget: 0.15, wage: 3 }),
  Sam: commis({ patience: 0.9, forget: 0.1, wage: 6 }),
  Noa: commis({ warmth: 0.6, fatigue: 1.2, wage: 7 }),
  Eden: commis({ apprentice: true, fatigue: 0.8, wage: 1 }),
  Charlie: commis({ wage: 4 }),
  Robin: commis({ fatigue: 0.75, wage: 5 }),
  Camille: commis({ patience: 0.93, fatigue: 1.2, wage: 5 }),
  Alex: commis({ forget: 0.25, wage: 2 }),
  Sasha: commis({ fatigue: 0.7, warmth: 0.85, wage: 6 }),
  Yuki: commis({ warmth: 0.75, wage: 6 }),
  Ilian: commis({ apprentice: true, patience: 0.95, wage: 2 }),
  // Flawless, and free… but a quarter of the tips is theirs.
  Ezra: commis({ fatigue: 0.5, warmth: 0.6, patience: 0.9, wage: 0, tipShare: GREEDY_TIP_SHARE }),
};

export const BARMAN_PROFILES: Record<string, BarmanProfile> = {
  // The barman of older saves: steady, as the barman always was.
  Lior: barman({ pourSeconds: 6, wage: 3 }),
  Marin: barman({ pourSeconds: 4, wage: 6 }),
  Ange: barman({ pourSeconds: 5, mistake: 0.1, charm: 0.5, wage: 4 }),
  Gabi: barman({ pourSeconds: 8, wage: 1 }),
  Maé: barman({ pourSeconds: 4, mistake: 0.15, wage: 3 }),
  Swann: barman({ pourSeconds: 6, charm: 0.8, wage: 6 }),
  Rio: barman({ pourSeconds: 3, charm: 0.5, wage: 0, tipShare: GREEDY_TIP_SHARE }),
};

export const WAITER_PROFILES: Record<string, WaiterProfile> = {
  Tao: waiter({ pace: 0.8, wage: 5 }),
  Kim: waiter({ pace: 1, charm: 0.5, wage: 5 }),
  Dani: waiter({ pace: 1.3, wage: 1 }),
  Ari: waiter({ pace: 1, wage: 3 }),
  Jo: waiter({ pace: 0.9, charm: 0.3, wage: 4 }),
  Lumi: waiter({ pace: 0.7, charm: 0.5, wage: 0, tipShare: GREEDY_TIP_SHARE }),
};

export const STAFF_NAMES: Record<StaffRole, readonly string[]> = {
  commis: Object.keys(COMMIS_PROFILES),
  barman: Object.keys(BARMAN_PROFILES),
  waiter: Object.keys(WAITER_PROFILES),
};

const profileOf = (role: StaffRole, name: string): { wage: number; tipShare: number } | undefined =>
  role === "commis" ? COMMIS_PROFILES[name] : role === "barman" ? BARMAN_PROFILES[name] : WAITER_PROFILES[name];
export const wageOf = (role: StaffRole, name: string): number => profileOf(role, name)?.wage ?? 0;
export const tipShareOf = (role: StaffRole, name: string): number => profileOf(role, name)?.tipShare ?? 0;

// Candidates for each post every week; an apprentice learns for this long.
export const CANDIDATES_PER_ROLE = 3;
export const APPRENTICE_DAYS = 14;
// Hardcore only: each morning, the chance someone hands in their notice.
export const RESIGN_CHANCE = 0.03;
// The waiter takes a ready pizza to its table every so many seconds, by level of the upgrade.
export const WAITER_SECONDS = [0, 8, 5];
