import { COMMIS_ASSEMBLES_ORDER } from "../../data/progression.js";
import { ovenSlots } from "../../game/service.js";
import { haveSameIngredients } from "../../game/pizza.js";
import { useTranslation } from "../../i18n/I18nContext.jsx";
import { Pizza } from "../../components/Pizza.jsx";
import { OrderTicket } from "./OrderTicket.jsx";
import { OvenAndPass } from "./OvenAndPass.jsx";
import { PrepLine } from "./PrepLine.jsx";

// With help on: tells how the pizza being built compares to the selected order.
function BoardCheck({ customer, board }) {
  const t = useTranslation();
  if (haveSameIngredients(customer.ingredients, board)) return <span className="match good">{t("service.readyFor", { name: customer.name })}</span>;
  const missing = customer.ingredients.filter((id) => !board.includes(id)).length;
  const extra = board.filter((id) => !customer.ingredients.includes(id)).length;
  return <span className="match">{t("service.boardCheck", { name: customer.name, missing, extra })}</span>;
}

function WorkBoard({ state, dispatch, selectedCustomer }) {
  const t = useTranslation();
  const { board, oven } = state.service;
  const ovenIsFull = oven.length >= ovenSlots(state);
  return (
    <section aria-label={t("service.workBoard")}>
      <div className="peel">
        {board.length ? <Pizza ingredients={board} className="pizza" /> : <div className="empty">{t("service.emptyBoard")}</div>}
        {selectedCustomer && board.length > 0 && state.settings.showHelp && <BoardCheck customer={selectedCustomer} board={board} />}
        <div className="row" style={{ justifyContent: "center" }}>
          {state.upgrades.commis >= COMMIS_ASSEMBLES_ORDER && selectedCustomer && (
            <button className="btn sm" onClick={() => dispatch({ type: "assembleOrder" })}>
              {t("service.commisAssemble", { recipe: t.recipe({ id: selectedCustomer.recipeId, name: selectedCustomer.recipeName }) })}
            </button>
          )}
          <button className="btn sm" disabled={!board.length} onClick={() => dispatch({ type: "trashBoard" })}>{t("common.trash")}</button>
          <button className="btn primary" disabled={!board.includes("pate") || ovenIsFull} onClick={() => dispatch({ type: "bake" })}>
            {ovenIsFull ? t("service.ovenFull") : t("service.bake")}
          </button>
        </div>
      </div>
    </section>
  );
}

export function ServiceView({ state, dispatch }) {
  const t = useTranslation();
  const { service } = state;
  const selectedCustomer = service.customers.find((customer) => customer.id === service.selectedCustomerId);
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 className="h" style={{ margin: 0 }}>{t("service.title", { day: state.day })}</h2>
        <span className="hint">
          {t("service.progress", { served: service.stats.served, remaining: service.customersToCome + service.customers.length })}
        </span>
      </div>
      <div className="line">
        <section aria-label={t("service.orders")}>
          <h3 className="h">{t("service.orders")}</h3>
          <div className="tickets">
            {service.customers.length === 0 && <div className="card pad hint">{t("service.doorOpening")}</div>}
            {service.customers.map((customer) => (
              <OrderTicket
                key={customer.id}
                customer={customer}
                isSelected={customer.id === service.selectedCustomerId}
                showIngredients={state.settings.showHelp}
                onSelect={() => dispatch({ type: "selectCustomer", customerId: customer.id })}
              />
            ))}
          </div>
        </section>
        <WorkBoard state={state} dispatch={dispatch} selectedCustomer={selectedCustomer} />
        <OvenAndPass state={state} dispatch={dispatch} />
      </div>
      <PrepLine state={state} board={service.board} onPickIngredient={(id) => dispatch({ type: "toggleIngredient", ingredientId: id })} />
    </>
  );
}
