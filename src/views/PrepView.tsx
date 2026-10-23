import { useEffect, useRef, useState } from "react";
import { MARGHERITA } from "../data/recipes";
import { CHALLENGE_SECONDS, createChallenge, localDate } from "../game/challenge";
import { canBorrowFromNonna, dailyCharges, forecastCustomers, NONNA_LOAN } from "../game/economy";
import { activeMenu, findRecipe, isNewRecipe } from "../game/menu";
import { canChooseSpecial, currentSpecial, isSpecial, specialUntil } from "../game/special";
import { LOW_STOCK_THRESHOLD, morningTips } from "../game/tips";
import { ingredientCost } from "../game/pizza";
import { levelForXp, menuCapacity } from "../game/progression";
import { regularsOf, type Regular } from "../game/regulars";
import { FESTIVALS } from "../data/festivals";
import { daysLeftInSeason, seasonalRecipe, seasonOf } from "../game/seasons";
import { tutorialStep } from "../game/tutorial";
import { useTranslation } from "../i18n/I18nContext";
import { translateMessage } from "../i18n";
import { CoachTip } from "../components/CoachTip";
import { CustomerFace } from "../components/CustomerFace";
import { Pizza } from "../components/Pizza";
import type { GameState, Recipe } from "../game/types";
import type { TabId } from "../components/TabIcon";
import type { ScreenProps } from "./types";
import { TonightAgenda } from "./TonightAgenda";
import { WEEKLY_BONUS, WEEKLY_REWARD } from "../data/weekly";

// Nonna offers help when nothing on the menu can be made and a few margheritas are unaffordable.
const needsNonna = (state: GameState, menu: readonly Recipe[]): boolean => {
  const canMakeSomething = menu.some((recipe) => recipe.ingredients.every((id) => (state.stock[id] || 0) > 0));
  const isBroke = state.money < ingredientCost(MARGHERITA.ingredients) * 3;
  return !canMakeSomething && isBroke && state.lastNonnaVisitDay !== state.day;
};

const MAX_REGULARS_SHOWN = 5;

// The week's three missions, compact: what, how far, done or not.
const WeeklyMissions = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  if (!state.weekly) return null;
  return (
    <div className="weekly">
      <h3 className="h">{t("prep.weekly")}</h3>
      {state.weekly.missions.map((mission) => (
        <div key={mission.kind} className={`weekly-row${mission.done ? " done" : ""}`}>
          <span className="weekly-check" aria-hidden="true">{mission.done ? "✓" : ""}</span>
          <span className="grow">{t(`weeklyMissions.${mission.kind}`, { target: mission.target })}</span>
          <span className="hint">{`${Math.floor(mission.progress)} / ${mission.target}`}</span>
        </div>
      ))}
      <p className="hint">{t("prep.weeklyReward", { reward: WEEKLY_REWARD, bonus: WEEKLY_BONUS })}</p>
    </div>
  );
};

// The week's special: picked with the stars of tonight's menu, then shown with how the week is going.
const SpecialOfTheWeek = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const special = currentSpecial(state);
  const recipe = special && findRecipe(state, special.recipeId);
  if (!special || !recipe) return <p className="special-pick">{`☆ ${t("prep.specialPick")}`}</p>;
  return (
    <div className="special-banner">
      <span className="special-banner-star" aria-hidden="true">★</span>
      <div className="grow">
        <div className="special-banner-label">{t("prep.special")}</div>
        <strong>{t.recipe(recipe)}</strong>
        <div className="hint">{t("prep.specialLine", { served: special.served, until: specialUntil(state.day) })}</div>
      </div>
      {canChooseSpecial(state) && (
        <button className="btn sm ghost" onClick={() => dispatch({ type: "setSpecial", recipeId: null })}>{t("prep.specialChange")}</button>
      )}
    </div>
  );
};

