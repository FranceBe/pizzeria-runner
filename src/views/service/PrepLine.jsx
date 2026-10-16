import { PREP_STATIONS } from "../../data/ingredients.js";
import { useTranslation } from "../../i18n/I18nContext.jsx";
import { IngredientPan } from "../../components/IngredientPan.jsx";

const LOW_PAN_THRESHOLD = 3;

// The row of ingredient pans along the bottom of the service screen.
export function PrepLine({ state, board, onPickIngredient }) {
  const t = useTranslation();
  const stations = PREP_STATIONS.map((station) => ({
    ...station,
    ingredientIds: station.ingredientIds.filter((id) => state.unlocked[id]),
  })).filter((station) => station.ingredientIds.length);

  return (
    <section className="rail" aria-label={t("service.prepLine")}>
      {stations.map((station) => (
        <div key={station.id} className="station">
          <div className="st-label">{t(`stations.${station.id}`)}</div>
          <div className="pans">
            {station.ingredientIds.map((id) => {
              const quantity = state.stock[id] || 0;
              const isOnBoard = board.includes(id);
              return (
                <button
                  key={id}
                  className={`pan${isOnBoard ? " on" : ""}${quantity < LOW_PAN_THRESHOLD ? " low" : ""}`}
                  disabled={!isOnBoard && quantity === 0}
                  aria-pressed={isOnBoard}
                  onClick={() => onPickIngredient(id)}
                  title={t("service.panTitle", { id, quantity })}
                >
                  <IngredientPan id={id} quantity={quantity} />
                  <span className="pan-n">{t.ingredient(id)}</span>
                  <span className="pan-q">{quantity}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
