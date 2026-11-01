// The solitaire page (solitaire/index.html): its own small app, sharing nothing with the pizzeria but the look.
import ReactDOM from "react-dom/client";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-800.css";
import "@fontsource/shrikhand/latin-400.css";
import { Solitaire } from "./Solitaire";
import { pickLanguage, TEXTS } from "./texts";
import "./solitaire.css";

const readGameSave = (): string | null => {
  try {
    return localStorage.getItem("forno-lento-save-v1");
  } catch {
    return null;
  }
};

const texts = TEXTS[pickLanguage(readGameSave(), navigator.language)];
document.documentElement.lang = texts.htmlLang;
document.title = `${texts.title} · Forno Lento`;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in solitaire/index.html");
ReactDOM.createRoot(root).render(<Solitaire texts={texts} />);

// Offline play and installation on a phone's home screen (solitaire/public/sw.js), built versions only. Its scope is
// the solitaire's folder: the game's own service worker stays in charge of the game.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // Not available (private browsing): the solitaire simply stays online-only.
    });
  });
}
