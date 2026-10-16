import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");
ReactDOM.createRoot(root).render(<App />);

// Offline play and installation (see public/sw.js). Only for built versions: in development it would cache stale files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Not available (private browsing, file://): the game simply stays online-only.
    });
  });
}
