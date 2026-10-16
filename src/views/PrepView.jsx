import { ingredientName } from "../data/ingredients.js";
import { MARGHERITA } from "../data/recipes.js";
import { dailyCharges, forecastCustomers } from "../game/economy.js";
import { activeMenu, isNewRecipe } from "../game/menu.js";
import { ingredientCost, toppingsList } from "../game/pizza.js";
import { levelForXp, menuCapacity } from "../game/progression.js";
import { formatEuro } from "../utils/format.js";
import { Pizza } from "../components/Pizza.jsx";

const LOW_STOCK_THRESHOLD = 5;

// Nonna offers help when nothing on the menu can be made and a few margheritas are unaffordable.
function needsNonna(state, menu) {
  const canMakeSomething = menu.some((recipe) => recipe.ingredients.every((id) => (state.stock[id] || 0) > 0));
  const isBroke = state.money < ingredientCost(MARGHERITA.ingredients) * 3;
  return !canMakeSomething && isBroke && state.lastNonnaVisitDay !== state.day;
}

export function PrepView({ state, dispatch, goToTab }) {
  const expectedCustomers = forecastCustomers(state);
  const menu = activeMenu(state);
  const level = levelForXp(state.xp);
  const usedIngredients = [...new Set(menu.flatMap((recipe) => recipe.ingredients))];
  const lowStock = usedIngredients.filter((id) => (state.stock[id] || 0) < LOW_STOCK_THRESHOLD);

  return (
    <div className="prep">
      <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h2 className="h">Jour {state.day} · mise en place</h2>
          <p className="sub">Remplis le frigo, ajuste la carte, puis ouvre quand tu es prête. Personne ne part fâché : prends ton temps.</p>
        </div>
        <div className="row" style={{ alignItems: "flex-end", gap: 24 }}>
          <div>
            <div className="forecast">{expectedCustomers}</div>
            <div className="hint">clients attendus</div>
          </div>
          <dl className="kv">
            <dt>Pizzas à la carte</dt>
            <dd>{menu.length} / {menuCapacity(level)}</dd>
            <dt>Charges du soir</dt>
            <dd>{formatEuro(dailyCharges(state))}</dd>
            {state.debt > 0 && (
              <>
                <dt>Ardoise en cours</dt>
                <dd className="neg">{formatEuro(state.debt)}</dd>
              </>
            )}
          </dl>
        </div>
        {lowStock.length > 0 && (
          <div>
            <strong>Stock bas</strong>
            <ul className="warnlist">
              {lowStock.map((id) => (
                <li key={id}>{ingredientName(id)} : {state.stock[id] || 0}</li>
              ))}
            </ul>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => goToTab("market")}>Aller au marché</button>
          </div>
        )}
        {needsNonna(state, menu) && (
          <div className="card pad" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
            <p style={{ margin: "0 0 8px" }}>Le frigo est vide et la caisse aussi. Nonna peut te dépanner une fois aujourd'hui.</p>
            <button className="btn" onClick={() => dispatch({ type: "callNonna" })}>Appeler Nonna</button>
          </div>
        )}
        <div>
          <button className="btn primary big" onClick={() => dispatch({ type: "openRestaurant" })} disabled={!expectedCustomers}>
            Ouvrir la pizzeria
          </button>
        </div>
      </div>

      <div className="card pad">
        <h3 className="h">Ce soir à la carte</h3>
        {menu.length === 0 && <p className="sub">Aucune pizza. Passe par l'onglet Carte.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {menu.map((recipe) => (
            <div key={recipe.id} className="row" style={{ flexWrap: "nowrap" }}>
              <Pizza ingredients={recipe.ingredients} baked size={44} />
              <div className="grow">
                <strong>{recipe.name}</strong> {isNewRecipe(state, recipe) && <span className="tag">nouveau</span>}
                <div className="hint">{toppingsList(recipe.ingredients)}</div>
              </div>
              <strong>{formatEuro(recipe.price)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
