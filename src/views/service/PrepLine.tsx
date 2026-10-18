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
  /** During a challenge, every pan is full and nothing runs out. */
  isBottomless: boolean;
  /** Shown even if not unlocked: the daily challenge's recipes need them. */
  extraIngredients?: readonly IngredientId[];
  board: readonly IngredientId[];
  neededIngredients: readonly IngredientId[];
  coachTarget: CoachTarget | null;
  onPickIngredient: (id: IngredientId) => void;
  /** Nonna's secret, once shared: shown as an extra jar at the end of the line. */
  secret?: { isOnBoard: boolean; canAdd: boolean; stock: number; onToggle: () => void };
}

// A small jar with a sparkle: Nonna's secret.
function SecretJar() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="1" y="1" width="58" height="58" rx="6" fill="#3a2a3f" />
      <path d="M20 18h20v4c4 2 6 6 6 11v13a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V33c0-5 2-9 6-11Z" fill="#f6ead0" opacity=".9" />
      <rect x="19" y="12" width="22" height="7" rx="2" fill="#c63a21" />
      <path d="M30 28l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#e0a020" />
    </svg>
  );
}

const LOW_PAN_THRESHOLD = 3;
const FULL_PAN = 12;

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
export function PrepLine({ state, isBottomless, extraIngredients = [], board, neededIngredients, coachTarget, onPickIngredient, secret }: PrepLineProps) {
  const t = useTranslation();
  const stations = PREP_STATIONS.map((station) => ({
    ...station,
    ingredientIds: station.ingredientIds.filter((id) => state.unlocked[id] || extraIngredients.includes(id)),
  })).filter((station) => station.ingredientIds.length);

  return (
    <section className={`rail${neededIngredients.length ? " has-order" : ""}`} aria-label={t("service.prepLine")}>
      {stations.map((station) => (
        <div key={station.id} className={`station st-${station.id}`}>
          <div className="st-label">{t(`stations.${station.id}`)}</div>
          <div className="pans">
            {station.ingredientIds.map((id) => {
              const quantity = isBottomless ? FULL_PAN : state.stock[id] || 0;
              const isOnBoard = board.includes(id);
              const isNeeded = neededIngredients.includes(id);
              return (
                <button
                  key={id}
                  className={panClassName({ isOnBoard, isNeeded, quantity, isCoachTarget: isCoachPan(coachTarget, id, isOnBoard, isNeeded) })}
                  disabled={!isOnBoard && quantity === 0}
                  aria-pressed={isOnBoard}
                  onClick={() => onPickIngredient(id)}
                  title={isBottomless ? t.ingredient(id) : t("service.panTitle", { id, quantity })}
                >
                  <IngredientPan id={id} quantity={quantity} />
                  <span className="pan-n">{t.ingredient(id)}</span>
                  <span className="pan-q">{isBottomless ? "∞" : quantity}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {secret && (
        <div className="station st-secret">
          <div className="st-label">✨</div>
          <div className="pans">
            <button
              className={`pan secret-pan${secret.isOnBoard ? " on" : ""}`}
              disabled={!secret.canAdd && !secret.isOnBoard}
              aria-pressed={secret.isOnBoard}
              onClick={secret.onToggle}
              title={t("service.secretTitle")}
            >
              <SecretJar />
              <span className="pan-n">{t("service.secret")}</span>
              <span className="pan-q">{secret.stock}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
