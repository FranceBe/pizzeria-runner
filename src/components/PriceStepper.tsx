import { useTranslation } from "../i18n/I18nContext";

interface PriceStepperProps {
  price: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}

export const PriceStepper = ({ price, onDecrease, onIncrease, decreaseLabel, increaseLabel }: PriceStepperProps) => {
  const t = useTranslation();
  return (
    <span className="stepper">
      <button aria-label={decreaseLabel} onClick={onDecrease}>−</button>
      <span>{t.money(price)}</span>
      <button aria-label={increaseLabel} onClick={onIncrease}>+</button>
    </span>
  );
};
