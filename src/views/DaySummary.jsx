import { menuCapacity } from "../game/progression.js";
import { useTranslation } from "../i18n/I18nContext.jsx";

export function DaySummary({ summary, onNextDay }) {
  const t = useTranslation();
  const isProfit = summary.net >= 0;
  const reachedLevel = summary.levelUps[summary.levelUps.length - 1];
  const { bestSeller } = summary;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("summary.dialog")}>
      <div className="card pad modal" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
        <h2 className="h">{t("summary.title", { day: summary.day })}</h2>
        <div>
          <div className={`summary-num ${isProfit ? "pos" : "neg"}`}>
            {isProfit ? "+" : ""}
            {t.money(summary.net)}
          </div>
          <div className="hint">{t("summary.profit")}</div>
        </div>
        <dl className="kv" style={{ fontSize: 14 }}>
          <dt>{t("summary.served")}</dt>
          <dd>{summary.served}</dd>
          <dt>{t("summary.revenue")}</dt>
          <dd>{t.money(summary.revenue)}</dd>
          <dt>{t("summary.tips")}</dt>
          <dd>{t.money(summary.tips)}</dd>
          <dt>{t("summary.purchases")}</dt>
          <dd>− {t.money(summary.purchases)}</dd>
          <dt>{t("summary.charges")}</dt>
          <dd>− {t.money(summary.charges)}</dd>
          {summary.waste > 0 && (
            <>
              <dt>{t("summary.waste")}</dt>
              <dd>{t.money(summary.waste)}</dd>
            </>
          )}
          <dt>{t("summary.reputation")}</dt>
          <dd>+{summary.xp}</dd>
          {summary.debt > 0 && (
            <>
              <dt>{t("summary.debt")}</dt>
              <dd className="neg">{t.money(summary.debt)}</dd>
            </>
          )}
        </dl>
        {bestSeller && (
          <p className="sub" style={{ margin: 0 }}>
            {t("summary.bestSeller")} <strong>{t.recipe({ id: bestSeller.recipeId, name: bestSeller.name })}</strong> ({bestSeller.count}×).
          </p>
        )}
        {reachedLevel && (
          <div className="card pad" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
            <strong>{t("summary.levelReached", { level: reachedLevel })}</strong>{" "}
            {t("summary.levelReachedDetails", { capacity: menuCapacity(reachedLevel) })}
          </div>
        )}
        {summary.debt > 0 && <p className="hint" style={{ margin: 0 }}>{t("summary.debtHint")}</p>}
        <button className="btn primary big" onClick={onNextDay}>{t("summary.nextDay", { day: summary.day + 1 })}</button>
      </div>
    </div>
  );
}
