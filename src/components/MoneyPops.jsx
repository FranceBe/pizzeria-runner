import { useTranslation } from "../i18n/I18nContext.jsx";

// Small "+7,00 €" bubbles floating up from the till. Each one removes itself when its animation ends.
export function MoneyPops({ pops, dispatch }) {
  const t = useTranslation();
  if (!pops.length) return null;
  return (
    <div className="pops" aria-hidden="true">
      {pops.map((pop) => (
        <span key={pop.id} className={`pop ${pop.kind}`} onAnimationEnd={() => dispatch({ type: "dismissPop", popId: pop.id })}>
          {t(`pops.${pop.kind}`, { amount: pop.amount })}
        </span>
      ))}
    </div>
  );
}
