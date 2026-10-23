import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { savedLanguage } from "./game/state";
import { DEFAULT_LANGUAGE, loadLanguage } from "./i18n";
import "./fonts";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");
// The game's texts come first, in its language only (another one, should that fail, so the game still opens).
const start = () =>
  ReactDOM.createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
loadLanguage(savedLanguage())
  .catch(() => loadLanguage(DEFAULT_LANGUAGE))
  .catch(() => undefined)
  .finally(start);

// Offline play and installation (see public/sw.js). Only for built versions: in development it would cache stale files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // A new deployment takes over: reload once to run it (the game saves itself as the page goes), rather than
  // staying on the old version until the phone happens to close the tab. Not on the very first install.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let isReloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || isReloading) return;
    isReloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Not available (private browsing, file://): the game simply stays online-only.
    });
  });
}