// The morning's tips, folded into a little bubble: a count, and the tips once tapped. The card lies over the agenda,
// so a tap anywhere else (or Escape) folds it back.
const MorningTips = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const tips = morningTips(state);
  const bubble = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const close = () => bubble.current?.removeAttribute("open");
    const onPointerDown = (event: PointerEvent) => {
      if (!bubble.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);
  if (!tips.length) return null;
  return (
    <details ref={bubble} className="tips-bubble" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary aria-label={t("prep.tipsLabel", { count: tips.length })} title={t("prep.tipsTitle")}>
        <span aria-hidden="true">💡</span>
        <span className="tips-count">{tips.length}</span>
      </summary>
      <div className="tips-panel">
        <strong>{t("prep.tipsTitle")}</strong>
        <ul>
          {tips.map((tip) => (
            <li key={`${tip.key}-${JSON.stringify(tip.params)}`}>{translateMessage(t, "prep.tips", tip)}</li>
          ))}
        </ul>
      </div>
    </details>
  );
};

// The daily challenge: same customers for everyone today; offered once the tutorial is over.
const ChallengeOffer = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  if (!state.settings.tutorialDone) return null;
  const today = localDate();
  const bestToday = state.dailyChallenge?.date === today ? state.dailyChallenge.best : 0;
  const menu = t.list(createChallenge(today).menu.map((id) => t.recipe({ id })));
  return (
    <div className="challenge-offer">
      <div className="grow">
        <strong>{t("prep.challengeTitle")}</strong>
        <div className="hint">{t("prep.challengeIntro", { seconds: CHALLENGE_SECONDS })}</div>
        <div className="hint">{t("prep.dailyMenu", { recipes: menu })}</div>
        {bestToday > 0 && <div className="hint"><strong>{t("prep.challengeBest", { score: bestToday })}</strong></div>}
      </div>
      <button className="btn" onClick={() => dispatch({ type: "startChallenge", date: today })}>
        {t("prep.startChallenge")}
      </button>
    </div>
  );
};

const SeasonBadge = ({ day }: { day: number }) => {
  const t = useTranslation();
  const season = seasonOf(day);
  return <span className={`season-badge s-${season}`}>{t("prep.season", { season: t(`seasons.${season}`), days: daysLeftInSeason(day) })}</span>;
};

// Their favourite and visits; a favourite asleep until its festival is said so, with whatever stands in for it.
const RegularLine = ({ state, regular }: { state: GameState; regular: Regular }) => {
  const t = useTranslation();
  const favorite = state.recipes.find((recipe) => recipe.id === regular.favoriteRecipeId);
  return (
    <>
      <div className="hint">{favorite ? t("prep.regularLine", { recipe: t.recipe(favorite), visits: regular.visits }) : t("journal.visits", { count: regular.visits })}</div>
      {regular.favoriteBackWith && (
        <div className="hint">{`${FESTIVALS[regular.favoriteBackWith].emoji} ${t("journal.favoriteBack", { festival: regular.favoriteBackWith })}`}</div>
      )}
    </>
  );
};

