import { levelForXp, levelProgressPercent, xpForNextLevel } from "../game/progression";
import { useTranslation } from "../i18n/I18nContext";
import { MoneyPops } from "../components/MoneyPops";
import { StorefrontDecor } from "../components/StorefrontDecor";
import type { ScreenProps } from "./types";

export function Header({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  const level = levelForXp(state.xp);
  return (
    <header className={`top${state.upgrades.deco >= 2 ? " has-lights" : ""}`}>
      <div className="awning" />
      <div className="wrap top-inner">
        <h1 className="sign">{state.name}</h1>
        <StorefrontDecor upgrades={state.upgrades} />
        <div className="stats">
          <div className="stat">
            <span className="stat-l">{t("header.day")}</span>
            <span className="stat-v">{state.day}</span>
          </div>
          <div className="stat stat-money">
            <span className="stat-l">{t("header.till")}</span>
            <span className="stat-v money">{t.money(state.money)}</span>
            {state.debt > 0 && <span className="debt">{t("header.debt", { amount: state.debt })}</span>}
            <MoneyPops pops={state.pops} dispatch={dispatch} />
          </div>
          <div className="stat stat-rep">
            <span className="stat-l">{t("header.reputation", { level })}</span>
            <div className="xpbar" title={t("header.xpTitle", { xp: state.xp, next: xpForNextLevel(state.xp) })}>
              <i style={{ width: levelProgressPercent(state.xp) + "%" }} />
            </div>
          </div>
        </div>
      </div>
      {state.upgrades.deco >= 2 && <div className="lights" aria-hidden="true" />}
    </header>
  );
}
