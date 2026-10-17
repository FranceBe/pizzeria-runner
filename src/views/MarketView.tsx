import { INGREDIENTS } from "../data/ingredients";
import { CLASSIC_RECIPES } from "../data/recipes";
import { SECRET_CRAFT_COST } from "../data/progression";
import { SUPPLIER_WELCOME_PORTIONS } from "../game/actions/shopActions";
import { restockPlan, type RestockPlan } from "../game/economy";
import { marketPrice } from "../game/events";
import { isInSeason } from "../game/seasons";
import { knowsRecipe } from "../game/menu";
import { levelForXp } from "../game/progression";
import { useTranslation } from "../i18n/I18nContext";
import { canAfford } from "../utils/math";
import { IngredientIcon } from "../components/IngredientIcon";
import type { ScreenProps } from "./types";

const BUY_QUANTITIES = [1, 5, 10];
const RESTOCK_TARGETS = [10, 20] as const;

function Fridge({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  const ownedIngredients = INGREDIENTS.filter((ingredient) => state.unlocked[ingredient.id]);
  const [smallTarget, bigTarget] = RESTOCK_TARGETS;
  const smallRestock = restockPlan(state, smallTarget);
  const bigRestock = restockPlan(state, bigTarget);
  const canRestock = (plan: RestockPlan) => plan.items.length > 0 && plan.cost <= state.money;
  return (
    <div className="card pad">
      <h2 className="h">{t("market.stall")}</h2>
      <p className="sub" style={{ marginBottom: 10 }}>{t("market.fridgeIntro")}</p>
      {state.event === "market" && <p className="market-day">{t("market.marketDay")}</p>}
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" disabled={!canRestock(smallRestock)} onClick={() => dispatch({ type: "restock", targetQuantity: smallTarget })}>
          {t("market.restockMenu", { target: smallTarget, cost: smallRestock.cost })}
        </button>
        <button className="btn sm" disabled={!canRestock(bigRestock)} onClick={() => dispatch({ type: "restock", targetQuantity: bigTarget })}>
          {t("market.restockMore", { target: bigTarget, cost: bigRestock.cost })}
        </button>
      </div>
      <div className="crates">
        {ownedIngredients.map((ingredient) => {
          const price = marketPrice(state, ingredient.id);
          const quantity = state.stock[ingredient.id] || 0;
          return (
            <div key={ingredient.id} className="crate">
              <span className={`crate-qty${quantity < 5 ? " low" : ""}`}>{quantity}</span>
              <IngredientIcon id={ingredient.id} className="crate-ic" />
              {isInSeason(state, ingredient.id) && <span className="crate-season">{t("market.inSeason")}</span>}
              <div className="crate-n">{t.ingredient(ingredient.id)}</div>
              <div className="price-tag">
                {price < ingredient.cost && <s>{t.money(ingredient.cost)}</s>} {t.money(price)}
              </div>
              <div className="crate-btns">
                {BUY_QUANTITIES.map((amount) => (
                  <button
                    key={amount}
                    className="btn sm"
                    disabled={!canAfford(state.money, price * amount)}
                    onClick={() => dispatch({ type: "buyIngredient", ingredientId: ingredient.id, quantity: amount })}
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Nonna's secret, once shared: made by hand, one jar at a time, never part of the restock buttons.
function NonnasSecret({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  if (!state.secretIngredient) return null;
  return (
    <div className="card pad secret-card">
      <div className="row">
        <h2 className="h grow">{t("market.secretTitle")}</h2>
        <span className="secret-info" title={t("market.secretBonus")} aria-label={t("market.secretBonus")} tabIndex={0}>ⓘ</span>
      </div>
      <p className="sub">{t("market.secretIntro")}</p>
      <div className="row">
        <span className="secret-stock">✨ {t("market.secretStock", { count: state.secretStock })}</span>
        <button
          className="btn primary"
          title={t("market.secretBonus")}
          disabled={!canAfford(state.money, SECRET_CRAFT_COST)}
          onClick={() => dispatch({ type: "craftSecret" })}
        >
          {t("market.craft", { cost: SECRET_CRAFT_COST })}
        </button>
      </div>
    </div>
  );
}

function Suppliers({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  const level = levelForXp(state.xp);
  const lockedIngredients = INGREDIENTS.filter((ingredient) => !state.unlocked[ingredient.id]);
  return (
    <div className="card pad">
      <h2 className="h">{t("market.suppliers")}</h2>
      <p className="sub" style={{ marginBottom: 10 }}>{t("market.suppliersIntro", { portions: SUPPLIER_WELCOME_PORTIONS })}</p>
      {lockedIngredients.length === 0 && <p className="sub">{t("market.allSuppliers")}</p>}
      <div className="supplier-list">
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
    </div>
  );
}

export function MarketView({ state, dispatch }: ScreenProps) {
  return (
    <div className="market">
      <div className="market-main">
        <Fridge state={state} dispatch={dispatch} />
        <NonnasSecret state={state} dispatch={dispatch} />
      </div>
      <Suppliers state={state} dispatch={dispatch} />
    </div>
  );
}
