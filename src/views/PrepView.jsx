import { MARGHERITA } from "../data/recipes.js";
import { dailyCharges, forecastCustomers } from "../game/economy.js";
import { activeMenu, isNewRecipe } from "../game/menu.js";
import { ingredientCost } from "../game/pizza.js";
import { levelForXp, menuCapacity } from "../game/progression.js";
import { regularsOf } from "../game/regulars.js";
import { tutorialStep } from "../game/tutorial.js";
import { useTranslation } from "../i18n/I18nContext.jsx";
import { CoachTip } from "../components/CoachTip.jsx";
import { CustomerFace } from "../components/CustomerFace.jsx";
import { Pizza } from "../components/Pizza.jsx";

const LOW_STOCK_THRESHOLD = 5;

// Nonna offers help when nothing on the menu can be made and a few margheritas are unaffordable.
function needsNonna(state, menu) {
  const canMakeSomething = menu.some((recipe) => recipe.ingredients.every((id) => (state.stock[id] || 0) > 0));
  const isBroke = state.money < ingredientCost(MARGHERITA.ingredients) * 3;
  return !canMakeSomething && isBroke && state.lastNonnaVisitDay !== state.day;
}

const MAX_REGULARS_SHOWN = 5;

function Regulars({ state }) {
  const t = useTranslation();
  const regulars = regularsOf(state).slice(0, MAX_REGULARS_SHOWN);
  if (!regulars.length) return null;
  return (
    <div className="regulars">
      <h3 className="h">{t("prep.regulars")}</h3>
      {regulars.map((regular) => (
        <div key={regular.name} className="regular-row">
          <CustomerFace customer={regular} mood={0} />
          <div className="grow">
            <strong>{regular.name}</strong>
            <div className="hint">
              {t("prep.regularLine", {
                recipe: t.recipe(state.recipes.find((r) => r.id === regular.favoriteRecipeId) ?? { id: regular.favoriteRecipeId, name: "" }),
                visits: regular.visits,
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrepView({ state, dispatch, goToTab }) {
  const t = useTranslation();
  const expectedCustomers = forecastCustomers(state);
  const menu = activeMenu(state);
  const level = levelForXp(state.xp);
  const usedIngredients = [...new Set(menu.flatMap((recipe) => recipe.ingredients))];
  const lowStock = usedIngredients.filter((id) => (state.stock[id] || 0) < LOW_STOCK_THRESHOLD);
  const tutorial = tutorialStep(state);

  return (
    <div className="prep">
      <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {tutorial && <CoachTip step={tutorial} dispatch={dispatch} />}
        <div>
          <h2 className="h">{t("prep.title", { day: state.day })}</h2>
          <p className="sub">{t("prep.intro")}</p>
        </div>
        <div className="row" style={{ alignItems: "flex-end", gap: 24 }}>
          <div>
            <div className="forecast">{expectedCustomers}</div>
            <div className="hint">{t("prep.expectedCustomers")}</div>
          </div>
          <dl className="kv">
            <dt>{t("prep.pizzasOnMenu")}</dt>
            <dd>{menu.length} / {menuCapacity(level)}</dd>
            <dt>{t("prep.eveningCharges")}</dt>
            <dd>{t.money(dailyCharges(state))}</dd>
            {state.debt > 0 && (
              <>
                <dt>{t("prep.currentDebt")}</dt>
                <dd className="neg">{t.money(state.debt)}</dd>
              </>
            )}
          </dl>
        </div>
        {lowStock.length > 0 && (
          <div>
            <strong>{t("prep.lowStock")}</strong>
            <ul className="warnlist">
              {lowStock.map((id) => (
                <li key={id}>{t("prep.stockLine", { id, quantity: state.stock[id] || 0 })}</li>
              ))}
            </ul>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => goToTab("market")}>{t("prep.goToMarket")}</button>
          </div>
        )}
        {needsNonna(state, menu) && (
          <div className="card pad" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
            <p style={{ margin: "0 0 8px" }}>{t("prep.nonnaOffer")}</p>
            <button className="btn" onClick={() => dispatch({ type: "callNonna" })}>{t("prep.callNonna")}</button>
          </div>
        )}
        <div>
          <button
            className={`btn primary big${tutorial?.target === "open" ? " coach-target" : ""}`}
            onClick={() => dispatch({ type: "openRestaurant" })}
            disabled={!expectedCustomers}
          >
            {t("prep.open")}
          </button>
        </div>
      </div>

      <div className="card pad">
        <h3 className="h">{t("prep.tonightsMenu")}</h3>
        {menu.length === 0 && <p className="sub">{t("prep.emptyMenu")}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {menu.map((recipe) => (
            <div key={recipe.id} className="row" style={{ flexWrap: "nowrap" }}>
              <Pizza ingredients={recipe.ingredients} baked size={44} />
              <div className="grow">
                <strong>{t.recipe(recipe)}</strong> {isNewRecipe(state, recipe) && <span className="tag">{t("common.new")}</span>}
                <div className="hint">{t.toppings(recipe.ingredients)}</div>
              </div>
              <strong>{t.money(recipe.price)}</strong>
            </div>
          ))}
        </div>
        <Regulars state={state} />
      </div>
    </div>
  );
}
