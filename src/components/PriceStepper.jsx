import { useTranslation } from "../i18n/I18nContext.jsx";

export function PriceStepper({ price, onDecrease, onIncrease, decreaseLabel, increaseLabel }) {
  const t = useTranslation();
  return (
    <span className="stepper">
      <button aria-label={decreaseLabel} onClick={onDecrease}>−</button>
      <span>{t.money(price)}</span>
      <button aria-label={increaseLabel} onClick={onIncrease}>+</button>
    </span>
  );
}
