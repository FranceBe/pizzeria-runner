import { describe, it, expect } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { INGREDIENTS } from "../data/ingredients";
import type { DaySummary as Summary, GameState } from "../game/types";
import { makeState, play, stateInService, makeCustomer, makeBookEntry, serviceOf, toggle, MARGHERITA_INGREDIENTS } from "../test/helpers";
import { App } from "../App";
import { createTranslator, LANGUAGES, type Language } from "../i18n";
import { I18nProvider } from "../i18n/I18nContext";
import { Header } from "./Header";
import { PrepView } from "./PrepView";
import { ServiceView } from "./service/ServiceView";
import { MarketView } from "./MarketView";
import { MenuView } from "./menu/MenuView";
import { RecipeEditor } from "./menu/RecipeEditor";
import { UpgradesView } from "./UpgradesView";
import { SettingsView } from "./SettingsView";
import { DaySummary } from "./DaySummary";
import { JournalView } from "./JournalView";
import { ChallengeResult } from "./ChallengeResult";

// Smoke tests: every screen renders in every language, without crashing or showing a raw translation key.
const noop = () => {};
const render = (element: ReactElement, language: Language = "fr"): string =>
  renderToString(<I18nProvider value={createTranslator(language)}>{element}</I18nProvider>);

// A translation key that slipped through looks like "service.orders" in the HTML.
const RAW_KEY =
  /\b(tabs|common|header|prep|challenge|service|market|menu|editor|upgrades|settings|summary|journal|events|achievements|toasts|tutorial|pops|kinds|stations|ingredients|recipes|customerLines|festivals|medals|weeklyMissions|quests|seasons|diets|drinks|crash)\.\w/;

// A late-game state with every supplier, so every drawing shape gets rendered.
function lateGameState(): GameState {
  const signAll = INGREDIENTS.map(({ id }) => ({ type: "signSupplier", ingredientId: id }) as const);
  return play(makeState({ money: 5000, xp: 5000 }), ...signAll);
}

function withRegulars(state: GameState): GameState {
  state.customerBook = { Giulia: makeBookEntry({ visits: 5, orders: { margherita: 5 } }) };
  return state;
}

const serviceScreen = (state: GameState): ReactElement => (
  <ServiceView state={state} service={serviceOf(state)} dispatch={noop} />
);

// A journal with a few days, a discovered pairing and an achievement.
function playedState(): GameState {
  const state = makeState({ day: 4, event: "critic", settings: { ...makeState().settings, tutorialDone: true } });
  state.history = [
    { day: 1, served: 5, revenue: 35, tips: 2, net: 12, xp: 50, event: null },
    { day: 2, served: 3, revenue: 21, tips: 0, net: -4, xp: 30, event: "rain" },
  ];
  state.lifetime = { ...state.lifetime, served: 8, revenue: 56, tips: 2, bestDay: { day: 1, net: 12 }, byRecipe: { margherita: { name: null, count: 8 } } };
  state.discoveredPairings = ["tomate+basilic"];
  state.achievements = { firstPizza: 1 };
  state.chefSpecial = "margherita";
  state.quest = { kind: "serveRecipe", giver: "football", target: 5, progress: 2, recipeId: "margherita", recipeName: null, deadlineDay: 5, reward: 35, xp: 40 };
  state.customerBook = { Giulia: makeBookEntry({ visits: 5, orders: { margherita: 5 }, dislikes: "basilic", birthday: 4 }) };
  return state;
}

// Every late-game upgrade, with a busy kitchen: two ovens, the bar, tables and birthdays.
function lateKitchen(): GameState {
  const state = stateInService(
    [
      makeCustomer({ id: "t1", name: "Rosa", tableId: "tab", drink: "vin" }),
      makeCustomer({ id: "t2", name: "Enzo", tableId: "tab", diet: "veggie", drink: "limonade", drinkServed: true }),
      makeCustomer({ id: "b1", name: "Giulia", birthday: true }),
    ],
    { ...lateGameState(), upgrades: { oven: 3, salle: 4, deco: 3, commis: 2, terrasse: 2, livraison: 1, bar: 2, oven2: 2, oven3: 1, annexe: 2 } },
  );
  serviceOf(state).tables = { tab: { size: 2, served: 0, allHappy: true, color: 1 } };
  serviceOf(state).oven = [{ id: "o", ovenIndex: 1, ingredients: MARGHERITA_INGREDIENTS, bakedSeconds: 1, bakeDuration: 3 }];
  state.settings.tutorialDone = true;
  return state;
}

