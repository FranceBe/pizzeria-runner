import { Component, type ReactNode } from "react";
import { setBrokenSaveAside } from "../game/state";
import { createTranslator, detectLanguage } from "../i18n";

interface State {
  hasCrashed: boolean;
}

// If the game ever fails to render (say, a damaged save loaded from a code), this screen replaces it
// instead of a blank page, with a way to start over. Without it, the autosave would keep the game stuck.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { hasCrashed: false };

  static getDerivedStateFromError(): State {
    return { hasCrashed: true };
  }

  override render() {
    if (!this.state.hasCrashed) return this.props.children;
    const t = createTranslator(detectLanguage());
    const startOver = () => {
      setBrokenSaveAside();
      window.location.reload();
    };
    return (
      <div className="crash">
        <div className="card pad crash-card" role="alert">
          <h1 className="h">{t("crash.title")}</h1>
          <p>{t("crash.text")}</p>
          <div className="row">
            <button className="btn" onClick={() => window.location.reload()}>{t("crash.reload")}</button>
            <button className="btn primary" onClick={startOver}>{t("crash.reset")}</button>
          </div>
          <p className="hint">{t("crash.resetHint")}</p>
        </div>
      </div>
    );
  }
}
