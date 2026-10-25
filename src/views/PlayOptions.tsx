import { DIFFICULTIES, difficultyOf } from "../game/playOptions";
import { useTranslation } from "../i18n/I18nContext";
import type { ScreenProps } from "./types";

// How hard the game is: five levels, the chosen one explained (game/playOptions.ts).
export const PlayOptions = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const current = difficultyOf(state);
  return (
    <div className="card pad play-options">
      <h2 className="h">{t("settings.play.title")}</h2>
      <p className="hint">{t("settings.play.intro")}</p>
      <div className="difficulty-levels" role="radiogroup" aria-label={t("settings.play.title")}>
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            role="radio"
            aria-checked={level === current}
            className={`btn sm${level === current ? " primary" : ""}`}
            onClick={() => dispatch({ type: "setDifficulty", difficulty: level })}
          >
            {t(`settings.play.levels.${level}.name`)}
          </button>
        ))}
      </div>
      <p className="difficulty-describe">{t(`settings.play.levels.${current}.describe`)}</p>
      {current === "gentle" && <p className="hint">{t("settings.play.achievementsNote")}</p>}
    </div>
  );
};
