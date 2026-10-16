import type { Dispatch, TutorialStep } from "../game/types";
import { translateMessage } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";

interface CoachTipProps {
  step: TutorialStep;
  dispatch: Dispatch;
  className?: string;
}

// The tutorial hint for the current step (see game/tutorial.ts), with a way out.
export function CoachTip({ step, dispatch, className = "" }: CoachTipProps) {
  const t = useTranslation();
  return (
    <div className={`coach ${className}`} role="status">
      <span className="coach-label">{t("tutorial.label")}</span>
      <span className="coach-t">{translateMessage(t, "tutorial", step)}</span>
      <button className="btn sm ghost coach-skip" onClick={() => dispatch({ type: "skipTutorial" })}>{t("tutorial.skip")}</button>
    </div>
  );
}
