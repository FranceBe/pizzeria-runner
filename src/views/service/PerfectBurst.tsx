import type { Dispatch, Pop } from "../../game/types";
import { useTranslation } from "../../i18n/I18nContext";

// A perfect pizza (game/serving.ts, isPerfectServe): a little golden burst in the middle of the screen, gone on its own.
export const PerfectBurst = ({ pops, dispatch }: { pops: readonly Pop[]; dispatch: Dispatch }) => {
  const t = useTranslation();
  const perfect = pops.filter((pop) => pop.kind === "perfect");
  if (!perfect.length) return null;
  return (
    <div className="perfect-bursts" aria-live="polite">
      {perfect.map((pop) => (
        <span key={pop.id} className="perfect-burst" onAnimationEnd={() => dispatch({ type: "dismissPop", popId: pop.id })}>
          <span className="perfect-sparks" aria-hidden="true" />
          {t("pops.perfect")}
        </span>
      ))}
    </div>
  );
};
