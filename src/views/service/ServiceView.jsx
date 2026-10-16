import { COMMIS_ASSEMBLES_ORDER } from "../../data/progression.js";
import { ovenSlots } from "../../game/service.js";
import { haveSameIngredients } from "../../game/pizza.js";
import { plural } from "../../utils/format.js";
import { Pizza } from "../../components/Pizza.jsx";
import { OrderTicket } from "./OrderTicket.jsx";
import { OvenAndPass } from "./OvenAndPass.jsx";
import { PrepLine } from "./PrepLine.jsx";

// With help on: tells how the pizza being built compares to the selected order.
function BoardCheck({ customer, board }) {
  if (haveSameIngredients(customer.ingredients, board)) return <span className="match good">Prête pour {customer.name}</span>;
  const missingCount = customer.ingredients.filter((id) => !board.includes(id)).length;
  const extraCount = board.filter((id) => !customer.ingredients.includes(id)).length;
  const parts = [];
  if (missingCount) parts.push(`${missingCount} ${plural(missingCount, "manquant")}`);
  if (extraCount) parts.push(`${extraCount} en trop`);
  return <span className="match">Pour {customer.name} : {parts.join(" · ")}</span>;
}

function WorkBoard({ state, dispatch, selectedCustomer }) {
  const { board, oven } = state.service;
  const ovenIsFull = oven.length >= ovenSlots(state);
  return (
    <section aria-label="Plan de travail">
      <div className="peel">
        {board.length ? <Pizza ingredients={board} className="pizza" /> : <div className="empty">Touche « Pâte » pour étaler une nouvelle pizza</div>}
        {selectedCustomer && board.length > 0 && state.settings.showHelp && <BoardCheck customer={selectedCustomer} board={board} />}
        <div className="row" style={{ justifyContent: "center" }}>
          {state.upgrades.commis >= COMMIS_ASSEMBLES_ORDER && selectedCustomer && (
            <button className="btn sm" onClick={() => dispatch({ type: "assembleOrder" })}>
              Commis : monter la {selectedCustomer.recipeName}
            </button>
          )}
          <button className="btn sm" disabled={!board.length} onClick={() => dispatch({ type: "trashBoard" })}>Jeter</button>
          <button className="btn primary" disabled={!board.includes("pate") || ovenIsFull} onClick={() => dispatch({ type: "bake" })}>
            {ovenIsFull ? "Four plein" : "Enfourner"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function ServiceView({ state, dispatch }) {
  const { service } = state;
  const selectedCustomer = service.customers.find((customer) => customer.id === service.selectedCustomerId);
  const { served } = service.stats;
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 className="h" style={{ margin: 0 }}>Service du jour {state.day}</h2>
        <span className="hint">
          {served} {plural(served, "servi")} · {service.customersToCome + service.customers.length} encore à servir
        </span>
      </div>
      <div className="line">
        <section aria-label="Commandes">
          <h3 className="h">Commandes</h3>
          <div className="tickets">
            {service.customers.length === 0 && <div className="card pad hint">La porte va s'ouvrir…</div>}
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
