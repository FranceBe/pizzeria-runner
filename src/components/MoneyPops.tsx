import type { Dispatch, Pop, PopKind } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";

// Small "+7,00 €" bubbles floating up from the till. Each one removes itself when its animation ends.
// A perfect pizza has its own burst in the middle of the screen (views/service/PerfectBurst.tsx, mounted by the app).
export const MoneyPops = ({ pops, dispatch }: { pops: readonly Pop[]; dispatch: Dispatch }) => {
  const t = useTranslation();
  const money = pops.filter((pop) => pop.kind !== "perfect");
  if (!money.length) return null;
  return (
    <div className="pops" aria-hidden="true">
      {money.map((pop) => (
        <span key={pop.id} className={`pop ${pop.kind}`} onAnimationEnd={() => dispatch({ type: "dismissPop", popId: pop.id })}>
          {t(`pops.${pop.kind as Exclude<PopKind, "perfect">}`, { amount: pop.amount })}
        </span>
      ))}
    </div>
  );
};
