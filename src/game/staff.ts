// Who works at the pizzeria (data/staff.ts): an upgrade opens a post, someone fills it. Three candidates for each post
// come along every week; whoever is hired stays until the player lets them go (in the morning), so a good one can stay
// for good. When a post opens, someone is hired at once. In hardcore, someone may hand in their notice.
import { BARMAN_LEVEL } from "../data/progression";
import {
  APPRENTICE_DAYS, BARMAN_PROFILES, CANDIDATES_PER_ROLE, COMMIS_PROFILES, RESIGN_CHANCE, STAFF_NAMES, STAFF_ROLES, WAITER_PROFILES,
  WAITER_SECONDS, tipShareOf, wageOf, type BarmanProfile, type CommisProfile, type StaffRole, type WaiterProfile,
} from "../data/staff";
import { pickSome } from "../utils/random";
import { difficultyOf } from "./playOptions";
import { pushToast } from "./toasts";
import { weekOf } from "./weekly";
import type { GameState } from "./types";

export interface Employee {
  name: string;
  /** The day they were hired (missing for those of older saves: long ago). */
  hiredDay?: number;
}

/** The post is open: its upgrade was bought. */
export const isPostOpen = (state: GameState, role: StaffRole): boolean =>
  role === "commis" ? state.upgrades.commis > 0 : role === "barman" ? state.upgrades.bar >= BARMAN_LEVEL : state.upgrades.waiter > 0;

export const employeeOf = (state: GameState, role: StaffRole): Employee | undefined => state[role];

/** Whoever works there tonight: hired, in an open post. */
const atWork = (state: GameState, role: StaffRole): Employee | undefined => (isPostOpen(state, role) ? employeeOf(state, role) : undefined);

/** The commis at work tonight (not on their evening off), and how they work. */
export const commisProfile = (state: GameState): CommisProfile | undefined => {
  const commis = isPostOpen(state, "commis") ? state.commis : undefined;
  return commis && commis.offDay !== state.day ? COMMIS_PROFILES[commis.name] : undefined;
};
export const barmanProfile = (state: GameState): BarmanProfile | undefined => {
  const barman = atWork(state, "barman");
  return barman ? BARMAN_PROFILES[barman.name] : undefined;
};
export const waiterProfile = (state: GameState): WaiterProfile | undefined => {
  const waiter = atWork(state, "waiter");
  return waiter ? WAITER_PROFILES[waiter.name] : undefined;
};

/** Still learning: an apprentice in their first days. */
export const isLearning = (state: GameState): boolean => {
  const commis = atWork(state, "commis");
  const profile = commis && COMMIS_PROFILES[commis.name];
  return Boolean(profile?.apprentice && commis?.hiredDay !== undefined && state.day - commis.hiredDay < APPRENTICE_DAYS);
};

/** Seconds between two pizzas the waiter takes to the tables (0: no waiter). */
export const waiterSeconds = (state: GameState): number => {
  const profile = waiterProfile(state);
  return profile ? (WAITER_SECONDS[state.upgrades.waiter] ?? WAITER_SECONDS.at(-1) ?? 0) * profile.pace : 0;
};

// Who works tonight: hired, in an open post, and not the commis on their evening off.
const workingTonight = (state: GameState): [StaffRole, Employee][] =>
  STAFF_ROLES.flatMap((role): [StaffRole, Employee][] => {
    const employee = atWork(state, role);
    return employee && !(role === "commis" && state.commis?.offDay === state.day) ? [[role, employee]] : [];
  });

/** The wages of tonight's staff, added to the evening's charges. */
export const staffWages = (state: GameState): number => workingTonight(state).reduce((total, [role, { name }]) => total + wageOf(role, name), 0);

/** The share of tonight's tips the staff keep (the flawless ones'), taken at closing. */
export const staffTipShare = (state: GameState): number =>
  Math.min(1, workingTonight(state).reduce((total, [role, { name }]) => total + tipShareOf(role, name), 0));

// This week's candidates for each post, never whoever already works there. Mutates state.
export const ensureCandidates = (state: GameState): void => {
  const week = weekOf(state.day);
  if (state.staffCandidates?.week === week) return;
  const names = Object.fromEntries(
    STAFF_ROLES.map((role) => [role, pickSome(STAFF_NAMES[role].filter((name) => name !== employeeOf(state, role)?.name), CANDIDATES_PER_ROLE)]),
  ) as Record<StaffRole, string[]>;
  state.staffCandidates = { week, names };
};

export const candidatesFor = (state: GameState, role: StaffRole): readonly string[] =>
  state.staffCandidates?.week === weekOf(state.day) ? state.staffCandidates.names[role] : [];

const setEmployee = (state: GameState, role: StaffRole, name: string): void => {
  if (role === "commis") state.commis = { name, fatigue: 0, hiredDay: state.day };
  else state[role] = { name, hiredDay: state.day };
  if (state.staffCandidates) {
    state.staffCandidates.names[role] = state.staffCandidates.names[role].filter((candidate) => candidate !== name);
  }
};

// The player hires one of this week's candidates, in the morning; whoever was there goes back among them (they may be
// hired again). Mutates state.
export const hireStaff = (state: GameState, role: StaffRole, name: string): void => {
  if (state.phase !== "prep" || !isPostOpen(state, role) || !candidatesFor(state, role).includes(name)) return;
  const before = employeeOf(state, role);
  setEmployee(state, role, name);
  if (before && state.staffCandidates) state.staffCandidates.names[role] = [...state.staffCandidates.names[role], before.name];
  pushToast(state, { key: "staffHired", params: { name, role } }, "gold");
};

// Let go, in the morning: the post stays empty until someone is hired, and they stay among the candidates. Mutates state.
export const fireStaff = (state: GameState, role: StaffRole): void => {
  const employee = employeeOf(state, role);
  if (state.phase !== "prep" || !employee) return;
  state[role] = undefined;
  ensureCandidates(state);
  if (state.staffCandidates && !state.staffCandidates.names[role].includes(employee.name)) {
    state.staffCandidates.names[role] = [...state.staffCandidates.names[role], employee.name];
  }
};

// A post just opened (its upgrade bought): one of the candidates starts at once. Mutates state.
export const fillOpenPosts = (state: GameState, { silent = false } = {}): void => {
  ensureCandidates(state);
  STAFF_ROLES.forEach((role) => {
    if (!isPostOpen(state, role) || employeeOf(state, role)) return;
    const [name] = candidatesFor(state, role);
    if (!name) return;
    setEmployee(state, role, name);
    if (!silent) pushToast(state, { key: "staffHired", params: { name, role } }, "gold");
  });
};

// Hardcore: now and then, in the morning, someone hands in their notice; their post waits for someone new. Mutates state.
export const maybeResign = (state: GameState): void => {
  if (difficultyOf(state) !== "hardcore") return;
  STAFF_ROLES.forEach((role) => {
    const employee = atWork(state, role);
    if (!employee || Math.random() >= RESIGN_CHANCE) return;
    state[role] = undefined;
    pushToast(state, { key: "staffQuit", params: { name: employee.name, role } }, "warn");
  });
};

/** Open posts nobody fills. */
export const vacantPosts = (state: GameState): StaffRole[] => STAFF_ROLES.filter((role) => isPostOpen(state, role) && !employeeOf(state, role));
