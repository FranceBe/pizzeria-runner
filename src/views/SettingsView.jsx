import { useState } from "react";
import { toSaveData } from "../game/state.js";
import { LANGUAGES, LANGUAGE_NAMES } from "../i18n/index.js";
import { useTranslation } from "../i18n/I18nContext.jsx";
import { encodeSaveCode, decodeSaveCode } from "../utils/saveCode.js";

function LanguagePicker({ language, dispatch }) {
  const t = useTranslation();
  return (
    <div className="row">
      <span className="binlabel" style={{ margin: 0 }}>{t("settings.language")}</span>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          lang={code}
          className={`btn sm${code === language ? " primary" : ""}`}
          aria-pressed={code === language}
          onClick={() => dispatch({ type: "setLanguage", language: code })}
        >
          {LANGUAGE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}

function PizzeriaSettings({ state, dispatch }) {
  const t = useTranslation();
  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="h">{t("settings.pizzeria")}</h2>
      <label className="binlabel" htmlFor="pizzeria-name">{t("settings.signName")}</label>
      <input
        id="pizzeria-name"
        type="text"
        value={state.name}
        onChange={(event) => dispatch({ type: "renamePizzeria", name: event.target.value })}
      />
      <LanguagePicker language={state.settings.language} dispatch={dispatch} />
      <label className="switch">
        <input id="help" type="checkbox" checked={state.settings.showHelp} onChange={() => dispatch({ type: "toggleHelp" })} />
        {t("settings.showHelp")}
      </label>
      <p className="hint" style={{ margin: 0 }}>{t("settings.helpHint")}</p>
    </div>
  );
}

function SaveTransfer({ state, dispatch }) {
  const t = useTranslation();
  const [exportCode, setExportCode] = useState("");
  const [importCode, setImportCode] = useState("");
  // Translation key of the last status message, or "".
  const [messageKey, setMessageKey] = useState("");
  const [isConfirmingReset, setConfirmingReset] = useState(false);

  const generateCode = () => {
    setExportCode(encodeSaveCode(toSaveData(state)));
    setMessageKey("");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exportCode);
      setMessageKey("settings.copied");
    } catch {
      document.getElementById("export-box")?.select();
      setMessageKey("settings.selected");
    }
  };

  const loadCode = () => {
    try {
      dispatch({ type: "importSave", saveData: decodeSaveCode(importCode) });
      setImportCode("");
      setMessageKey("");
    } catch {
      setMessageKey("settings.invalidCode");
    }
  };

  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 className="h">{t("settings.save")}</h2>
      <p className="hint" style={{ margin: 0 }}>{t("settings.saveIntro")}</p>
      <div className="row">
        <button className="btn sm" onClick={generateCode}>{t("settings.generateCode")}</button>
        {exportCode && <button className="btn sm" onClick={copyCode}>{t("settings.copy")}</button>}
      </div>
      {exportCode && <textarea id="export-box" readOnly value={exportCode} onFocus={(event) => event.target.select()} />}
      <label className="binlabel" htmlFor="import-box">{t("settings.loadCode")}</label>
      <textarea
        id="import-box"
        value={importCode}
        onChange={(event) => setImportCode(event.target.value)}
        placeholder={t("settings.loadPlaceholder")}
      />
      <div className="row">
        <button className="btn sm" disabled={!importCode.trim()} onClick={loadCode}>{t("settings.loadGame")}</button>
      </div>
      {messageKey && <div className="hint" role="status">{t(messageKey)}</div>}
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", width: "100%" }} />
      {isConfirmingReset ? (
        <div className="row">
          <span className="clash">{t("settings.confirmReset")}</span>
          <button
            className="btn sm primary"
            onClick={() => {
              dispatch({ type: "resetGame" });
              setConfirmingReset(false);
            }}
          >
            {t("settings.yesReset")}
          </button>
          <button className="btn sm ghost" onClick={() => setConfirmingReset(false)}>{t("common.cancel")}</button>
        </div>
      ) : (
        <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmingReset(true)}>
          {t("settings.reset")}
        </button>
      )}
    </div>
  );
}

export function SettingsView({ state, dispatch }) {
  return (
    <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
      <PizzeriaSettings state={state} dispatch={dispatch} />
      <SaveTransfer state={state} dispatch={dispatch} />
    </div>
  );
}
