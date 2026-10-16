import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { makeState, play, stateInService, makeCustomer } from "../test/helpers.js";
import { App } from "../App.jsx";
import { Header } from "./Header.jsx";
import { PrepView } from "./PrepView.jsx";
import { ServiceView } from "./service/ServiceView.jsx";
import { MarketView } from "./MarketView.jsx";
import { MenuView } from "./menu/MenuView.jsx";
import { RecipeEditor } from "./menu/RecipeEditor.jsx";
import { UpgradesView } from "./UpgradesView.jsx";
import { SettingsView } from "./SettingsView.jsx";
import { DaySummary } from "./DaySummary.jsx";

// Smoke tests: every screen renders without crashing and shows its key text.
const noop = () => {};
const render = (element) => renderToString(element);

// A late-game state with every supplier, so every drawing shape gets rendered.
function lateGameState() {
  let state = makeState({ money: 5000, xp: 5000 });
  for (const id of ["origan", "jambon", "champi", "olive", "creme", "oignon", "poivron", "salami", "piment", "chevre",
    "gorgo", "parmesan", "miel", "anchois", "capres", "artichaut", "oeuf", "lardons", "patate", "reblochon",
    "roquette", "jcru", "burrata", "truffe"]) {
    state = play(state, { type: "signSupplier", ingredientId: id });
  }
  return state;
}

describe("views", () => {
  it("renders the whole app from a fresh game", () => {
    expect(render(<App />)).toContain("Ouvrir la pizzeria");
  });

  it("renders the header", () => {
    expect(render(<Header state={makeState({ debt: 3 })} />)).toContain("Ardoise");
  });

  it("renders the prep view, with Nonna when broke", () => {
    const broke = makeState({ money: 0, stock: {} });
    const html = render(<PrepView state={broke} dispatch={noop} goToTab={noop} />);
    expect(html).toContain("Appeler Nonna");
  });

  it("renders a service in progress", () => {
    const customer = makeCustomer({ extraIngredient: "basilic", waitedSeconds: 100 });
    let state = stateInService([customer, makeCustomer({ id: "cust-2" })]);
    state = play(state, { type: "toggleIngredient", ingredientId: "pate" }, { type: "bake" }, { type: "tick", seconds: 10 });
    state = play(state, { type: "toggleIngredient", ingredientId: "pate" }, { type: "toggleIngredient", ingredientId: "tomate" });
    const html = render(<ServiceView state={state} dispatch={noop} />);
    expect(html).toContain("Commandes");
    expect(html).toContain("Personne ne l&#x27;attend");
    expect(html).toContain("manquants");
  });

  it("renders every screen in a late game", () => {
    const state = lateGameState();
    expect(render(<MarketView state={state} dispatch={noop} />)).toContain("Le frigo");
    expect(render(<MenuView state={state} dispatch={noop} />)).toContain("Tartufo");
    expect(render(<RecipeEditor state={state} dispatch={noop} onClose={noop} />)).toContain("Truffe noire");
    expect(render(<UpgradesView state={state} dispatch={noop} />)).toContain("Améliorer");
    expect(render(<SettingsView state={state} dispatch={noop} />)).toContain("Sauvegarde");

    const inService = stateInService([makeCustomer()], { ...state });
    expect(render(<ServiceView state={inService} dispatch={noop} />)).toContain("Truffe noire");
  });

  it("renders the day summary", () => {
    const summary = {
      day: 2, served: 4, revenue: 28, tips: 1.5, purchases: 3, charges: 6, waste: 1, xp: 40,
      levelUps: [2], debt: 2, net: 20.5, bestSeller: ["Margherita", 4],
    };
    const html = render(<DaySummary summary={summary} onNextDay={noop} />);
    expect(html).toContain("Niveau <!-- -->2<!-- --> atteint");
    expect(html).toContain("Préparer le jour");
  });
});
