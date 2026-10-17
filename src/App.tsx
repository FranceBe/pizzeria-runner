import { useEffect, useMemo, useReducer, useState } from "react";
import { gameReducer } from "./game/reducer";
import { loadState } from "./game/state";
import { useGameLoop } from "./hooks/useGameLoop";
import { useServiceShortcuts } from "./hooks/useServiceShortcuts";
import { createTranslator } from "./i18n";
import { I18nProvider } from "./i18n/I18nContext";
import { Header } from "./views/Header";
import { PrepView } from "./views/PrepView";
import { ServiceView } from "./views/service/ServiceView";
import { MarketView } from "./views/MarketView";
import { MenuView } from "./views/menu/MenuView";
import { UpgradesView } from "./views/UpgradesView";
import { SettingsView } from "./views/SettingsView";
import { DaySummary } from "./views/DaySummary";
import { JournalView } from "./views/JournalView";
import { ChallengeResult } from "./views/ChallengeResult";
import { MessageTicker } from "./components/MessageTicker";
import { TabIcon, type TabId } from "./components/TabIcon";
import type { ScreenProps } from "./views/types";

const TABS: readonly TabId[] = ["service", "market", "menu", "upgrades", "journal", "settings"];

function TabContent({ tab, state, dispatch, goToTab }: ScreenProps & { tab: TabId; goToTab: (tab: TabId) => void }) {
  switch (tab) {
    case "service":
      return state.phase === "service" && state.service
        ? <ServiceView state={state} service={state.service} dispatch={dispatch} />
        : <PrepView state={state} dispatch={dispatch} goToTab={goToTab} />;
    case "market":
      return <MarketView state={state} dispatch={dispatch} />;
    case "menu":
      return <MenuView state={state} dispatch={dispatch} />;
    case "upgrades":
      return <UpgradesView state={state} dispatch={dispatch} />;
    case "journal":
      return <JournalView state={state} />;
    case "settings":
      return <SettingsView state={state} dispatch={dispatch} />;
  }
}

export function App() {
  const [state, dispatch] = useReducer(gameReducer, null, loadState);
  const [tab, setTab] = useState<TabId>("service");
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
  useServiceShortcuts(state, dispatch, isServing && state.phase === "service");

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
        {/* The service screen has its own ticker inside its grid; elsewhere it floats over the page, so nothing jumps. */}
        {!isServing && (
          <div className="toast-float">
            <MessageTicker toasts={state.toasts} dispatch={dispatch} />
          </div>
        )}
        <TabContent tab={tab} state={state} dispatch={dispatch} goToTab={setTab} />
      </main>
      {state.phase === "summary" && state.summary && <DaySummary summary={state.summary} pizzeriaName={state.name} onNextDay={startNextDay} />}
      {state.challengeResult && <ChallengeResult result={state.challengeResult} best={state.bestChallengeScore} dispatch={dispatch} />}
    </I18nProvider>
  );
}
