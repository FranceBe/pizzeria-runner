import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { gameReducer } from "./game/reducer";
import { loadState } from "./game/state";
import { useGameLoop } from "./hooks/useGameLoop";
import { useServiceShortcuts } from "./hooks/useServiceShortcuts";
import { useSecretCode } from "./hooks/useSecretCode";
import { useGameAudio } from "./hooks/useGameAudio";
import { createTranslator } from "./i18n";
import { localDate } from "./game/challenge";
import { I18nProvider, useTranslation } from "./i18n/I18nContext";
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
import { SecretPad } from "./components/SecretPad";
import type { ScreenProps } from "./views/types";
import { shownEvent } from "./game/service";
import { MultiplayerProvider, useMultiplayer } from "./multiplayer/MultiplayerContext";
import { isSharedKitchen } from "./multiplayer/protocol";
import { MultiplayerView } from "./views/MultiplayerView";

const TABS: readonly TabId[] = ["service", "market", "menu", "upgrades", "journal", "multi", "settings"];

// solo: the player's own game, for the tabs that stay personal (settings, multiplayer) during a duo pizzeria.
const TabContent = ({ tab, state, dispatch, goToTab, solo }: ScreenProps & { tab: TabId; goToTab: (tab: TabId) => void; solo: ScreenProps }) => {
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
    case "multi":
      return <MultiplayerView state={solo.state} dispatch={solo.dispatch} goToTab={goToTab} />;
    case "settings":
      return <SettingsView state={solo.state} dispatch={solo.dispatch} />;
  }
};

// How long the "only the host can do that" note stays up, in a duo pizzeria.
const REFUSED_NOTE_MS = 3500;

