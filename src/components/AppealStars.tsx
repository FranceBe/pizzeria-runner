import { appealToStars } from "../game/pizza";
import { useTranslation } from "../i18n/I18nContext";

export function AppealStars({ appeal }: { appeal: number }) {
  const t = useTranslation();
  const stars = appealToStars(appeal);
  return (
    <span className="stars" aria-label={t("stars", { count: stars })}>
      {"★".repeat(stars)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - stars)}</span>
    </span>
  );
}
