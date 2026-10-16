import { PREP_STATIONS, type IngredientId } from "../../data/ingredients";
import { useTranslation } from "../../i18n/I18nContext";
import { IngredientPan } from "../../components/IngredientPan";
import type { CoachTarget, GameState } from "../../game/types";

interface PanState {
  isOnBoard: boolean;
  isNeeded: boolean;
  isCoachTarget: boolean;
  quantity: number;
}

interface PrepLineProps {
  state: GameState;
  board: readonly IngredientId[];
  neededIngredients: readonly IngredientId[];
  coachTarget: CoachTarget | null;
  onPickIngredient: (id: IngredientId) => void;
}

const LOW_PAN_THRESHOLD = 3;

function panClassName({ isOnBoard, isNeeded, isCoachTarget, quantity }: PanState): string {
  let className = "pan";
  if (isOnBoard) className += " on";
  else if (isNeeded) className += " need";
  if (isCoachTarget) className += " coach-target";
  if (quantity < LOW_PAN_THRESHOLD) className += " low";
  return className;
}

// Which pans the tutorial points at for its current step.
function isCoachPan(coachTarget: CoachTarget | null, id: IngredientId, isOnBoard: boolean, isNeeded: boolean): boolean {
  if (coachTarget === "dough") return id === "pate";
  if (coachTarget === "toppings") return isNeeded && !isOnBoard;
  return false;
}

// The row of ingredient pans along the bottom of the service screen.
// Pans the selected order still needs get a dashed outline.
export function PrepLine({ state, board, neededIngredients, coachTarget, onPickIngredient }: PrepLineProps) {
  const t = useTranslation();
  const stations = PREP_STATIONS.map((station) => ({
    ...station,
    ingredientIds: station.ingredientIds.filter((id) => state.unlocked[id]),
  })).filter((station) => station.ingredientIds.length);

  return (
    <section className="rail" aria-label={t("service.prepLine")}>
      {stations.map((station) => (
        <div key={station.id} className={`station st-${station.id}`}>
          <div className="st-label">{t(`stations.${station.id}`)}</div>
          <div className="pans">
            {station.ingredientIds.map((id) => {
              const quantity = state.stock[id] || 0;
              const isOnBoard = board.includes(id);
              const isNeeded = neededIngredients.includes(id);
              return (
                <button
                  key={id}
                  className={panClassName({ isOnBoard, isNeeded, quantity, isCoachTarget: isCoachPan(coachTarget, id, isOnBoard, isNeeded) })}
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
