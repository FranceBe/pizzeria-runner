import { findRecipeByIngredients } from "../../game/menu";
import { destinationOf, ovensOf } from "../../game/service";
import { warmthOf } from "../../game/streak";
import { useTranslation } from "../../i18n/I18nContext";
import { Pizza } from "../../components/Pizza";
import type { CoachTarget, GameState, Service } from "../../game/types";
import type { ServiceScreenProps } from "../types";
import { onTap } from "../../components/tap";
import { canOfferSlice } from "../../game/slice";

type WithCoach = ServiceScreenProps & { coachTarget: CoachTarget | null };

const Fire = () => {
  return (
    <svg className="oven-fire" viewBox="0 0 60 22" aria-hidden="true">
      <path className="fire-a" d="M8 22c-4-5 0-9 3-12 0 4 3 5 4 2 3 4 3 7 1 10z" />
      <path className="fire-b" d="M24 22c-5-6 0-12 5-16-1 5 3 7 5 3 4 5 4 10 1 13z" />
      <path className="fire-a" d="M42 22c-4-5 0-9 4-12-1 4 3 5 4 2 2 4 2 7 0 10z" />
    </svg>
  );
};

// Every oven, each with its own slots; with several, each gets a small label.
const Ovens = ({ state, service }: { state: GameState; service: Service }) => {
  const t = useTranslation();
  const ovens = ovensOf(state);
  return (
    <div className={`oven${ovens.length > 1 ? " multi" : ""}`}>
      {/* A single oven says it burns wood in its heading; several say it on their own label. */}
      <h3 className="h">{ovens.length === 1 && ovens[0].isWoodFired ? `${t("service.oven")} · ${t("service.woodFired")}` : t("service.oven")}</h3>
      <Fire />
      {ovens.map((oven) => {
        const pizzas = service.oven.filter((pizza) => (pizza.ovenIndex ?? 0) === oven.index);
        return (
          <div key={oven.index} className="oven-group">
            {ovens.length > 1 && (
              <div className="oven-label">
                {oven.isWoodFired ? `${t("service.ovenNumber", { number: oven.index + 1 })} · ${t("service.woodFired")}` : t("service.ovenNumber", { number: oven.index + 1 })}
              </div>
            )}
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
};

// The pass: baked pizzas waiting to be served.
const Pass = ({ state, service, dispatch, coachTarget }: WithCoach) => {
  const t = useTranslation();
  const unwantedCount = service.ready.filter((pizza) => !destinationOf(state, service, pizza.ingredients)).length;
  return (
    <div className="passe">
      {/* How many wait, so a pizza out of sight below is not forgotten. */}
      <h3 className="h">
        {t("service.pass")}
        {service.ready.length > 1 && <span className="passe-count">{service.ready.length}</span>}
      </h3>
      {service.ready.length === 0 && <p className="hint passe-empty">{t("service.passEmpty")}</p>}
      {unwantedCount > 1 && (
        <button className="btn sm ghost bin-all" {...onTap(() => dispatch({ type: "trashUnwantedPizzas" }))}>
          <span className="label-full">{t("service.trashUnwanted", { count: unwantedCount })}</span>
          <span className="label-short">{t("service.trashUnwantedShort", { count: unwantedCount })}</span>
        </button>
      )}
      {service.ready.map((pizza) => {
        const destination = destinationOf(state, service, pizza.ingredients);
        const customer = destination && "customer" in destination ? destination.customer : undefined;
        const warmth = warmthOf(pizza.waitingSeconds);
        const recipe = findRecipeByIngredients(state, pizza.ingredients);
        return (
          <div key={pizza.id} className={`ready${destination ? "" : " unwanted"} ${warmth}`}>
            <Pizza ingredients={pizza.ingredients} baked />
            <div className="grow">
              <div className="rn">
                {recipe ? t.recipe(recipe) : t("common.improvisedPizza")}
                {pizza.secret && <span aria-hidden="true"> ✨</span>}
              </div>
              <div className="hint rt">
                {customer ? t("service.forCustomer", { name: customer.name }) : destination ? t("service.forBatch") : t("service.nobodyWaiting")}
                {destination && warmth !== "hot" && <span className={`warmth ${warmth}`}>{` · ${t(`service.${warmth}`)}`}</span>}
              </div>
            </div>
            {/* Nobody waiting for it: sliced for the queue (when someone would enjoy it) or binned. */}
            <div className="ready-btns">
              {destination ? (
                <>
                  <button
                    className={`btn sm go${coachTarget === "serve" ? " coach-target" : ""}`}
                    {...onTap(() => dispatch({ type: "servePizza", pizzaId: pizza.id }))}
                  >
                    {t("service.serve")}
                  </button>
                  <button className="btn sm ghost" {...onTap(() => dispatch({ type: "trashReadyPizza", pizzaId: pizza.id }))}>
                    {t("common.trash")}
                  </button>
                </>
              ) : (
                <>
                  {canOfferSlice(state, service, pizza.id) && (
                    <button className="btn sm slice" title={t("service.offerSliceHint")} {...onTap(() => dispatch({ type: "offerSlice", pizzaId: pizza.id }))}>
                      {t("service.offerSlice")}
                    </button>
                  )}
                  <button className="btn sm bin" {...onTap(() => dispatch({ type: "trashReadyPizza", pizzaId: pizza.id }))}>
                    {t("common.trash")}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const OvenAndPass = ({ state, service, dispatch, coachTarget }: WithCoach) => {
  const t = useTranslation();
  return (
    <section className="a-oven" aria-label={t("service.ovenAndPass")}>
      <Ovens state={state} service={service} />
      <Pass state={state} service={service} dispatch={dispatch} coachTarget={coachTarget} />
    </section>
  );
};
