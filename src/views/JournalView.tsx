import { ACHIEVEMENT_IDS } from "../data/achievements";
import { GOOD_PAIRINGS, type Pairing } from "../data/recipes";
import { achievementProgress, isUnlocked } from "../game/achievements";
import { isDiscovered } from "../game/pairings";
import type { DayRecord, GameState } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { IngredientIcon } from "../components/IngredientIcon";

const CHART_DAYS = 14;
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

function PairingsBook({ state }: { state: GameState }) {
  const t = useTranslation();
  return (
    <div className="card pad journal-card">
      <h2 className="h">{t("journal.pairings")}</h2>
      <p className="sub">{t("journal.pairingsIntro", { found: state.discoveredPairings.length, total: GOOD_PAIRINGS.length })}</p>
      <div className="pairings">
        {GOOD_PAIRINGS.map((pairing) => (
          <PairingSlot key={pairing.join("+")} state={state} pairing={pairing} />
        ))}
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

export function JournalView({ state }: { state: GameState }) {
  return (
    <div className="journal">
      <Accounts state={state} />
      <PairingsBook state={state} />
      <Achievements state={state} />
    </div>
  );
}
