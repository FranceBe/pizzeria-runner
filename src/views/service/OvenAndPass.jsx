import { findRecipeByIngredients } from "../../game/menu.js";
import { customerForPizza, ovenSlots } from "../../game/service.js";
import { useTranslation } from "../../i18n/I18nContext.jsx";
import { Pizza } from "../../components/Pizza.jsx";

function Oven({ state }) {
  const t = useTranslation();
  const { oven } = state.service;
  return (
    <div className="oven">
      <h3 className="h">{t("service.oven")}</h3>
      <div className="slots">
        {Array.from({ length: ovenSlots(state) }, (_, slotIndex) => {
          const pizza = oven[slotIndex];
          if (!pizza) return <div key={slotIndex} className="slot idle">{t("service.freeSlot")}</div>;
          const progress = Math.min(100, (pizza.bakedSeconds / pizza.bakeDuration) * 100);
          return (
            <div key={pizza.id} className="slot">
              <Pizza ingredients={pizza.ingredients} className="glow" />
              <div className="bar"><i style={{ width: progress + "%" }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The pass: baked pizzas waiting to be served.
function Pass({ state, dispatch }) {
  const t = useTranslation();
  const { service } = state;
  return (
    <div className="passe">
      <h3 className="h" style={{ marginTop: 14 }}>{t("service.pass")}</h3>
      {service.ready.length === 0 && <p className="hint" style={{ margin: 0 }}>{t("service.passEmpty")}</p>}
      {service.ready.map((pizza) => {
        const customer = customerForPizza(service, pizza.ingredients);
        const recipe = findRecipeByIngredients(state, pizza.ingredients);
        return (
          <div key={pizza.id} className="ready">
            <Pizza ingredients={pizza.ingredients} baked />
            <div className="grow">
              <div className="rn">{recipe ? t.recipe(recipe) : t("common.improvisedPizza")}</div>
              <div className="hint" style={{ fontSize: 12 }}>
                {customer ? t("service.forCustomer", { name: customer.name }) : t("service.nobodyWaiting")}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button className="btn sm go" onClick={() => dispatch({ type: "servePizza", pizzaId: pizza.id })} disabled={!customer}>
                {t("service.serve")}
              </button>
              <button className="btn sm ghost" onClick={() => dispatch({ type: "trashReadyPizza", pizzaId: pizza.id })}>
                {t("common.trash")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OvenAndPass({ state, dispatch }) {
  const t = useTranslation();
  return (
    <section aria-label={t("service.ovenAndPass")}>
      <Oven state={state} />
      <Pass state={state} dispatch={dispatch} />
    </section>
  );
}
