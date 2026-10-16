import { INGREDIENTS, KIND_LABELS } from "../data/ingredients.js";
import { CLASSIC_RECIPES } from "../data/recipes.js";
import { restockPlan } from "../game/economy.js";
import { knowsRecipe } from "../game/menu.js";
import { levelForXp } from "../game/progression.js";
import { formatEuro } from "../utils/format.js";
import { canAfford } from "../utils/math.js";
import { IngredientIcon } from "../components/IngredientIcon.jsx";

const BUY_QUANTITIES = [1, 5, 10];
const RESTOCK_TARGETS = [10, 20];

// "Fromages" -> "fromage"
const singularKindLabel = (kind) => KIND_LABELS[kind].toLowerCase().replace(/s$/, "");

function Fridge({ state, dispatch }) {
  const ownedIngredients = INGREDIENTS.filter((ingredient) => state.unlocked[ingredient.id]);
  const [smallRestock, bigRestock] = RESTOCK_TARGETS.map((target) => restockPlan(state, target));
  const canRestock = (plan) => plan.items.length > 0 && plan.cost <= state.money;
  return (
    <div className="card pad">
      <h2 className="h">Le frigo</h2>
      <p className="sub" style={{ marginBottom: 10 }}>Les ingrédients ne s'abîment pas. Achète au rythme de ta caisse.</p>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn sm" disabled={!canRestock(smallRestock)} onClick={() => dispatch({ type: "restock", targetQuantity: RESTOCK_TARGETS[0] })}>
          Compléter la carte à {RESTOCK_TARGETS[0]} · {formatEuro(smallRestock.cost)}
        </button>
        <button className="btn sm" disabled={!canRestock(bigRestock)} onClick={() => dispatch({ type: "restock", targetQuantity: RESTOCK_TARGETS[1] })}>
          à {RESTOCK_TARGETS[1]} · {formatEuro(bigRestock.cost)}
        </button>
      </div>
      {ownedIngredients.map((ingredient) => (
        <div key={ingredient.id} className="mrow">
          <IngredientIcon id={ingredient.id} className="ic" />
          <div className="grow">
            <div className="mn">{ingredient.name}</div>
            <div className="mm">{formatEuro(ingredient.cost)} la portion</div>
          </div>
          <span className="qty">{state.stock[ingredient.id] || 0}</span>
          <div className="row" style={{ gap: 4 }}>
            {BUY_QUANTITIES.map((quantity) => (
              <button
                key={quantity}
                className="btn sm"
                disabled={!canAfford(state.money, ingredient.cost * quantity)}
                onClick={() => dispatch({ type: "buyIngredient", ingredientId: ingredient.id, quantity })}
              >
                +{quantity}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Suppliers({ state, dispatch }) {
  const level = levelForXp(state.xp);
  const lockedIngredients = INGREDIENTS.filter((ingredient) => !state.unlocked[ingredient.id]);
  return (
    <div className="card pad">
      <h2 className="h">Fournisseurs</h2>
      <p className="sub" style={{ marginBottom: 10 }}>
        Chaque nouveau fournisseur ajoute un ingrédient, peut débloquer une recette classique et t'offre 4 portions.
      </p>
      {lockedIngredients.length === 0 && <p className="sub">Tu travailles avec tous les fournisseurs de la région.</p>}
      {lockedIngredients.map((ingredient) => {
        const isAvailable = level >= ingredient.requiredLevel;
        const helpsWith = CLASSIC_RECIPES.filter(
          (classic) => classic.ingredients.includes(ingredient.id) && !knowsRecipe(state, classic.id),
        );
        return (
          <div key={ingredient.id} className={`mrow${isAvailable ? "" : " locked"}`}>
            <IngredientIcon id={ingredient.id} className="ic" />
            <div className="grow">
              <div className="mn">
                {ingredient.name} <span className="hint" style={{ fontWeight: 500 }}>· {singularKindLabel(ingredient.kind)}</span>
              </div>
              <div className="mm">
                {formatEuro(ingredient.cost)} la portion
                {helpsWith.length ? ` · utile pour ${helpsWith.map((classic) => classic.name).join(", ")}` : ""}
              </div>
            </div>
            {isAvailable ? (
              <button
                className="btn sm primary"
                disabled={state.money < ingredient.supplierFee}
                onClick={() => dispatch({ type: "signSupplier", ingredientId: ingredient.id })}
              >
                Signer · {formatEuro(ingredient.supplierFee)}
              </button>
            ) : (
              <span className="tag">Niveau {ingredient.requiredLevel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MarketView({ state, dispatch }) {
  return (
    <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
      <Fridge state={state} dispatch={dispatch} />
      <Suppliers state={state} dispatch={dispatch} />
    </div>
  );
}