// Every kind of ticket at once.
const SPECIAL_CUSTOMERS = [
  makeCustomer({ id: "c1", name: "Mme Sato", critic: true }),
  makeCustomer({ id: "c2", name: "Marco", delivery: true, waitedSeconds: 5 }),
  makeCustomer({ id: "c3", name: "Giulia", asUsual: true, visitNumber: 6 }),
];

function serviceInProgress(): GameState {
  const customer = makeCustomer({ extraIngredient: "basilic", waitedSeconds: 100 });
  let state = stateInService([customer, makeCustomer({ id: "cust-2" })]);
  state.settings.tutorialDone = true;
  state = play(state, ...toggle("pate"), { type: "bake" }, { type: "tick", seconds: 10 });
  return play(state, ...toggle("pate", "tomate"));
}

const SUMMARY: Summary = {
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
      { name: "Header with pops", element: <Header state={makeState({ debt: 3, pops: [{ id: "p", amount: 7, kind: "money" }, { id: "q", amount: 0.5, kind: "tip" }] })} dispatch={noop} /> },
      { name: "Header fully upgraded", element: <Header state={{ ...late, upgrades: { oven: 3, salle: 4, deco: 3, commis: 2, terrasse: 0, livraison: 0, bar: 0, oven2: 0, oven3: 0, annexe: 0 } }} dispatch={noop} /> },
      { name: "Prep with regulars", element: <PrepView state={withRegulars(makeState())} dispatch={noop} goToTab={noop} /> },
      { name: "Prep when broke", element: <PrepView state={makeState({ money: 0, stock: {} })} dispatch={noop} goToTab={noop} /> },
      { name: "Service in progress", element: serviceScreen(serviceInProgress()) },
      { name: "Service late game", element: serviceScreen(stateInService([makeCustomer()], { ...late })) },
      { name: "Market late game", element: <MarketView state={late} dispatch={noop} /> },
      { name: "Market fresh game", element: <MarketView state={makeState()} dispatch={noop} /> },
      { name: "Menu late game", element: <MenuView state={late} dispatch={noop} /> },
      { name: "Menu fresh game", element: <MenuView state={makeState()} dispatch={noop} /> },
      { name: "Recipe editor", element: <RecipeEditor state={late} dispatch={noop} onClose={noop} /> },
      { name: "Upgrades", element: <UpgradesView state={late} dispatch={noop} /> },
      { name: "Settings", element: <SettingsView state={late} dispatch={noop} /> },
      { name: "Day summary", element: <DaySummary summary={SUMMARY} pizzeriaName="Forno Lento" onNextDay={noop} /> },
      { name: "Day summary with event", element: <DaySummary summary={{ ...SUMMARY, event: "festival" }} pizzeriaName="Forno Lento" onNextDay={noop} /> },
      { name: "Journal, fresh", element: <JournalView state={makeState()} /> },
      { name: "Journal, played", element: <JournalView state={playedState()} /> },
      { name: "Prep with event", element: <PrepView state={playedState()} dispatch={noop} goToTab={noop} /> },
      { name: "Market day", element: <MarketView state={makeState({ event: "market" })} dispatch={noop} /> },
      { name: "Menu with special", element: <MenuView state={playedState()} dispatch={noop} /> },
      { name: "Special tickets", element: serviceScreen(withRegulars(stateInService(SPECIAL_CUSTOMERS.map((c) => ({ ...c })), { ...late }))) },
      { name: "Challenge", element: serviceScreen(play(playedState(), { type: "startChallenge", date: "2026-10-17" })) },
      { name: "Late kitchen", element: serviceScreen(lateKitchen()) },
      { name: "Upgrades with looks", element: <UpgradesView state={lateKitchen()} dispatch={noop} /> },
      { name: "Summary with drinks and second address", element: <DaySummary summary={{ ...SUMMARY, drinks: 9, annexeIncome: 70 }} pizzeriaName="Forno Lento" onNextDay={noop} /> },
      { name: "Challenge result", element: <ChallengeResult result={{ date: "2026-10-17", score: 120, served: 6, happy: 4, isNewBest: false }} best={180} dispatch={noop} /> },
    ];
  };

  it("renders every screen without raw translation keys", () => {
    for (const { name, element } of screens()) {
      expect(render(element, language).match(RAW_KEY)?.[0], name).toBeUndefined();
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
    const html = render(serviceScreen(serviceInProgress()), "en");
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
    const html = render(<DaySummary summary={SUMMARY} pizzeriaName="Chez Moi" onNextDay={noop} />, "en");
    expect(html).toContain("Chez Moi");
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
    const html = render(serviceScreen(state));
    expect(html).toContain('class="chip ok"');
    expect(html).toContain('class="chip miss"');
    expect(html).toMatch(/class="pan need[^"]*"[^>]*title="Mozzarella/);
  });

  it("guides the first day and highlights what to touch", () => {
    const prep = render(<PrepView state={makeState()} dispatch={noop} goToTab={noop} />);
    expect(prep).toContain("Premier service");
    expect(prep).toMatch(/class="btn primary big coach-target"/);
    const service = render(serviceScreen(stateInService([makeCustomer()])));
    expect(service).toContain("Touche la Pâte");
    expect(service).toMatch(/class="pan[^"]*coach-target[^"]*"[^>]*title="Pâte/);
  });

  it("lists regulars and tags their tickets", () => {
    expect(render(<PrepView state={withRegulars(makeState({ day: 3 }))} dispatch={noop} goToTab={noop} />)).toContain("Margherita · 5 visites");
    const state = withRegulars(stateInService([makeCustomer({ name: "Giulia", visitNumber: 6 })]));
    const html = render(serviceScreen(state));
    expect(html).toContain('class="visit regular"');
    expect(html).toContain("6ᵉ visite");
  });

  it("numbers the selected ticket's ingredients for the keyboard", () => {
    const html = render(serviceScreen(stateInService([makeCustomer()])));
    expect(html).toContain('<kbd class="kbd">3</kbd>');
    expect(html).toContain("Espace enfourner");
  });

  it("decorates the storefront as upgrades are bought", () => {
    expect(render(<Header state={makeState()} dispatch={noop} />)).not.toContain("storefront");
    const upgraded = render(<Header state={makeState({ upgrades: { oven: 1, salle: 2, deco: 2, commis: 0, terrasse: 0, livraison: 0, bar: 0, oven2: 0, oven3: 0, annexe: 0 } })} dispatch={noop} />);
    expect(upgraded.match(/decor table/g)).toHaveLength(2);
    expect(upgraded).toContain("oven-front");
    expect(upgraded).toContain('class="lights"');
  });

  it("tags critics, deliveries and the usual, without revealing the usual", () => {
    const html = render(serviceScreen(withRegulars(stateInService(SPECIAL_CUSTOMERS.map((c) => ({ ...c })), { settings: { ...makeState().settings, tutorialDone: true } }))), "en");
    expect(html).toContain("ticket critic");
    expect(html).toContain("ticket delivery");
    expect(html).toContain("Express: 40s");
    expect(html).toContain("“The usual!”");
  });

  it("asks the player to remember the usual, with a way out", () => {
    const state = withRegulars(stateInService([makeCustomer({ name: "Giulia", asUsual: true })]));
    const html = render(serviceScreen(state), "en");
    expect(html).toContain("For Giulia: the usual, remember?");
    expect(html).toContain("Remind me…");
    expect(html).not.toContain('class="chips"');
    expect(html).not.toContain("pan need");
  });

  it("shows the challenge clock and bottomless pans", () => {
    // Messages take the ticker's place: clear the achievements that playedState unlocks on the way.
    const state = { ...play(playedState(), { type: "startChallenge", date: "2026-10-17" }), toasts: [] };
    const html = render(serviceScreen(state), "en");
    expect(html).toContain("Daily challenge · 2:00 · 0 points");
    expect(html).toContain(">∞<");
  });

  it("announces the day's event and the chef's special", () => {
    const html = render(<PrepView state={playedState()} dispatch={noop} goToTab={noop} />, "en");
    expect(html).toContain("Food critic");
    expect(html).toContain("★ Chef&#x27;s special");
  });

  it("strikes through regular prices on market day", () => {
    expect(render(<MarketView state={makeState({ event: "market" })} dispatch={noop} />)).toMatch(/<s>[^<]+<\/s>/);
  });

  it("fills the journal", () => {
    const html = render(<JournalView state={playedState()} />, "en");
    expect(html).toContain("Best day: day 1 (+€12.00)");
    expect(html).toContain("Tomato sauce &amp; basil");
    expect(html).toContain("Day 1");
    expect(html.match(/class="bar-neg"/g)).toHaveLength(1);
  });

  it("shows the quest, the season and today's birthdays on the prep screen", () => {
    const html = render(<PrepView state={playedState()} dispatch={noop} goToTab={noop} />, "en");
    expect(html).toContain("The football club wants 5 Margherita for their evening.");
    expect(html).toContain("2 / 5");
    expect(html).toContain("Spring · 4 days left");
    expect(html).toContain("It&#x27;s Giulia&#x27;s birthday today!");
    expect(html).toContain("On today&#x27;s menu:");
  });

  it("shows every oven, the bar, tables, diets and birthdays during service", () => {
    const html = render(serviceScreen(lateKitchen()), "en");
    expect(html).toContain("Oven 3");
    expect(html).toContain("Table of 2");
    expect(html).toContain("Vegetarian");
    expect(html).toContain("Birthday!");
    expect(html).toMatch(/class="drink-btn wanted"[^>]*title="Serve: Red wine"/);
    expect(html).toContain('class="drink-order served"');
  });

  it("lists completed quests in the journal and their reward on the receipt", () => {
    const state = playedState();
    state.lifetime = { ...state.lifetime, questsDone: 1, questRewards: 35 };
    state.questLog = [{ day: 3, kind: "serveRecipe", giver: "football", target: 5, recipeId: "margherita", recipeName: null, reward: 35 }];
    const journal = render(<JournalView state={state} />, "en");
    expect(journal).toContain("1 quest completed · €35.00 earned");
    expect(journal).toContain("The football club wants 5 Margherita for their evening.");
    const receipt = render(<DaySummary summary={{ ...SUMMARY, questRewards: 35 }} pizzeriaName="Forno Lento" onNextDay={noop} />, "en");
    expect(receipt).toContain("Neighbourhood quests");
    expect(receipt).toContain("+ €35.00");
  });

  it("lists the regulars' profiles in the journal", () => {
    const html = render(<JournalView state={playedState()} />, "en");
    expect(html).toContain("Doesn&#x27;t like: basil");
    expect(html).toContain("🎂 Birthday today!");
  });

  it("keeps the secret achievement secret until it is unlocked", () => {
    expect(render(<JournalView state={makeState()} />, "en")).toContain("Some secrets aren&#x27;t earned. They&#x27;re typed.");
    const found = render(<JournalView state={makeState({ achievements: { secretCode: 3 } })} />, "en");
    expect(found).toContain("You know the code.");
  });

  it("shows Nonna's secret on the prep line once shared, and offers regulars their drink", () => {
    const state = stateInService([makeCustomer({ drink: "vin" })], { secretIngredient: true, secretStock: 3, upgrades: { ...makeState().upgrades, bar: 2 } });
    state.customerBook = { Luca: makeBookEntry({ visits: 4 }) };
    const html = render(serviceScreen(state), "en");
    expect(html).toContain("Nonna&#x27;s secret");
    expect(html).toContain("🎁 Offer Luca the red wine");
    expect(render(serviceScreen(stateInService([makeCustomer()])), "en")).not.toContain("Nonna&#x27;s secret");
  });

  it("lets the player make Nonna's secret at the market once it is shared, and explains it", () => {
    expect(render(<MarketView state={makeState()} dispatch={noop} />, "en")).not.toContain("Nonna&#x27;s secret");
    const html = render(<MarketView state={makeState({ secretIngredient: true, secretStock: 2 })} dispatch={noop} />, "en");
    expect(html).toContain("2 in stock");
    expect(html).toContain("Make one · €10.00");
    expect(html).toContain("tip as much as the pizza costs");
  });

  it("frames a table's tickets together, each with its own order", () => {
    const state = stateInService([
      makeCustomer({ id: "a", name: "Rosa", tableId: "t" }),
      makeCustomer({ id: "z", name: "Zoé" }),
      makeCustomer({ id: "b", name: "Enzo", tableId: "t", recipeId: "marinara", ingredients: ["pate", "tomate", "origan"] }),
    ]);
    serviceOf(state).tables = { t: { size: 2, served: 0, allHappy: true, color: 2 } };
    const html = render(serviceScreen(state), "en");
    const frame = html.slice(html.indexOf('class="table-group'), html.indexOf("Zoé"));
    expect(frame).toContain("Table of 2 · one order each");
    expect(frame).toContain("Rosa");
    expect(frame).toContain("Enzo");
  });

  it("offers a way out when stuck, and a pause menu", () => {
    const stuck = stateInService([makeCustomer()], { money: 0.5, stock: { pate: 0, tomate: 5, mozza: 5, basilic: 5 } });
    const html = render(serviceScreen(stuck), "en");
    expect(html).toContain("Nothing left to make the orders with");
    expect(html).toContain("Borrow €30.00 from Nonna");
    expect(html).toContain("Close for today");
    const paused = play(makeState(), { type: "openRestaurant" }, { type: "togglePause" });
    const menu = render(serviceScreen(paused), "en");
    expect(menu).toContain("Resume");
    expect(menu).toContain("Start the day over");
  });

  it("lets pizzas nobody ordered be binned, one by one or all at once", () => {
    const state = stateInService([makeCustomer()]);
    serviceOf(state).ready = [{ id: "r1", ingredients: ["pate"] }, { id: "r2", ingredients: ["pate", "tomate"] }];
    const html = render(serviceScreen(state), "en");
    expect(html).toContain("Bin the 2 pizzas nobody is waiting for");
    expect(html.match(/class="btn sm bin"/g)).toHaveLength(2);
  });

  it("shows tonight's group order as its own ticket, with the medal still within reach", () => {
    const state = stateInService([makeCustomer()], { settings: { ...makeState().settings, tutorialDone: true } });
    state.quest = { kind: "batch", giver: "football", target: 3, progress: 1, deadlineDay: 1, reward: 0, xp: 24,
      items: [{ recipeId: "margherita", recipeName: null, count: 2, delivered: 1 }, { recipeId: "margherita", recipeName: "Bis", count: 1, delivered: 0 }] };
    serviceOf(state).batch = { elapsed: 20 };
    const html = render(serviceScreen(state), "en");
    expect(html).toContain("Group order");
    expect(html).toContain("The football club");
    expect(html).toContain("1 / 2");
    expect(html).toContain("🥇 0:55");
  });

  it("puts the streak or the rush in the message line, and nothing more", () => {
    const state = stateInService([makeCustomer()], { settings: { ...makeState().settings, tutorialDone: true } });
    serviceOf(state).stats.streak = 6;
    expect(render(serviceScreen(state), "en")).toContain("🔥 streak of 6 · tips ×1.25");
    serviceOf(state).rush = { secondsLeft: 30 };
    expect(render(serviceScreen(state), "en")).toContain("Rush hour! Tips ×2 · 0:30");
  });

  it("marks cooling pizzas, a late ingredient and celebrities", () => {
    const state = stateInService([makeCustomer({ celebrity: true, name: "Luna Star" })], { event: "lateDelivery", lateIngredient: "mozza" });
    serviceOf(state).ready = [{ id: "r", ingredients: MARGHERITA_INGREDIENTS, waitingSeconds: 60 }];
    const html = render(serviceScreen(state), "en");
    expect(html).toContain(" · cold");
    expect(html).toContain("🚚 On its way");
    expect(html).toContain("⭐ Celebrity");
  });

  it("shows the day's stars and a passed inspection on the receipt", () => {
    const summary = { ...SUMMARY, stars: 2, starGoals: { happy: true, waste: false, profit: true }, inspectionPassed: true };
    const html = render(<DaySummary summary={summary} pizzeriaName="Forno Lento" onNextDay={noop} />, "en");
    expect(html).toContain("Today&#x27;s stars");
    expect(html).toContain("✓ Everyone served in time");
    expect(html).toContain("Inspection passed: +40 reputation");
  });

  it("shows the week's missions, the festival and tonight's group order in the morning", () => {
    const state = playedState();
    state.festival = "halloween";
    state.weekly = { week: 0, bonusPaid: false, missions: [{ kind: "tips", target: 30, progress: 12.6, done: false }, { kind: "served", target: 40, progress: 40, done: true }] };
    state.quest = { kind: "batch", giver: "bakery", target: 3, progress: 0, deadlineDay: 4, reward: 0, xp: 24, items: [{ recipeId: "margherita", recipeName: null, count: 3, delivered: 0 }] };
    const html = render(<PrepView state={state} dispatch={noop} goToTab={noop} />, "en");
    expect(html).toContain("This week");
    expect(html).toContain("12 / 30");
    expect(html).toContain("It&#x27;s Halloween!");
    expect(html).toContain("To deliver tonight, all together: 3 Margherita.");
  });

  it("keeps star looks locked until enough stars", () => {
    expect(render(<UpgradesView state={makeState()} dispatch={noop} />, "en")).toContain("⭐ 15 stars");
  });

  it("sells looks for the pizzeria", () => {
    const html = render(<UpgradesView state={makeState({ money: 130 })} dispatch={noop} />, "en");
    expect(html).toContain("Make it yours");
    expect(html).toMatch(/Tomato red<\/span><span class="look-a">In place/);
    expect(html).toContain("Buy · €120.00");
  });

  it("highlights the current language", () => {
    const html = render(<SettingsView state={makeState()} dispatch={noop} />);
    expect(html).toMatch(/class="btn sm primary" aria-pressed="true">Français/);
  });
});
