import { levelForXp, levelProgressPercent, xpForNextLevel } from "../game/progression.js";
import { formatEuro } from "../utils/format.js";

export function Header({ state }) {
  const level = levelForXp(state.xp);
  return (
    <header className="top">
      <div className="awning" />
      <div className="wrap top-inner">
        <h1 className="sign">{state.name}</h1>
        <div className="stats">
          <div className="stat">
            <span className="stat-l">Jour</span>
            <span className="stat-v">{state.day}</span>
          </div>
          <div className="stat">
            <span className="stat-l">Caisse</span>
            <span className="stat-v money">{formatEuro(state.money)}</span>
            {state.debt > 0 && <span className="debt">Ardoise : {formatEuro(state.debt)}</span>}
          </div>
          <div className="stat">
            <span className="stat-l">Réputation · niv. {level}</span>
            <div className="xpbar" title={`${state.xp} / ${xpForNextLevel(state.xp)} points`}>
              <i style={{ width: levelProgressPercent(state.xp) + "%" }} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
