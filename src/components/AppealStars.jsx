import { appealToStars } from "../game/pizza.js";

export function AppealStars({ appeal }) {
  const stars = appealToStars(appeal);
  return (
    <span className="stars" aria-label={`${stars} étoiles sur 5`}>
      {"★".repeat(stars)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - stars)}</span>
    </span>
  );
}
