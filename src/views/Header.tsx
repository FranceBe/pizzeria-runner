import type { CSSProperties } from "react";
import { levelForXp, levelProgressPercent, xpForNextLevel } from "../game/progression";
import { averageRating } from "../game/reviews";
import { useTranslation } from "../i18n/I18nContext";
import { MoneyPops } from "../components/MoneyPops";
import { StorefrontDecor } from "../components/StorefrontDecor";
import type { ScreenProps } from "./types";

// 0 when the service opens, 1 when the last customer is in: the sky behind the sign darkens as the evening goes on.
const eveningProgress = (state: ScreenProps["state"]): number => {
  const { service } = state;
  if (!service || service.challenge) return 0;
  const total = service.stats.served + service.customers.length + service.customersToCome;
  return total ? service.stats.served / total : 0;
};

// The online rating, the way review sites show it: five stars, filled in gold as far as the rating goes. Empty before
// the first review.
const ReviewStars = ({ state }: { state: ScreenProps["state"] }) => {
  const t = useTranslation();
  const average = averageRating(state.reviewScore);
  const label = average === null ? t("header.noReviews") : t("header.reviewsTitle", { average, count: state.reviewScore.count });
  return (
    <div className="stat stat-reviews" title={label} aria-label={label}>
      <span className="stat-l">{t("header.reviews")}</span>
      <span className="rating-stars" aria-hidden="true">
        ★★★★★
        <span className="rating-fill" style={{ width: `${((average ?? 0) / 5) * 100}%` }}>★★★★★</span>
      </span>
    </div>
  );
};

// duo: the pizzeria shown is a duo pizzeria, not the player's own (the sign says so).
export const Header = ({ state, dispatch, isDuo = false }: ScreenProps & { isDuo?: boolean }) => {
  const t = useTranslation();
  const level = levelForXp(state.xp);
  const evening = eveningProgress(state);
  return (
    <header
      className={`top${state.upgrades.deco >= 2 ? " has-lights" : ""}${state.service && !state.service.challenge ? " evening" : ""}`}
      style={{ "--evening": evening.toFixed(2) } as CSSProperties}
    >
      <div className="awning" />
      <div className="wrap top-inner">
        <h1 className="sign">
          {state.name}
          {isDuo && <span className="duo-badge">{`🤝 ${t("multi.duoBadge")}`}</span>}
        </h1>
        <StorefrontDecor upgrades={state.upgrades} photos={state.celebrityWall.length} />
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
          <ReviewStars state={state} />
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
};
