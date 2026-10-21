import { PREP_STATIONS, type IngredientId } from "../../data/ingredients";
import { useTranslation } from "../../i18n/I18nContext";
import { IngredientPan } from "../../components/IngredientPan";
import type { CoachTarget, GameState } from "../../game/types";

interface PanState {
  isOnBoard: boolean;
  isNeeded: boolean;
  /** The commis has pushed this pan back: the order being built doesn't use it. */
  isPushedBack: boolean;
  isCoachTarget: boolean;
  quantity: number;
}

export interface SecretJarState {
  id: "nonna" | "mamma";
  isOnBoard: boolean;
  canAdd: boolean;
  stock: number;
  onToggle: () => void;
}

interface PrepLineProps {
  state: GameState;
  /** During a challenge, every pan is full and nothing runs out. */
  isBottomless: boolean;
  /** Shown even if not unlocked: the daily challenge's recipes need them. */
  extraIngredients?: readonly IngredientId[];
  board: readonly IngredientId[];
  neededIngredients: readonly IngredientId[];
  /** What the order being built is made of, help or not (the commis knows it). */
  orderIngredients?: readonly IngredientId[];
  /** 0 = no commis help; 1, 2 = the pans that order doesn't need fade more and more. */
  fadeLevel?: number;
  coachTarget: CoachTarget | null;
  onPickIngredient: (id: IngredientId) => void;
  /** Late delivery: this ingredient's pan is waiting for the delivery. */
  stillComing?: IngredientId | null;
  /** The secret ingredients, once shared: extra jars at the end of the line. */
  secrets?: SecretJarState[];
}

// A small jar: Nonna's with a sparkle, Mamma's with a heart.
const SecretJar = ({ id }: { id: SecretJarState["id"] }) => {
  const isMamma = id === "mamma";
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="1" y="1" width="58" height="58" rx="6" fill={isMamma ? "#4a2433" : "#3a2a3f"} />
      <path d="M20 18h20v4c4 2 6 6 6 11v13a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V33c0-5 2-9 6-11Z" fill={isMamma ? "#fde3ea" : "#f6ead0"} opacity=".9" />
      <rect x="19" y="12" width="22" height="7" rx="2" fill={isMamma ? "#e0a020" : "#c63a21"} />
      {isMamma ? (
        <path d="M30 44c-7-5-10-8.5-10-12a5 5 0 0 1 10-1.5A5 5 0 0 1 40 32c0 3.5-3 7-10 12Z" fill="#e5487a" />
      ) : (
        <path d="M30 28l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#e0a020" />
      )}
    </svg>
  );
};

const LOW_PAN_THRESHOLD = 3;
const FULL_PAN = 12;

const panClassName = ({ isOnBoard, isNeeded, isPushedBack, isCoachTarget, quantity }: PanState): string => {
  let className = "pan";
  if (isOnBoard) className += " on";
  else if (isNeeded) className += " need";
  else if (isPushedBack) className += " pushed-back";
  if (isCoachTarget) className += " coach-target";
  if (quantity < LOW_PAN_THRESHOLD) className += " low";
  return className;
};

// Which pans the tutorial points at for its current step.
const isCoachPan = (coachTarget: CoachTarget | null, id: IngredientId, isOnBoard: boolean, isNeeded: boolean): boolean => {
  if (coachTarget === "dough") return id === "pate";
  if (coachTarget === "toppings") return isNeeded && !isOnBoard;
  return false;
};

// The row of ingredient pans along the bottom of the service screen.
// Pans the selected order still needs get a dashed outline.
export const PrepLine = ({
  state, isBottomless, extraIngredients = [], board, neededIngredients, orderIngredients = [], fadeLevel = 0, coachTarget,
  onPickIngredient, secrets = [], stillComing,
}: PrepLineProps) => {
  const t = useTranslation();
  const stations = PREP_STATIONS.map((station) => ({
    ...station,
    ingredientIds: station.ingredientIds.filter((id) => state.unlocked[id] || extraIngredients.includes(id)),
  })).filter((station) => station.ingredientIds.length);

  return (
    <section className={`rail${fadeLevel ? ` fade-${fadeLevel}` : ""}`} aria-label={t("service.prepLine")}>
      {stations.map((station) => (
        <div key={station.id} className={`station st-${station.id}`}>
          <div className="st-label">{t(`stations.${station.id}`)}</div>
          <div className="pans">
            {station.ingredientIds.map((id) => {
              const quantity = isBottomless ? FULL_PAN : state.stock[id] || 0;
              const isComing = id === stillComing;
              const isOnBoard = board.includes(id);
              const isNeeded = neededIngredients.includes(id);
              const isPushedBack = fadeLevel > 0 && orderIngredients.length > 0 && !orderIngredients.includes(id);
              return (
                <button
                  key={id}
                  className={panClassName({ isOnBoard, isNeeded, isPushedBack, quantity, isCoachTarget: isCoachPan(coachTarget, id, isOnBoard, isNeeded) })}
                  disabled={isComing || (!isOnBoard && quantity === 0)}
                  aria-pressed={isOnBoard}
                  onClick={() => onPickIngredient(id)}
                  title={isBottomless ? t.ingredient(id) : t("service.panTitle", { id, quantity })}
                >
                  <IngredientPan id={id} quantity={quantity} />
                  <span className="pan-n">{t.ingredient(id)}</span>
                  <span className="pan-q">{isBottomless ? "∞" : quantity}</span>
                  {isComing && <span className="pan-coming">{`🚚 ${t("service.stillComing")}`}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {secrets.length > 0 && (
        <div className="station st-secret">
          <div className="st-label">✨</div>
          <div className="pans">
            {secrets.map((secret) => (
              <button
                key={secret.id}
                className={`pan secret-pan${secret.isOnBoard ? " on" : ""}`}
                disabled={!secret.canAdd && !secret.isOnBoard}
                aria-pressed={secret.isOnBoard}
                onClick={secret.onToggle}
                title={t(secret.id === "mamma" ? "service.mammaTitle" : "service.secretTitle")}
              >
                <SecretJar id={secret.id} />
                {/* Just the name under the jar: "… secret" twice would be cut to the same word on a phone */}
                <span className="pan-n">{t(secret.id === "mamma" ? "service.mammaPan" : "service.secretPan")}</span>
                <span className="pan-q">{secret.stock}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
