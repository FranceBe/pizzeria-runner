// Forno Infinito's page (factory/index.html): its own small app, sharing nothing with the pizzeria but the look.
import ReactDOM from "react-dom/client";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-700.css";
import "@fontsource/figtree/latin-800.css";
import "@fontsource/shrikhand/latin-400.css";
import { Factory } from "./Factory";
import { TEXTS } from "./texts";
import { pageLanguage } from "../sidePages/language";
import "./factory.css";

const texts = TEXTS[pageLanguage()];
document.documentElement.lang = texts.htmlLang;
document.title = `${texts.title} · Forno Lento`;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in factory/index.html");
ReactDOM.createRoot(root).render(<Factory texts={texts} />);

// Offline play and installation on a phone's home screen, built versions only. Its scope is the factory's folder:
// the game's own service worker stays in charge of the game.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // Not available (private browsing): the factory simply stays online-only.
    });
  });
}
