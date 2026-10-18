import { useState } from "react";
import { toSaveData } from "../game/state";
import { LANGUAGES, LANGUAGE_NAMES, type Language } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";
import type { Dispatch, SoundChannel, Theme } from "../game/types";
import { encodeSaveCode, decodeSaveCode } from "../utils/saveCode";
import type { ScreenProps } from "./types";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

const THEMES: readonly Theme[] = ["auto", "light", "dark"];

type StatusMessage = "settings.copied" | "settings.selected" | "settings.invalidCode";

function LanguagePicker({ language, dispatch }: { language: Language; dispatch: Dispatch }) {
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

// Offers to install the game as an app where the browser supports it; otherwise explains how.
function InstallButton() {
  const t = useTranslation();
  const { canInstall, isInstalled, install } = useInstallPrompt();
  if (isInstalled) return null;
  return (
    <div className="install">
      {canInstall && <button className="btn sm" onClick={install}>{t("settings.install")}</button>}
      <p className="hint" style={{ margin: 0 }}>{t("settings.installHint")}</p>
    </div>
  );
}

// One sound channel: a mute button and a volume slider (moving the slider also unmutes).
function VolumeControl({ channel, volume, isMuted, dispatch }: { channel: SoundChannel; volume: number; isMuted: boolean; dispatch: Dispatch }) {
  const t = useTranslation();
  const name = t(`settings.${channel}`);
  const isSilent = isMuted || volume === 0;
  return (
    <div className="volume-row">
      <button
        className="btn sm volume-mute"
        aria-pressed={isSilent}
        aria-label={isSilent ? t("settings.unmute", { channel: name }) : t("settings.mute", { channel: name })}
        onClick={() => (isMuted || volume > 0 ? dispatch({ type: "toggleMute", channel }) : dispatch({ type: "setVolume", channel, volume: 0.5 }))}
      >
        {isSilent ? "🔇" : "🔊"}
      </button>
      <label className="volume-label" htmlFor={`volume-${channel}`}>{name}</label>
      <input
        id={`volume-${channel}`}
        className="volume-slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round((isMuted ? 0 : volume) * 100)}
        aria-label={t("settings.volume", { channel: name })}
        onChange={(event) => dispatch({ type: "setVolume", channel, volume: Number(event.target.value) / 100 })}
      />
    </div>
  );
}

function SoundSettings({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  const { musicVolume, musicMuted, effectsVolume, effectsMuted } = state.settings;
  return (
    <div className="sound-settings">
      <span className="binlabel" style={{ margin: 0 }}>{t("settings.sound")}</span>
      <VolumeControl channel="music" volume={musicVolume} isMuted={musicMuted} dispatch={dispatch} />
      <VolumeControl channel="effects" volume={effectsVolume} isMuted={effectsMuted} dispatch={dispatch} />
      <p className="hint" style={{ margin: 0 }}>{t("settings.soundHint")}</p>
    </div>
  );
}

function PizzeriaSettings({ state, dispatch }: ScreenProps) {
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
      <div className="row">
        <span className="binlabel" style={{ margin: 0 }}>{t("settings.theme")}</span>
        {THEMES.map((theme) => (
          <button
            key={theme}
            className={`btn sm${theme === state.settings.theme ? " primary" : ""}`}
            aria-pressed={theme === state.settings.theme}
            onClick={() => dispatch({ type: "setTheme", theme })}
          >
            {t(`settings.themes.${theme}`)}
          </button>
        ))}
      </div>
      <SoundSettings state={state} dispatch={dispatch} />
      <label className="switch">
        <input id="large-text" type="checkbox" checked={state.settings.largeText} onChange={() => dispatch({ type: "toggleLargeText" })} />
        {t("settings.largeText")}
      </label>
      <InstallButton />
    </div>
  );
}

function SaveTransfer({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  const [exportCode, setExportCode] = useState("");
  const [importCode, setImportCode] = useState("");
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [isConfirmingReset, setConfirmingReset] = useState(false);

  const generateCode = () => {
    setExportCode(encodeSaveCode(toSaveData(state)));
    setMessage(null);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exportCode);
      setMessage("settings.copied");
    } catch {
      const box = document.getElementById("export-box");
      if (box instanceof HTMLTextAreaElement) box.select();
      setMessage("settings.selected");
    }
  };

  const loadCode = () => {
    try {
      dispatch({ type: "importSave", saveData: decodeSaveCode(importCode) });
      setImportCode("");
      setMessage(null);
    } catch {
      setMessage("settings.invalidCode");
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
      {message && <div className="hint" role="status">{t(message)}</div>}
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

export function SettingsView({ state, dispatch }: ScreenProps) {
  return (
    <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
      <PizzeriaSettings state={state} dispatch={dispatch} />
      <SaveTransfer state={state} dispatch={dispatch} />
    </div>
  );
}
