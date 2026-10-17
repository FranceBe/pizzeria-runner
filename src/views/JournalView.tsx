import { useState } from "react";
import { ACHIEVEMENT_IDS, HIDDEN_ACHIEVEMENTS } from "../data/achievements";
import { GOOD_PAIRINGS, type Pairing } from "../data/recipes";
import { achievementProgress, isUnlocked } from "../game/achievements";
import { isDiscovered } from "../game/pairings";
import { daysUntilBirthday, regularsOf } from "../game/regulars";
import { CustomerFace } from "../components/CustomerFace";
import type { DayRecord, GameState } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { IngredientIcon } from "../components/IngredientIcon";

const CHART_DAYS = 14;
// Pairings per page of the book.
const PAIRINGS_PER_PAGE = 10;
const TOP_PIZZAS = 5;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="jstat">
      <div className="jstat-v">{value}</div>
      <div className="hint">{label}</div>
    </div>
  );
}

// Profit per day as bars around a zero line: green above, red below, day numbers underneath.
// The zero line sits where gains and losses share the height in proportion.
function ProfitChart({ days }: { days: readonly DayRecord[] }) {
  const t = useTranslation();
  if (!days.length) return <p className="hint">{t("journal.chartEmpty")}</p>;
  const width = 280;
  const barsHeight = 90;
  const labelHeight = 12;
  const barWidth = width / CHART_DAYS;
  const highestGain = Math.max(0, ...days.map((day) => day.net));
  const biggestLoss = Math.max(0, ...days.map((day) => -day.net));
  const range = Math.max(1, highestGain + biggestLoss);
  const zeroY = 4 + (barsHeight - 8) * (highestGain / range);
  const scale = (barsHeight - 8) / range;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${barsHeight + labelHeight}`} role="img" aria-label={t("journal.chart")}>
      <line x1="0" x2={width} y1={zeroY} y2={zeroY} className="chart-zero" />
      {days.map((day, index) => {
        const barHeight = Math.max(2, Math.abs(day.net) * scale);
        const x = index * barWidth + barWidth * 0.18;
        return (
          <g key={day.day}>
            <title>{t("journal.dayBar", { day: day.day, net: day.net })}</title>
            <rect
              className={day.net >= 0 ? "bar-pos" : "bar-neg"}
              x={x}
              width={barWidth * 0.64}
              y={day.net >= 0 ? zeroY - barHeight : zeroY}
              height={barHeight}
              rx="2"
            />
            <text x={x + barWidth * 0.32} y={barsHeight + labelHeight - 2} className="chart-day">{day.day}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Accounts({ state }: { state: GameState }) {
  const t = useTranslation();
  const { lifetime } = state;
  const topPizzas = Object.entries(lifetime.byRecipe)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_PIZZAS);
  const mostSold = topPizzas[0]?.[1].count ?? 1;
  return (
    <div className="card pad journal-card">
      <h2 className="h">{t("journal.stats")}</h2>
      <div className="jstats">
        <Stat label={t("journal.days")} value={state.history.length} />
        <Stat label={t("journal.served")} value={lifetime.served} />
        <Stat label={t("journal.revenue")} value={t.money(lifetime.revenue)} />
        <Stat label={t("journal.tips")} value={t.money(lifetime.tips)} />
        <Stat label={t("journal.happy")} value={lifetime.happyServed} />
      </div>
      {lifetime.bestDay && <p className="hint">{t("journal.bestDay", lifetime.bestDay)}</p>}
      <h3 className="h">{t("journal.chart")}</h3>
      <ProfitChart days={state.history.slice(-CHART_DAYS)} />
      <h3 className="h">{t("journal.topPizzas")}</h3>
      {topPizzas.length === 0 && <p className="hint">{t("journal.noSales")}</p>}
      {topPizzas.map(([recipeId, sales]) => (
        <div key={recipeId} className="top-pizza">
          <span className="grow">{t.recipe(state.recipes.find((recipe) => recipe.id === recipeId) ?? { id: recipeId, name: sales.name })}</span>
          <span className="top-bar"><i style={{ width: `${(sales.count / mostSold) * 100}%` }} /></span>
          <strong>{sales.count}</strong>
        </div>
      ))}
    </div>
  );
}

// Undiscovered pairings show a hint once the player owns one of the two ingredients.
function PairingSlot({ state, pairing }: { state: GameState; pairing: Pairing }) {
  const t = useTranslation();
  const [a, b] = pairing;
  if (isDiscovered(state, pairing)) {
    return (
      <div className="pairing found">
        <span className="pairing-ics"><IngredientIcon id={a} /><IngredientIcon id={b} /></span>
        <span>{t.pairing(pairing)}</span>
      </div>
    );
  }
  const known = [a, b].find((id) => state.unlocked[id]);
  return (
    <div className="pairing">
      <span className="pairing-ics">{known ? <IngredientIcon id={known} /> : <span className="pairing-q">?</span>}<span className="pairing-q">?</span></span>
      <span className="hint">{known ? t("journal.pairingHint", { id: known }) : "? + ?"}</span>
    </div>
  );
}

// A little recipe book, turned page by page.
function PairingsBook({ state }: { state: GameState }) {
  const t = useTranslation();
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(GOOD_PAIRINGS.length / PAIRINGS_PER_PAGE);
  const shown = GOOD_PAIRINGS.slice(page * PAIRINGS_PER_PAGE, (page + 1) * PAIRINGS_PER_PAGE);
  return (
    <div className="card pad journal-card fills">
      <h2 className="h">{t("journal.pairings")}</h2>
      <p className="sub">{t("journal.pairingsIntro", { found: state.discoveredPairings.length, total: GOOD_PAIRINGS.length })}</p>
      <div className="fill-body book-page">
        <div className="pairings">
          {shown.map((pairing) => (
            <PairingSlot key={pairing.join("+")} state={state} pairing={pairing} />
          ))}
        </div>
      </div>
      <div className="book-nav">
        <button className="btn sm ghost" disabled={page === 0} aria-label={t("journal.previousPage")} onClick={() => setPage(page - 1)}>◀</button>
        <span className="hint">{t("journal.page", { page: page + 1, count: pageCount })}</span>
        <button className="btn sm ghost" disabled={page >= pageCount - 1} aria-label={t("journal.nextPage")} onClick={() => setPage(page + 1)}>▶</button>
      </div>
    </div>
  );
}

function Achievements({ state }: { state: GameState }) {
  const t = useTranslation();
  const unlockedCount = ACHIEVEMENT_IDS.filter((id) => isUnlocked(state, id)).length;
  return (
    <div className="card pad journal-card">
      <h2 className="h">{t("journal.achievements")}</h2>
      <p className="sub">{t("journal.achievementsIntro", { count: unlockedCount, total: ACHIEVEMENT_IDS.length })}</p>
      <div className="badges">
        {ACHIEVEMENT_IDS.map((id) => {
          const unlockedOn = state.achievements[id];
          const { current, target } = achievementProgress(state, id);
          if (HIDDEN_ACHIEVEMENTS.has(id) && unlockedOn === undefined) {
            return (
              <div key={id} className="badge hidden-badge">
                <span className="medal" aria-hidden="true">?</span>
                <div className="grow">
                  <strong>{t("journal.secretAchievement")}</strong>
                  <div className="hint">{t("journal.secretHint")}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={id} className={`badge${unlockedOn !== undefined ? " on" : ""}`}>
              <span className="medal" aria-hidden="true">{unlockedOn !== undefined ? "★" : ""}</span>
              <div className="grow">
                <strong>{t(`achievements.${id}.name`)}</strong>
                <div className="hint">{t(`achievements.${id}.describe`)}</div>
                {unlockedOn !== undefined ? (
                  <div className="badge-day">{t("journal.unlockedOn", { day: unlockedOn })}</div>
                ) : (
                  target > 1 && (
                    <div className="badge-progress" title={`${current} / ${target}`}>
                      <i style={{ width: `${(current / target) * 100}%` }} />
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One card per regular: their favourite, what they never want, and when their birthday is.
function RegularsBook({ state }: { state: GameState }) {
  const t = useTranslation();
  const regulars = regularsOf(state);
  return (
    <div className="card pad journal-card fills">
      <h2 className="h">{t("journal.regulars")}</h2>
      {regulars.length === 0 && <p className="hint">{t("journal.noRegulars")}</p>}
      <div className="regular-cards fill-body">
        {regulars.map((regular) => {
          const favorite = state.recipes.find((recipe) => recipe.id === regular.favoriteRecipeId);
          return (
            <div key={regular.name} className="regular-card">
              <CustomerFace customer={regular} mood={0} />
              <div className="grow">
                <strong>{regular.name}</strong> <span className="hint">· {t("journal.visits", { count: regular.visits })}</span>
                {favorite && <div className="hint">{t("journal.likes", { recipe: t.recipe(favorite) })}</div>}
                {regular.dislikes && <div className="hint">{t("journal.dislikes", { id: regular.dislikes })}</div>}
                {regular.birthday && <div className="hint">{t("journal.birthdayIn", { days: daysUntilBirthday(state, regular.birthday) })}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function JournalView({ state }: { state: GameState }) {
  return (
    <div className="journal">
      <Accounts state={state} />
      <RegularsBook state={state} />
      <PairingsBook state={state} />
      <Achievements state={state} />
    </div>
  );
}
