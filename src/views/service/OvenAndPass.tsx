import { findRecipeByIngredients } from "../../game/menu";
import { DRINKS, DRINK_IDS } from "../../data/drinks";
import { isRegularCustomer } from "../../game/customers";
import { selectedCustomer } from "../../game/service";
import { customerForPizza, ovensOf } from "../../game/service";
import { DrinkGlass } from "../../components/DrinkGlass";
import { useTranslation } from "../../i18n/I18nContext";
import { Pizza } from "../../components/Pizza";
import type { CoachTarget, GameState, Service } from "../../game/types";
import type { ServiceScreenProps } from "../types";

type WithCoach = ServiceScreenProps & { coachTarget: CoachTarget | null };

function Fire() {
  return (
    <svg className="oven-fire" viewBox="0 0 60 22" aria-hidden="true">
      <path className="fire-a" d="M8 22c-4-5 0-9 3-12 0 4 3 5 4 2 3 4 3 7 1 10z" />
      <path className="fire-b" d="M24 22c-5-6 0-12 5-16-1 5 3 7 5 3 4 5 4 10 1 13z" />
      <path className="fire-a" d="M42 22c-4-5 0-9 4-12-1 4 3 5 4 2 2 4 2 7 0 10z" />
    </svg>
  );
}

// Every oven, each with its own slots; with several, each gets a small label.
function Ovens({ state, service }: { state: GameState; service: Service }) {
  const t = useTranslation();
  const ovens = ovensOf(state);
  return (
    <div className={`oven${ovens.length > 1 ? " multi" : ""}`}>
      <h3 className="h">{t("service.oven")}</h3>
      <Fire />
      {ovens.map((oven) => {
        const pizzas = service.oven.filter((pizza) => (pizza.ovenIndex ?? 0) === oven.index);
        return (
          <div key={oven.index} className="oven-group">
            {ovens.length > 1 && <div className="oven-label">{t("service.ovenNumber", { number: oven.index + 1 })}</div>}
            <div className="slots">
              {Array.from({ length: oven.slots }, (_, slotIndex) => {
                const pizza = pizzas[slotIndex];
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
      })}
    </div>
  );
}

// The bar fridge: one button per drink on offer. Tapping one serves it to whoever ordered it.
function Bar({ state, service, dispatch }: ServiceScreenProps) {
  const t = useTranslation();
  const drinks = DRINK_IDS.filter((id) => DRINKS[id].barLevel <= state.upgrades.bar);
  if (!drinks.length || service.challenge) return null;
  const selected = selectedCustomer(service);
  const canOffer = selected?.drink && !selected.drinkServed && isRegularCustomer(state, selected);
  return (
    <div className="bar-rack">
      <h3 className="h">{t("service.bar")}</h3>
      <div className="drinks">
        {drinks.map((id) => {
          const isWanted = service.customers.some((customer) => customer.drink === id && !customer.drinkServed);
          return (
            <button
              key={id}
              className={`drink-btn${isWanted ? " wanted" : ""}`}
              title={t("service.drinkTitle", { drink: t.drink(id) })}
              onClick={() => dispatch({ type: "serveDrink", drinkId: id })}
            >
              <DrinkGlass id={id} />
              <span>{t.drink(id)}</span>
            </button>
          );
        })}
      </div>
      {canOffer && selected.drink && (
        <button className="btn sm offer-btn" onClick={() => dispatch({ type: "offerDrink" })}>
          {t("service.offerDrink", { drink: t.drink(selected.drink).toLowerCase(), name: selected.name })}
          <kbd className="kbd">O</kbd>
        </button>
      )}
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
              <div className="rn">
                {recipe ? t.recipe(recipe) : t("common.improvisedPizza")}
                {pizza.secret && <span aria-hidden="true"> ✨</span>}
              </div>
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
      <Ovens state={state} service={service} />
      <Pass state={state} service={service} dispatch={dispatch} coachTarget={coachTarget} />
      <Bar state={state} service={service} dispatch={dispatch} />
    </section>
  );
}
