import { formatEuro } from "../utils/format.js";

export function PriceStepper({ price, onDecrease, onIncrease, decreaseLabel, increaseLabel }) {
  return (
    <span className="stepper">
      <button aria-label={decreaseLabel} onClick={onDecrease}>−</button>
      <span>{formatEuro(price)}</span>
      <button aria-label={increaseLabel} onClick={onIncrease}>+</button>
    </span>
  );
}
