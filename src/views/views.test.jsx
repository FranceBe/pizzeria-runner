import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { makeState, play, stateInService, makeCustomer } from "../test/helpers.js";
import { App } from "../App.jsx";
import { createTranslator, LANGUAGES } from "../i18n/index.js";
import { I18nProvider } from "../i18n/I18nContext.jsx";
import { Header } from "./Header.jsx";
import { PrepView } from "./PrepView.jsx";
import { ServiceView } from "./service/ServiceView.jsx";
import { MarketView } from "./MarketView.jsx";
import { MenuView } from "./menu/MenuView.jsx";
import { RecipeEditor } from "./menu/RecipeEditor.jsx";
import { UpgradesView } from "./UpgradesView.jsx";
import { SettingsView } from "./SettingsView.jsx";
import { DaySummary } from "./DaySummary.jsx";

// Smoke tests: every screen renders in every language, without crashing or showing a raw translation key.
const noop = () => {};
const render = (element, language = "fr") =>
  renderToString(<I18nProvider value={createTranslator(language)}>{element}</I18nProvider>);

// A translation key that slipped through looks like "service.orders" in the HTML.
const RAW_KEY = /\b(tabs|common|header|prep|service|market|menu|editor|upgrades|settings|summary|toasts|kinds|stations|ingredients|recipes|customerLines)\.\w/;

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

function serviceInProgress() {
  const customer = makeCustomer({ extraIngredient: "basilic", waitedSeconds: 100 });
  let state = stateInService([customer, makeCustomer({ id: "cust-2" })]);
  state = play(state, { type: "toggleIngredient", ingredientId: "pate" }, { type: "bake" }, { type: "tick", seconds: 10 });
  return play(state, { type: "toggleIngredient", ingredientId: "pate" }, { type: "toggleIngredient", ingredientId: "tomate" });
}

const SUMMARY = {
  day: 2, served: 4, revenue: 28, tips: 1.5, purchases: 3, charges: 6, waste: 1, xp: 40,
  levelUps: [2], debt: 2, net: 20.5, bestSeller: { recipeId: "margherita", name: null, count: 4 },
  orders: [
    { customerName: "Luca", recipeId: "margherita", recipeName: null, ingredients: ["pate", "tomate", "mozza", "basilic"], price: 7, tip: 0.5 },
    { customerName: "Sofia", recipeId: "c-x", recipeName: "La Fellows", ingredients: ["pate", "mozza"], price: 6, tip: 0 },
  ],
};

describe.each(LANGUAGES)("views in %s", (language) => {
  const screens = () => {
    const late = lateGameState();
    return [
      <Header state={makeState({ debt: 3, pops: [{ id: "p", amount: 7, kind: "money" }, { id: "q", amount: 0.5, kind: "tip" }] })} dispatch={noop} />,
      <PrepView state={makeState({ money: 0, stock: {} })} dispatch={noop} goToTab={noop} />,
      <ServiceView state={serviceInProgress()} dispatch={noop} />,
      <ServiceView state={stateInService([makeCustomer()], { ...late })} dispatch={noop} />,
      <MarketView state={late} dispatch={noop} />,
      <MarketView state={makeState()} dispatch={noop} />,
      <MenuView state={late} dispatch={noop} />,
      <MenuView state={makeState()} dispatch={noop} />,
      <RecipeEditor state={late} dispatch={noop} onClose={noop} />,
      <UpgradesView state={late} dispatch={noop} />,
      <SettingsView state={late} dispatch={noop} />,
      <DaySummary summary={SUMMARY} onNextDay={noop} />,
    ];
  };

  it("renders every screen without raw translation keys", () => {
    for (const screen of screens()) {
      const html = render(screen, language);
      expect(html.match(RAW_KEY)?.[0], `${screen.type.name}`).toBeUndefined();
    }
  });
});

describe("views", () => {
  it("renders the whole app from a fresh game in the browser's language", () => {
    // Node reports an English locale.
    expect(renderToString(<App />)).toContain("Open the pizzeria");
  });

  it("offers Nonna's help when broke", () => {
    const html = render(<PrepView state={makeState({ money: 0, stock: {} })} dispatch={noop} goToTab={noop} />);
    expect(html).toContain("Appeler Nonna");
  });

  it("shows the board check, an unclaimed pizza and the progress line during service", () => {
    const html = render(<ServiceView state={serviceInProgress()} dispatch={noop} />, "en");
    expect(html).toContain("0 served · 2 still to serve");
    expect(html).toContain("Nobody&#x27;s waiting for it");
    expect(html).toContain("2 missing");
    expect(html).toContain("+ Basil");
  });

  it("translates classic recipe names, even in old saves", () => {
    const state = lateGameState();
    expect(render(<MenuView state={state} dispatch={noop} />, "en")).toContain("Goat cheese &amp; honey");
    expect(render(<MenuView state={state} dispatch={noop} />, "fr")).toContain("Chèvre-miel");
  });

  it("renders the day summary with the best seller and every order", () => {
    const html = render(<DaySummary summary={SUMMARY} onNextDay={noop} />, "en");
    expect(html).toContain("Luca · Margherita");
    expect(html).toContain("Sofia · La Fellows");
    expect(html).toContain("+€0.50");
    expect(html).toContain("no tip");
    expect(html).toContain("Prepare day");
  });

  it("shows money pops under the till", () => {
    const state = makeState({ pops: [{ id: "p", amount: 7, kind: "money" }, { id: "q", amount: 0.5, kind: "tip" }] });
    const html = render(<Header state={state} dispatch={noop} />);
    expect(html).toContain("+7,00 €");
    expect(html).toContain("+0,50 € pourboire");
  });

  it("marks what the selected order still needs, on its ticket and on the prep line", () => {
    const state = play(stateInService([makeCustomer()]), { type: "toggleIngredient", ingredientId: "pate" }, { type: "toggleIngredient", ingredientId: "tomate" });
    const html = render(<ServiceView state={state} dispatch={noop} />);
    expect(html).toContain('class="chip ok"');
    expect(html).toContain('class="chip miss"');
    expect(html).toMatch(/class="pan need[^"]*"[^>]*title="Mozzarella/);
  });

  it("highlights the current language", () => {
    const html = render(<SettingsView state={makeState()} dispatch={noop} />);
    expect(html).toMatch(/class="btn sm primary" aria-pressed="true">Français/);
  });
});
