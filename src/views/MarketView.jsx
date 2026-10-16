import { INGREDIENTS } from "../data/ingredients.js";
import { CLASSIC_RECIPES } from "../data/recipes.js";
import { SUPPLIER_WELCOME_PORTIONS } from "../game/actions/shopActions.js";
import { restockPlan } from "../game/economy.js";
import { knowsRecipe } from "../game/menu.js";
import { levelForXp } from "../game/progression.js";
import { useTranslation } from "../i18n/I18nContext.jsx";
import { canAfford } from "../utils/math.js";
import { IngredientIcon } from "../components/IngredientIcon.jsx";

const BUY_QUANTITIES = [1, 5, 10];
const RESTOCK_TARGETS = [10, 20];

function Fridge({ state, dispatch }) {
  const t = useTranslation();
  const ownedIngredients = INGREDIENTS.filter((ingredient) => state.unlocked[ingredient.id]);
  const [smallTarget, bigTarget] = RESTOCK_TARGETS;
  const smallRestock = restockPlan(state, smallTarget);
  const bigRestock = restockPlan(state, bigTarget);
  const canRestock = (plan) => plan.items.length > 0 && plan.cost <= state.money;
  return (
    <div className="card pad">
      <h2 className="h">{t("market.fridge")}</h2>
      <p className="sub" style={{ marginBottom: 10 }}>{t("market.fridgeIntro")}</p>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn sm" disabled={!canRestock(smallRestock)} onClick={() => dispatch({ type: "restock", targetQuantity: smallTarget })}>
          {t("market.restockMenu", { target: smallTarget, cost: smallRestock.cost })}
        </button>
        <button className="btn sm" disabled={!canRestock(bigRestock)} onClick={() => dispatch({ type: "restock", targetQuantity: bigTarget })}>
          {t("market.restockMore", { target: bigTarget, cost: bigRestock.cost })}
        </button>
      </div>
      {ownedIngredients.map((ingredient) => (
        <div key={ingredient.id} className="mrow">
          <IngredientIcon id={ingredient.id} className="ic" />
          <div className="grow">
            <div className="mn">{t.ingredient(ingredient.id)}</div>
            <div className="mm">{t("market.perPortion", { price: ingredient.cost })}</div>
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
  const t = useTranslation();
  const level = levelForXp(state.xp);
  const lockedIngredients = INGREDIENTS.filter((ingredient) => !state.unlocked[ingredient.id]);
  return (
    <div className="card pad">
      <h2 className="h">{t("market.suppliers")}</h2>
      <p className="sub" style={{ marginBottom: 10 }}>{t("market.suppliersIntro", { portions: SUPPLIER_WELCOME_PORTIONS })}</p>
      {lockedIngredients.length === 0 && <p className="sub">{t("market.allSuppliers")}</p>}
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
                {t.ingredient(ingredient.id)} <span className="hint" style={{ fontWeight: 500 }}>· {t(`kinds.${ingredient.kind}`)}</span>
              </div>
              <div className="mm">
                {t("market.perPortion", { price: ingredient.cost })}
                {helpsWith.length > 0 && t("market.usefulFor", { recipes: helpsWith.map(t.recipe).join(", ") })}
              </div>
            </div>
            {isAvailable ? (
              <button
                className="btn sm primary"
                disabled={state.money < ingredient.supplierFee}
                onClick={() => dispatch({ type: "signSupplier", ingredientId: ingredient.id })}
              >
                {t("market.sign", { fee: ingredient.supplierFee })}
              </button>
            ) : (
              <span className="tag">{t("common.level", { level: ingredient.requiredLevel })}</span>
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
