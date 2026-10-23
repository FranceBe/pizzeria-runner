import { useState } from "react";
import { INGREDIENTS } from "../data/ingredients";
import { CLASSIC_RECIPES } from "../data/recipes";
import { MAMMA_CRAFT_COST, MAMMA_JAR_PORTIONS, SECRET_CRAFT_COST, SECRET_JAR_PORTIONS } from "../data/progression";
import { SUPPLIER_WELCOME_PORTIONS } from "../game/actions/shopActions";
import { canBorrowFromNonna, NONNA_LOAN, restockPlan, type RestockPlan } from "../game/economy";
import { marketPrice } from "../game/events";
import { isInSeason } from "../game/seasons";
import { FESTIVALS } from "../data/festivals";
import { knowsRecipe } from "../game/menu";
import { levelForXp } from "../game/progression";
import { useTranslation } from "../i18n/I18nContext";
import { canAfford } from "../utils/math";
import { IngredientIcon } from "../components/IngredientIcon";
import type { ScreenProps } from "./types";

const BUY_QUANTITIES = [1, 5, 10];
const RESTOCK_TARGETS = [10, 20] as const;

const Fridge = ({ state, dispatch }: ScreenProps) => {
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
      {state.money < NONNA_LOAN && canBorrowFromNonna(state) && (
        <div className="loan-offer">
          <button className="btn sm" onClick={() => dispatch({ type: "borrowFromNonna" })}>{t("service.borrow", { amount: NONNA_LOAN })}</button>
          <span className="hint">{t("service.borrowHint")}</span>
        </div>
      )}
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
              {ingredient.festival ? (
                <span className="crate-season crate-festive">{`${FESTIVALS[ingredient.festival].emoji} ${t("market.festive")}`}</span>
              ) : (
                isInSeason(state, ingredient.id) && <span className="crate-season">{t("market.inSeason")}</span>
              )}
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
};

// The secret ingredients, once shared: made by hand, a jar at a time, never part of the restock buttons.
interface SecretCardProps {
  title: string;
  intro: string;
  bonus: string;
  icon: string;
  stock: number;
  cost: number;
  portions: number;
  onCraft: () => void;
  money: number;
}

// A secret ingredient, made at the market a jar at a time.
const SecretCard = ({ title, intro, bonus, icon, stock, cost, portions, onCraft, money }: SecretCardProps) => {
  const t = useTranslation();
  // A button, not a hover tooltip: phones have no hover.
  const [isExplained, setExplained] = useState(false);
  return (
    <div className="card pad secret-card">
      <div className="row">
        <h2 className="h grow">{title}</h2>
        <button
          className="secret-info"
          aria-expanded={isExplained}
          aria-label={t("market.secretWhat")}
          title={t("market.secretWhat")}
          onClick={() => setExplained(!isExplained)}
        >
          ⓘ
        </button>
      </div>
      <p className="sub">{`${intro} ${t("market.secretJar", { portions })}`}</p>
      {isExplained && <p className="secret-bonus">{bonus}</p>}
      <div className="row">
        <span className="secret-stock">{`${icon} ${t("market.secretStock", { count: stock })}`}</span>
        <button className="btn primary" title={bonus} disabled={!canAfford(money, cost)} onClick={onCraft}>
          {t("market.craft", { cost })}
        </button>
      </div>
    </div>
  );
};

const Secrets = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  return (
    <>
      {state.secretIngredient && (
        <SecretCard
          title={t("market.secretTitle")}
          intro={t("market.secretIntro")}
          bonus={t("market.secretBonus")}
          icon="✨"
          stock={state.secretStock}
          cost={SECRET_CRAFT_COST}
          portions={SECRET_JAR_PORTIONS}
          money={state.money}
          onCraft={() => dispatch({ type: "craftSecret" })}
        />
      )}
      {state.mammaSecret && (
        <SecretCard
          title={t("market.mammaTitle")}
          intro={t("market.mammaIntro")}
          bonus={t("market.mammaBonus")}
          icon="💛"
          stock={state.mammaStock}
          cost={MAMMA_CRAFT_COST}
          portions={MAMMA_JAR_PORTIONS}
          money={state.money}
          onCraft={() => dispatch({ type: "craftMamma" })}
        />
      )}
    </>
  );
};

const Suppliers = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const level = levelForXp(state.xp);
  // Festival ingredients come with the calendar, not from a supplier.
  const lockedIngredients = INGREDIENTS.filter((ingredient) => !state.unlocked[ingredient.id] && !ingredient.festival);
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
                {helpsWith.length > 0 && t("market.usefulFor", { recipes: t.list(helpsWith.map(t.recipe)) })}
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
};

export const MarketView = ({ state, dispatch }: ScreenProps) => {
  return (
    <div className="market">
      <div className="market-main">
        <Fridge state={state} dispatch={dispatch} />
        <Secrets state={state} dispatch={dispatch} />
      </div>
      <Suppliers state={state} dispatch={dispatch} />
    </div>
  );
};
