import { menuCapacity } from "../game/progression.js";
import { formatEuro } from "../utils/format.js";

export function DaySummary({ summary, onNextDay }) {
  const isProfit = summary.net >= 0;
  const reachedLevel = summary.levelUps[summary.levelUps.length - 1];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Fin de journée">
      <div className="card pad modal" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
        <h2 className="h">Fin du jour {summary.day}</h2>
        <div>
          <div className={`summary-num ${isProfit ? "pos" : "neg"}`}>
            {isProfit ? "+" : ""}
            {formatEuro(summary.net)}
          </div>
          <div className="hint">bénéfice de la journée</div>
        </div>
        <dl className="kv" style={{ fontSize: 14 }}>
          <dt>Pizzas servies</dt>
          <dd>{summary.served}</dd>
          <dt>Ventes</dt>
          <dd>{formatEuro(summary.revenue)}</dd>
          <dt>Pourboires</dt>
          <dd>{formatEuro(summary.tips)}</dd>
          <dt>Achats (marché, fournisseurs, travaux)</dt>
          <dd>− {formatEuro(summary.purchases)}</dd>
          <dt>Charges (loyer, four, personnel)</dt>
          <dd>− {formatEuro(summary.charges)}</dd>
          {summary.waste > 0 && (
            <>
              <dt>Ingrédients jetés</dt>
              <dd>{formatEuro(summary.waste)}</dd>
            </>
          )}
          <dt>Réputation gagnée</dt>
          <dd>+{summary.xp}</dd>
          {summary.debt > 0 && (
            <>
              <dt>Ardoise chez le propriétaire</dt>
              <dd className="neg">{formatEuro(summary.debt)}</dd>
            </>
          )}
        </dl>
        {summary.bestSeller && (
          <p className="sub" style={{ margin: 0 }}>
            La plus demandée : <strong>{summary.bestSeller[0]}</strong> ({summary.bestSeller[1]}×).
          </p>
        )}
        {reachedLevel && (
          <div className="card pad" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
            <strong>Niveau {reachedLevel} atteint.</strong> De nouveaux fournisseurs t'attendent au marché et ta carte peut accueillir{" "}
            {menuCapacity(reachedLevel)} pizzas.
          </div>
        )}
        {summary.debt > 0 && <p className="hint" style={{ margin: 0 }}>L'ardoise se rembourse toute seule avec la moitié des prochaines ventes.</p>}
        <button className="btn primary big" onClick={onNextDay}>Préparer le jour {summary.day + 1}</button>
      </div>
    </div>
  );
}
