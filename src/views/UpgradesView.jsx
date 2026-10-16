import { UPGRADES } from "../data/progression.js";
import { dailyCharges } from "../game/economy.js";
import { levelForXp } from "../game/progression.js";
import { formatEuro } from "../utils/format.js";

function UpgradeCard({ upgradeKey, upgrade, currentLevel, playerLevel, money, dispatch }) {
  const isMaxed = currentLevel >= upgrade.costs.length;
  const requiredLevel = upgrade.requiredLevel[currentLevel];
  const cost = upgrade.costs[currentLevel];

  let action;
  if (isMaxed) action = <span className="pair">Au maximum</span>;
  else if (playerLevel < requiredLevel) action = <span className="tag" style={{ alignSelf: "flex-start" }}>Niveau {requiredLevel} requis</span>;
  else {
    action = (
      <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={money < cost} onClick={() => dispatch({ type: "buyUpgrade", upgradeKey })}>
        Améliorer · {formatEuro(cost)}
      </button>
    );
  }

  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row">
        <strong className="grow" style={{ fontSize: 17 }}>{upgrade.name}</strong>
        <span className="tag">{currentLevel} / {upgrade.costs.length}</span>
      </div>
      <div><span className="hint">Actuel :</span> {upgrade.describe(currentLevel)}</div>
      {!isMaxed && (
        <div>
          <span className="hint">Ensuite :</span> {upgrade.describe(currentLevel + 1)}{" "}
          <span className="hint">(+{formatEuro(upgrade.dailyCharge)} de charges)</span>
        </div>
      )}
      {action}
    </div>
  );
}

export function UpgradesView({ state, dispatch }) {
  const playerLevel = levelForXp(state.xp);
  return (
    <>
      <h2 className="h">Améliorations</h2>
      <p className="sub" style={{ marginBottom: 12 }}>
        Chaque amélioration augmente un peu les charges du soir (actuellement {formatEuro(dailyCharges(state))}).
      </p>
      <div className="grid2">
        {Object.entries(UPGRADES).map(([key, upgrade]) => (
          <UpgradeCard
            key={key}
            upgradeKey={key}
            upgrade={upgrade}
            currentLevel={state.upgrades[key]}
            playerLevel={playerLevel}
            money={state.money}
            dispatch={dispatch}
          />
        ))}
      </div>
    </>
  );
}
