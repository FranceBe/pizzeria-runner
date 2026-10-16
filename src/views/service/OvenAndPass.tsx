import { findRecipeByIngredients } from "../../game/menu";
import { customerForPizza, ovenSlots } from "../../game/service";
import { useTranslation } from "../../i18n/I18nContext";
import { Pizza } from "../../components/Pizza";
import type { CoachTarget, GameState, Service } from "../../game/types";
import type { ServiceScreenProps } from "../types";

type WithCoach = ServiceScreenProps & { coachTarget: CoachTarget | null };

function Oven({ state, service }: { state: GameState; service: Service }) {
  const t = useTranslation();
  const { oven } = service;
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
function Pass({ state, service, dispatch, coachTarget }: WithCoach) {
  const t = useTranslation();
  return (
    <div className="passe">
      <h3 className="h">{t("service.pass")}</h3>
      {service.ready.length === 0 && <p className="hint passe-empty">{t("service.passEmpty")}</p>}
      {service.ready.map((pizza) => {
        const customer = customerForPizza(service, pizza.ingredients);
        const recipe = findRecipeByIngredients(state, pizza.ingredients);
        return (
          <div key={pizza.id} className="ready">
            <Pizza ingredients={pizza.ingredients} baked />
            <div className="grow">
              <div className="rn">{recipe ? t.recipe(recipe) : t("common.improvisedPizza")}</div>
              <div className="hint rt">
                {customer ? t("service.forCustomer", { name: customer.name }) : t("service.nobodyWaiting")}
              </div>
            </div>
            <div className="ready-btns">
              <button
                className={`btn sm go${coachTarget === "serve" && customer ? " coach-target" : ""}`}
                onClick={() => dispatch({ type: "servePizza", pizzaId: pizza.id })}
                disabled={!customer}
              >
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

export function OvenAndPass({ state, service, dispatch, coachTarget }: WithCoach) {
  const t = useTranslation();
  return (
    <section className="a-oven" aria-label={t("service.ovenAndPass")}>
      <Oven state={state} service={service} />
      <Pass state={state} service={service} dispatch={dispatch} coachTarget={coachTarget} />
    </section>
  );
}
