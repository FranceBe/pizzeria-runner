import type { ChallengeResult as Result, Dispatch } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";

// Shown when the timed challenge's clock runs out.
export function ChallengeResult({ result, best, dispatch }: { result: Result; best: number; dispatch: Dispatch }) {
  const t = useTranslation();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("challenge.dialog")}>
      <div className="card pad challenge-result">
        <h2 className="h">{t("challenge.title")}</h2>
        <div className="challenge-score">{result.score}</div>
        <div className="hint">{t("challenge.points")} · {t("challenge.served", { count: result.served })}</div>
        <p className={result.isNewBest ? "pair challenge-best" : "hint"}>
          {result.isNewBest ? t("challenge.newBest") : t("challenge.best", { score: best })}
        </p>
        <button className="btn primary big" onClick={() => dispatch({ type: "dismissChallengeResult" })}>{t("challenge.close")}</button>
      </div>
    </div>
  );
}