// Inside the multiplayer connection. During a quick co-op, the service screen, the keyboard and the sounds follow the
// shared kitchen; during a duo pizzeria, so do the header and every tab but the settings and multiplayer ones. The
// player's own pizzeria waits in its morning prep meanwhile.
const GameShell = ({ state: soloState, dispatch: soloDispatch, tab, setTab }: ScreenProps & { tab: TabId; setTab: (tab: TabId) => void }) => {
  const t = useTranslation();
  const { coopView, coopDispatch, duo, refusedAt, room, you, error, clearError, isReconnecting } = useMultiplayer();
  const secretPad = useSecretCode(soloDispatch);
  const isCoop = coopView !== null;
  const isDuo = isCoop && duo !== null;
  const state = isDuo && coopView ? coopView : soloState;
  const dispatch = isDuo ? coopDispatch : soloDispatch;
  const activeState = coopView ?? soloState;
  const activeDispatch = isCoop ? coopDispatch : soloDispatch;
  useGameAudio(activeState, duo ? `duo:${duo.id}` : isCoop ? "coop" : "solo");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (refusedAt === null) return;
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), REFUSED_NOTE_MS);
    return () => clearTimeout(timer);
  }, [refusedAt]);
  const isRefusedNoteShown = refusedAt !== null && now - refusedAt < REFUSED_NOTE_MS;
  const partner = room?.players.find((player) => player.id !== you)?.name ?? "";
  // Someone in the room lost their connection (switched apps): said to the others, whose game goes on meanwhile.
  const awayPlayer = room && room.status !== "finished" ? room.players.find((player) => player.id !== you && player.away && player.connected) : undefined;
  // In a shared kitchen, the other player left for good: the host carries on alone, and knows it.
  const leftPlayer = room?.status === "playing" && isSharedKitchen(room.mode) ? room.players.find((player) => player.id !== you && !player.connected) : undefined;

  // During service, the service screen fits the window instead of scrolling (see .svc-mode in styles.css).
  const isServing = tab === "service" && activeState.phase === "service";
  useEffect(() => {
    document.documentElement.classList.toggle("svc-mode", isServing);
  }, [isServing]);
  useServiceShortcuts(activeState, activeDispatch, isServing);

  const waitingCustomers = state.service ? state.service.customers.length : 0;
  const startNextDay = () => {
    dispatch({ type: "startNextDay" });
    setTab("service");
  };

  return (
    <>
      <Header state={state} dispatch={dispatch} isDuo={isDuo} />
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
        {isDuo && duo && (
          <div className="duo-banner" role="status">
            <span aria-hidden="true">🤝</span>
            <strong>{duo.name}</strong>
            <span className="hint">{t("multi.duoWith", { partner })}</span>
          </div>
        )}
        {/* The host left: said on whatever screen the partner is on, since their game just switched back to their own. */}
        {error === "hostLeft" && tab !== "multi" && (
          <div className="toast-float on-top">
            <button className="ticker warn" onClick={clearError}>
              <span className="ticker-t">{t("multi.errors.hostLeft")}</span>
              <span className="ticker-x" aria-hidden="true">×</span>
            </button>
          </div>
        )}
        {(isReconnecting || awayPlayer || leftPlayer) && (
          <div className="toast-float on-top">
            <div className="ticker warn" role="status">
              {isReconnecting
                ? t("multi.reconnecting")
                : awayPlayer
                  ? t("multi.playerAway", { name: awayPlayer.name })
                  : t("multi.playerLeft", { name: leftPlayer?.name ?? "" })}
            </div>
          </div>
        )}
        {isRefusedNoteShown && (
          <div className="toast-float on-top">
            <div className="ticker warn">{t("multi.hostOnly")}</div>
          </div>
        )}
        {/* The service screen has its own ticker inside its grid; elsewhere it floats over the page, so nothing jumps. */}
        {!isServing && (
          // Over a dialog (the day's receipt, the challenge score), messages go to the top, clear of its buttons.
          <div className={`toast-float${(state.phase === "summary" && state.summary) || state.challengeResult ? " on-top" : ""}`}>
            <MessageTicker toasts={state.toasts} dispatch={dispatch} />
          </div>
        )}
        {tab === "service" && isCoop && !isDuo && activeState.service ? (
          <ServiceView state={activeState} service={activeState.service} dispatch={activeDispatch} />
        ) : (
          <TabContent tab={tab} state={state} dispatch={dispatch} goToTab={setTab} solo={{ state: soloState, dispatch: soloDispatch }} />
        )}
      </main>
      {state.phase === "summary" && state.summary && (
        <DaySummary
          summary={state.summary}
          pizzeriaName={state.name}
          shownEventId={state.summary.event ? shownEvent(state, state.summary.event) : undefined}
          onNextDay={startNextDay}
        />
      )}
      <SecretPad pad={secretPad} />
      {soloState.challengeResult && (
        <ChallengeResult result={soloState.challengeResult} best={soloState.dailyChallenge?.best ?? 0} dispatch={soloDispatch} />
      )}
      {!isDuo && coopView?.challengeResult && <ChallengeResult result={coopView.challengeResult} best={0} dispatch={coopDispatch} />}
    </>
  );
};

export const App = () => {
  const [state, dispatch] = useReducer(gameReducer, null, loadState);
  const [tab, setTab] = useState<TabId>("service");
  useGameLoop(state, dispatch);

  const { language } = state.settings;
  const t = useMemo(() => createTranslator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Calendar festivals follow the real date: checked when the game opens and when a new day starts.
  useEffect(() => {
    dispatch({ type: "syncCalendar", date: localDate() });
  }, [state.day, dispatch]);

  // Theme, text size and the pizzeria's looks are styled from attributes on <html> (see styles.css).
  const { theme, largeText } = state.settings;
  const { awning, sign, wall } = state.cosmetics;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.classList.toggle("large-text", largeText);
    Object.assign(root.dataset, { awning, sign, wall });
  }, [theme, largeText, awning, sign, wall]);

  const showService = useCallback(() => setTab("service"), []);

  return (
    <I18nProvider value={t}>
      <MultiplayerProvider state={state} dispatch={dispatch} onMatchStart={showService}>
        <GameShell state={state} dispatch={dispatch} tab={tab} setTab={setTab} />
      </MultiplayerProvider>
    </I18nProvider>
  );
};