const Regulars = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const regulars = regularsOf(state).slice(0, MAX_REGULARS_SHOWN);
  if (!regulars.length) return null;
  return (
    <div className="regulars">
      <h3 className="h">{t("prep.regulars")}</h3>
      {regulars.map((regular) => (
        <div key={regular.name} className="regular-row">
          <CustomerFace customer={regular} mood={0} />
          <div className="grow">
            <strong>{regular.name}</strong>
            <RegularLine state={state} regular={regular} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const PrepView = ({ state, dispatch, goToTab }: ScreenProps & { goToTab: (tab: TabId) => void }) => {
  const t = useTranslation();
  const expectedCustomers = forecastCustomers(state);
  const menu = activeMenu(state);
  const level = levelForXp(state.xp);
  const usedIngredients = [...new Set(menu.flatMap((recipe) => recipe.ingredients))];
  const lowStock = usedIngredients.filter((id) => (state.stock[id] || 0) < LOW_STOCK_THRESHOLD);
  const tutorial = tutorialStep(state);
  const seasonal = seasonalRecipe(state);
  // No special yet this week: each pizza of tonight's menu gets a star to pick it.
  const isPicking = state.settings.tutorialDone && !currentSpecial(state) && canChooseSpecial(state);

  return (
    <div className="prep">
      <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {tutorial && <CoachTip step={tutorial} dispatch={dispatch} />}
        <div>
          <div className="row prep-head">
            <h2 className="h grow">{t("prep.title", { day: state.day })}</h2>
            <SeasonBadge day={state.day} />
            <MorningTips state={state} />
          </div>
          <p className="sub">{t("prep.intro")}</p>
        </div>
        <TonightAgenda state={state} />
        <div className="row" style={{ alignItems: "flex-end", gap: 24 }}>
          <div>
            <div className="forecast">{expectedCustomers}</div>
            <div className="hint">{t("prep.expectedCustomers")}</div>
          </div>
          <dl className="kv">
            <dt>{t("prep.pizzasOnMenu")}</dt>
            <dd>{menu.length} / {menuCapacity(level)}</dd>
            <dt>{t("prep.eveningCharges")}</dt>
            <dd>{t.money(dailyCharges(state))}</dd>
            {state.debt > 0 && (
              <>
                <dt>{t("prep.currentDebt")}</dt>
                <dd className="neg">{t.money(state.debt)}</dd>
              </>
            )}
          </dl>
        </div>
        {lowStock.length > 0 && (
          <div>
            <strong>{t("prep.lowStock")}</strong>
            <ul className="warnlist">
              {lowStock.map((id) => (
                <li key={id}>{t("prep.stockLine", { id, quantity: state.stock[id] || 0 })}</li>
              ))}
            </ul>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => goToTab("market")}>{t("prep.goToMarket")}</button>
          </div>
        )}
        {needsNonna(state, menu) && (
          <div className="card pad" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
            <p style={{ margin: "0 0 8px" }}>{t("prep.nonnaOffer")}</p>
            <div className="row">
              <button className="btn" onClick={() => dispatch({ type: "callNonna" })}>{t("prep.callNonna")}</button>
              {canBorrowFromNonna(state) && (
                <button className="btn ghost" onClick={() => dispatch({ type: "borrowFromNonna" })}>{t("service.borrow", { amount: NONNA_LOAN })}</button>
              )}
            </div>
          </div>
        )}
        <div>
          <button
            className={`btn primary big${tutorial?.target === "open" ? " coach-target" : ""}`}
            onClick={() => dispatch({ type: "openRestaurant" })}
            disabled={!expectedCustomers}
          >
            {t("prep.open")}
          </button>
        </div>
        <ChallengeOffer state={state} dispatch={dispatch} />
      </div>

      <div className="card pad">
        <h3 className="h">{t("prep.tonightsMenu")}</h3>
        {menu.length === 0 && <p className="sub">{t("prep.emptyMenu")}</p>}
        {menu.length > 0 && state.settings.tutorialDone && <SpecialOfTheWeek state={state} dispatch={dispatch} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {menu.map((recipe) => (
            <div key={recipe.id} className="row" style={{ flexWrap: "nowrap" }}>
              <Pizza ingredients={recipe.ingredients} baked size={44} />
              <div className="grow">
                <strong>{t.recipe(recipe)}</strong> {isNewRecipe(state, recipe) && <span className="tag">{t("common.new")}</span>}
                {isSpecial(state, recipe.id) && <span className="tag special">{`★ ${t("prep.specialTag")}`}</span>}
                {recipe.id === seasonal?.id && <span className="tag seasonal">{t("prep.seasonal")}</span>}
                <div className="hint">{t.toppings(recipe.ingredients)}</div>
              </div>
              {isPicking && (
                <button
                  className="special-star-btn"
                  aria-label={`${t("menu.makeSpecial")} · ${t.recipe(recipe)}`}
                  title={t("menu.specialHint")}
                  onClick={() => dispatch({ type: "setSpecial", recipeId: recipe.id })}
                >
                  ☆
                </button>
              )}
              <strong>{t.money(recipe.price)}</strong>
            </div>
          ))}
        </div>
        <Regulars state={state} />
        <WeeklyMissions state={state} />
      </div>
    </div>
  );
};
