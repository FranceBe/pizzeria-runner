import { useEffect, useMemo, useReducer, useState } from "react";
import { gameReducer } from "./game/reducer.js";
import { loadState } from "./game/state.js";
import { useGameLoop } from "./hooks/useGameLoop.js";
import { createTranslator } from "./i18n/index.js";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import { Header } from "./views/Header.jsx";
import { PrepView } from "./views/PrepView.jsx";
import { ServiceView } from "./views/service/ServiceView.jsx";
import { MarketView } from "./views/MarketView.jsx";
import { MenuView } from "./views/menu/MenuView.jsx";
import { UpgradesView } from "./views/UpgradesView.jsx";
import { SettingsView } from "./views/SettingsView.jsx";
import { DaySummary } from "./views/DaySummary.jsx";
import { MessageTicker } from "./components/MessageTicker.jsx";
import { TabIcon } from "./components/TabIcon.jsx";

const TABS = ["service", "market", "menu", "upgrades", "settings"];

function TabContent({ tab, state, dispatch, goToTab }) {
  switch (tab) {
    case "service":
      return state.phase === "service" && state.service
        ? <ServiceView state={state} dispatch={dispatch} />
        : <PrepView state={state} dispatch={dispatch} goToTab={goToTab} />;
    case "market":
      return <MarketView state={state} dispatch={dispatch} />;
    case "menu":
      return <MenuView state={state} dispatch={dispatch} />;
    case "upgrades":
      return <UpgradesView state={state} dispatch={dispatch} />;
    case "settings":
      return <SettingsView state={state} dispatch={dispatch} />;
    default:
      return null;
  }
}

export function App() {
  const [state, dispatch] = useReducer(gameReducer, null, loadState);
  const [tab, setTab] = useState("service");
  useGameLoop(state, dispatch);

  const { language } = state.settings;
  const t = useMemo(() => createTranslator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // During service, the service screen fits the window instead of scrolling (see .svc-mode in styles.css).
  const isServing = tab === "service" && state.phase === "service";
  useEffect(() => {
    document.documentElement.classList.toggle("svc-mode", isServing);
  }, [isServing]);

  const waitingCustomers = state.service ? state.service.customers.length : 0;
  const startNextDay = () => {
    dispatch({ type: "startNextDay" });
    setTab("service");
  };

  return (
    <I18nProvider value={t}>
      <Header state={state} dispatch={dispatch} />
      <div className="wrap">
        <nav className="tabs" role="tablist">
          {TABS.map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} aria-label={t(`tabs.${id}`)} onClick={() => setTab(id)}>
              <TabIcon tab={id} />
              <span className="tab-l">{t(`tabs.${id}`)}</span>
              {id === "service" && tab !== "service" && waitingCustomers > 0 && <span className="pip">{waitingCustomers}</span>}
            </button>
          ))}
        </nav>
      </div>
      <main className="wrap">
        {/* The service screen has its own ticker inside its grid. */}
        {!isServing && <MessageTicker toasts={state.toasts} dispatch={dispatch} />}
        <TabContent tab={tab} state={state} dispatch={dispatch} goToTab={setTab} />
      </main>
      {state.phase === "summary" && state.summary && <DaySummary summary={state.summary} onNextDay={startNextDay} />}
    </I18nProvider>
  );
}
