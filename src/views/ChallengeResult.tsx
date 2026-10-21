import { useState } from "react";
import { Overlay } from "../components/Overlay";
import type { ChallengeResult as Result, Dispatch } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";

// "2026-10-17" → "17/10" in French, "10/17" in English.
const shortDate = (date: string, language: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString(language, { day: "numeric", month: "numeric" });

// Shown when the daily challenge's clock runs out, with a way to brag about it.
export const ChallengeResult = ({ result, best, dispatch }: { result: Result; best: number; dispatch: Dispatch }) => {
  const t = useTranslation();
  const [isCopied, setCopied] = useState(false);

  const share = async () => {
    const text = t("challenge.shareText", {
      date: shortDate(result.date, t.language),
      score: result.score,
      served: result.served,
      happy: result.happy,
    });
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
    } catch {
      // Cancelled by the player, or no clipboard access: nothing to do.
    }
  };

  return (
    <Overlay label={t("challenge.dialog")} onClose={() => dispatch({ type: "dismissChallengeResult" })}>
      <div className="card pad challenge-result">
        <h2 className="h">{t("challenge.title")}</h2>
        <div className="challenge-score">{result.score}</div>
        <div className="hint">{t("challenge.points")} · {t("challenge.served", { count: result.served })}</div>
        <p className={result.isNewBest ? "pair challenge-best" : "hint"}>
          {result.isNewBest ? t("challenge.newBest") : t("challenge.best", { score: best })}
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => void share()}>{t("challenge.share")}</button>
          <button className="btn primary" onClick={() => dispatch({ type: "dismissChallengeResult" })}>{t("challenge.close")}</button>
        </div>
        {isCopied && <p className="hint" role="status">{t("challenge.copied")}</p>}
      </div>
    </Overlay>
  );
};
