import { useTranslation } from "../i18n/I18nContext.jsx";

// The tutorial hint for the current step (see game/tutorial.js), with a way out.
export function CoachTip({ step, dispatch, className = "" }) {
  const t = useTranslation();
  return (
    <div className={`coach ${className}`} role="status">
      <span className="coach-label">{t("tutorial.label")}</span>
      <span className="coach-t">{t(`tutorial.${step.key}`, step.params)}</span>
      <button className="btn sm ghost coach-skip" onClick={() => dispatch({ type: "skipTutorial" })}>{t("tutorial.skip")}</button>
    </div>
  );
}
