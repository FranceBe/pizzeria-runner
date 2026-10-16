import { UPGRADES } from "../data/progression.js";
import { dailyCharges } from "../game/economy.js";
import { levelForXp } from "../game/progression.js";
import { useTranslation } from "../i18n/I18nContext.jsx";

function UpgradeCard({ upgradeKey, upgrade, currentLevel, playerLevel, money, dispatch }) {
  const t = useTranslation();
  const isMaxed = currentLevel >= upgrade.costs.length;
  const requiredLevel = upgrade.requiredLevel[currentLevel];
  const cost = upgrade.costs[currentLevel];
  const describe = (level) => t(`upgrades.${upgradeKey}.describe`, { level });

  let action;
  if (isMaxed) action = <span className="pair">{t("upgrades.maxed")}</span>;
  else if (playerLevel < requiredLevel) {
    action = <span className="tag" style={{ alignSelf: "flex-start" }}>{t("upgrades.levelRequired", { level: requiredLevel })}</span>;
  } else {
    action = (
      <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={money < cost} onClick={() => dispatch({ type: "buyUpgrade", upgradeKey })}>
        {t("upgrades.buy", { cost })}
      </button>
    );
  }

  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row">
        <strong className="grow" style={{ fontSize: 17 }}>{t(`upgrades.${upgradeKey}.name`)}</strong>
        <span className="tag">{currentLevel} / {upgrade.costs.length}</span>
      </div>
      <div><span className="hint">{t("upgrades.current")}</span> {describe(currentLevel)}</div>
      {!isMaxed && (
        <div>
          <span className="hint">{t("upgrades.next")}</span> {describe(currentLevel + 1)}{" "}
          <span className="hint">{t("upgrades.extraCharges", { amount: upgrade.dailyCharge })}</span>
        </div>
      )}
      {action}
    </div>
  );
}

export function UpgradesView({ state, dispatch }) {
  const t = useTranslation();
  const playerLevel = levelForXp(state.xp);
  return (
    <>
      <h2 className="h">{t("upgrades.title")}</h2>
      <p className="sub" style={{ marginBottom: 12 }}>{t("upgrades.intro", { charges: dailyCharges(state) })}</p>
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
