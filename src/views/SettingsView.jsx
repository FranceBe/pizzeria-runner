import { useState } from "react";
import { toSaveData } from "../game/state.js";
import { encodeSaveCode, decodeSaveCode } from "../utils/saveCode.js";

function PizzeriaSettings({ state, dispatch }) {
  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="h">Ta pizzeria</h2>
      <label className="binlabel" htmlFor="pizzeria-name">Nom sur l'enseigne</label>
      <input
        id="pizzeria-name"
        type="text"
        value={state.name}
        onChange={(event) => dispatch({ type: "renamePizzeria", name: event.target.value })}
      />
      <label className="switch">
        <input id="help" type="checkbox" checked={state.settings.showHelp} onChange={() => dispatch({ type: "toggleHelp" })} />
        Afficher les ingrédients sur les tickets et vérifier la pizza en cours
      </label>
      <p className="hint" style={{ margin: 0 }}>Sans cette aide, il faut connaître ses recettes par cœur.</p>
    </div>
  );
}

function SaveTransfer({ state, dispatch }) {
  const [exportCode, setExportCode] = useState("");
  const [importCode, setImportCode] = useState("");
  const [message, setMessage] = useState("");
  const [isConfirmingReset, setConfirmingReset] = useState(false);

  const generateCode = () => {
    setExportCode(encodeSaveCode(toSaveData(state)));
    setMessage("");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exportCode);
      setMessage("Copié.");
    } catch {
      document.getElementById("export-box")?.select();
      setMessage("Sélectionné : copie-le avec Ctrl+C ou Cmd+C.");
    }
  };

  const loadCode = () => {
    try {
      dispatch({ type: "importSave", saveData: decodeSaveCode(importCode) });
      setImportCode("");
      setMessage("");
    } catch {
      setMessage("Ce code ne ressemble pas à une sauvegarde Forno Lento. Recopie-le en entier.");
    }
  };

  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 className="h">Sauvegarde</h2>
      <p className="hint" style={{ margin: 0 }}>
        La partie se sauvegarde toute seule dans ce navigateur. Pour passer du PC au téléphone, exporte le code ici et colle-le de l'autre côté.
      </p>
      <div className="row">
        <button className="btn sm" onClick={generateCode}>Générer le code</button>
        {exportCode && <button className="btn sm" onClick={copyCode}>Copier</button>}
      </div>
      {exportCode && <textarea id="export-box" readOnly value={exportCode} onFocus={(event) => event.target.select()} />}
      <label className="binlabel" htmlFor="import-box">Charger un code</label>
      <textarea
        id="import-box"
        value={importCode}
        onChange={(event) => setImportCode(event.target.value)}
        placeholder="Colle ici le code exporté depuis l'autre appareil"
      />
      <div className="row">
        <button className="btn sm" disabled={!importCode.trim()} onClick={loadCode}>Charger cette partie</button>
      </div>
      {message && <div className="hint" role="status">{message}</div>}
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", width: "100%" }} />
      {isConfirmingReset ? (
        <div className="row">
          <span className="clash">Tout effacer et recommencer au jour 1 ?</span>
          <button
            className="btn sm primary"
            onClick={() => {
              dispatch({ type: "resetGame" });
              setConfirmingReset(false);
            }}
          >
            Oui, recommencer
          </button>
          <button className="btn sm ghost" onClick={() => setConfirmingReset(false)}>Annuler</button>
        </div>
      ) : (
        <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmingReset(true)}>
          Recommencer une partie…
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
