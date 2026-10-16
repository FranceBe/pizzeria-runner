import { recipeNameFor } from "../../game/menu.js";
import { customerForPizza, ovenSlots } from "../../game/service.js";
import { Pizza } from "../../components/Pizza.jsx";

function Oven({ state }) {
  const { oven } = state.service;
  return (
    <div className="oven">
      <h3 className="h">Four</h3>
      <div className="slots">
        {Array.from({ length: ovenSlots(state) }, (_, slotIndex) => {
          const pizza = oven[slotIndex];
          if (!pizza) return <div key={slotIndex} className="slot idle">Libre</div>;
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
  const { service } = state;
  return (
    <div className="passe">
      <h3 className="h" style={{ marginTop: 14 }}>Passe</h3>
      {service.ready.length === 0 && <p className="hint" style={{ margin: 0 }}>Les pizzas cuites arrivent ici.</p>}
      {service.ready.map((pizza) => {
        const customer = customerForPizza(service, pizza.ingredients);
        return (
          <div key={pizza.id} className="ready">
            <Pizza ingredients={pizza.ingredients} baked />
            <div className="grow">
              <div className="rn">{recipeNameFor(state, pizza.ingredients)}</div>
              <div className="hint" style={{ fontSize: 12 }}>{customer ? `Pour ${customer.name}` : "Personne ne l'attend"}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button className="btn sm go" onClick={() => dispatch({ type: "servePizza", pizzaId: pizza.id })} disabled={!customer}>
                Servir
              </button>
              <button className="btn sm ghost" onClick={() => dispatch({ type: "trashReadyPizza", pizzaId: pizza.id })}>
                Jeter
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OvenAndPass({ state, dispatch }) {
  return (
    <section aria-label="Four et passe">
      <Oven state={state} />
      <Pass state={state} dispatch={dispatch} />
    </section>
  );
}
