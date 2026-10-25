import { APPRENTICE_DAYS, BARMAN_PROFILES, COMMIS_PROFILES, STAFF_ROLES, WAITER_PROFILES, tipShareOf, wageOf, type StaffRole } from "../data/staff";
import { CustomerFace } from "../components/CustomerFace";
import { rollLooks } from "../game/looks";
import { candidatesFor, employeeOf, isLearning, isPostOpen } from "../game/staff";
import type { GameState } from "../game/types";
import { hashString, seededRandom } from "../utils/random";
import { useTranslation } from "../i18n/I18nContext";
import type { ReactNode } from "react";
import type { ScreenProps } from "./types";

type Translate = ReturnType<typeof useTranslation>;

// What someone does, in a few words (data/staff.ts): told by their effects, never by what they are.
const traitsOf = (t: Translate, state: GameState, role: StaffRole, name: string, isEmployed: boolean): string[] => {
  const traits: string[] = [];
  if (role === "commis") {
    const profile = COMMIS_PROFILES[name];
    if (!profile) return traits;
    if (profile.fatigue >= 1.3) traits.push(t("staff.traits.tiresFast"));
    else if (profile.fatigue <= 0.5) traits.push(t("staff.traits.tireless"));
    else if (profile.fatigue <= 0.8) traits.push(t("staff.traits.tiresSlowly"));
    if (profile.forget > 0) traits.push(t("staff.traits.forgets"));
    if (profile.patience < 1) traits.push(t("staff.traits.chats"));
    if (profile.warmth < 1) traits.push(t("staff.traits.keepsWarm"));
    if (profile.apprentice) {
      const hiredDay = state.commis?.hiredDay;
      traits.push(
        isEmployed && isLearning(state) && hiredDay !== undefined
          ? t("staff.traits.learning", { days: APPRENTICE_DAYS - (state.day - hiredDay) })
          : !isEmployed
            ? t("staff.traits.apprentice", { days: APPRENTICE_DAYS })
            : "",
      );
    }
  } else if (role === "barman") {
    const profile = BARMAN_PROFILES[name];
    if (!profile) return traits;
    traits.push(t("staff.traits.pours", { seconds: profile.pourSeconds }));
    if (profile.mistake > 0) traits.push(t("staff.traits.mistakes"));
    if (profile.charm > 0) traits.push(t("staff.traits.charm", { amount: profile.charm }));
  } else {
    const profile = WAITER_PROFILES[name];
    if (!profile) return traits;
    if (profile.pace < 1) traits.push(t("staff.traits.fast"));
    if (profile.pace > 1) traits.push(t("staff.traits.slow"));
    if (profile.charm > 0) traits.push(t("staff.traits.charm", { amount: profile.charm }));
  }
  const shown = traits.filter(Boolean);
  const share = tipShareOf(role, name);
  return [...(shown.length ? shown : [t("staff.traits.steady")]), ...(share ? [t("staff.traits.keepsTips", { share: Math.round(share * 100) })] : [])];
};

// Someone's face, always the same for the same name.
const faceOf = (name: string) => rollLooks(name, seededRandom(hashString(`staff:${name}`)));

const Person = ({ state, role, name, isEmployed, action }: { state: GameState; role: StaffRole; name: string; isEmployed: boolean; action?: ReactNode }) => {
  const t = useTranslation();
  return (
    <div className={`staff-person${isEmployed ? " employed" : ""}`}>
      <CustomerFace customer={faceOf(name)} mood={0} />
      <div className="grow">
        <strong>{name}</strong>
        <ul className="staff-traits">
          {traitsOf(t, state, role, name, isEmployed).map((trait) => (
            <li key={trait}>{trait}</li>
          ))}
        </ul>
        <div className="hint">
          {t("staff.wage", { amount: wageOf(role, name) })}
          {isEmployed && role === "commis" && state.commis ? ` · ${t("staff.fatigue", { fatigue: Math.round(state.commis.fatigue) })}` : ""}
        </div>
      </div>
      {action}
    </div>
  );
};

// One post: who works there (or nobody), and this week's candidates.
const Post = ({ state, dispatch, role }: ScreenProps & { role: StaffRole }) => {
  const t = useTranslation();
  const employee = employeeOf(state, role);
  const canChange = state.phase === "prep";
  return (
    <section className="staff-post" aria-label={t(`staff.roles.${role}`)}>
      <h3 className="binlabel">{t(`staff.roles.${role}`)}</h3>
      {employee ? (
        <Person
          state={state}
          role={role}
          name={employee.name}
          isEmployed
          action={
            <button className="btn sm ghost" disabled={!canChange} onClick={() => dispatch({ type: "fireStaff", role })}>
              {t("staff.fire")}
            </button>
          }
        />
      ) : (
        <p className="hint staff-vacant">{t("staff.vacant")}</p>
      )}
      <details className="staff-candidates">
        <summary>{t("staff.candidates")}</summary>
        {candidatesFor(state, role).length === 0 && <p className="hint">{t("staff.noCandidates")}</p>}
        {candidatesFor(state, role).map((name) => (
          <Person
            key={name}
            state={state}
            role={role}
            name={name}
            isEmployed={false}
            action={
              <button className="btn sm" disabled={!canChange} onClick={() => dispatch({ type: "hireStaff", role, name })}>
                {employee ? t("staff.replace") : t("staff.hire")}
              </button>
            }
          />
        ))}
      </details>
    </section>
  );
};

// The staff, in the upgrades tab: every open post.
export const StaffCard = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const posts = STAFF_ROLES.filter((role) => isPostOpen(state, role));
  if (!posts.length) return null;
  return (
    <div className="card pad staff-card">
      <h2 className="h">{t("staff.title")}</h2>
      <p className="hint">{t("staff.intro")}</p>
      {state.phase !== "prep" && <p className="hint">{t("staff.morningOnly")}</p>}
      {posts.map((role) => (
        <Post key={role} state={state} dispatch={dispatch} role={role} />
      ))}
    </div>
  );
};
