import { useState } from "react";
import { Overlay } from "../../components/Overlay";
import { canBorrowFromNonna, NONNA_LOAN } from "../../game/economy";
import { useTranslation } from "../../i18n/I18nContext";
import type { ServiceScreenProps } from "../types";

// The ways out of a service: borrow from Nonna, close for today, start the day over.
// Closing and restarting ask once more before doing anything.
export const ServiceWayOut = ({ state, service, dispatch }: ServiceScreenProps) => {
  const t = useTranslation();
  const [confirming, setConfirming] = useState<"close" | "restart" | null>(null);
  if (service.challenge) return null;
  return (
    <div className="way-out">
      {canBorrowFromNonna(state) && (
        <div className="way-out-option">
          <button className="btn" onClick={() => dispatch({ type: "borrowFromNonna" })}>{t("service.borrow", { amount: NONNA_LOAN })}</button>
          <span className="hint">{t("service.borrowHint")}</span>
        </div>
      )}
      <div className="way-out-option">
        <button
          className={`btn${confirming === "close" ? " primary" : ""}`}
          onClick={() => (confirming === "close" ? dispatch({ type: "closeEarly" }) : setConfirming("close"))}
        >
          {t("service.closeEarly")}
        </button>
        <span className="hint">{t("service.closeEarlyHint")}</span>
      </div>
      {state.dayStart && (
        <div className="way-out-option">
          <button
            className={`btn${confirming === "restart" ? " primary" : ""}`}
            onClick={() => (confirming === "restart" ? dispatch({ type: "restartDay" }) : setConfirming("restart"))}
          >
            {t("service.restartDay")}
          </button>
          <span className="hint">{t("service.restartDayHint")}</span>
        </div>
      )}
    </div>
  );
};

// The clock stops while this is open.
export const PauseMenu = (props: ServiceScreenProps) => {
  const t = useTranslation();
  return (
    <Overlay label={t("service.paused")} onClose={() => props.dispatch({ type: "togglePause" })}>
      <div className="card pad pause-menu">
        <h2 className="h">⏸ {t("service.paused")}</h2>
        <p className="hint">{t("service.pausedHint")}</p>
        <button className="btn primary big" autoFocus onClick={() => props.dispatch({ type: "togglePause" })}>{t("service.resume")}</button>
        <ServiceWayOut {...props} />
      </div>
    </Overlay>
  );
};
