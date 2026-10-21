import { appealToStars } from "../game/pizza";
import { useTranslation } from "../i18n/I18nContext";

// Five stars, the first `stars` of them lit.
export const StarRow = ({ stars }: { stars: number }) => {
  const t = useTranslation();
  return (
    <span className="stars" aria-label={t("stars", { count: stars })}>
      {"★".repeat(stars)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - stars)}</span>
    </span>
  );
};

export const AppealStars = ({ appeal }: { appeal: number }) => <StarRow stars={appealToStars(appeal)} />;
