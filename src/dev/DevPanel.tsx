// Dev only (shown with `npm run dev`, left out of the built game): sets up a game at any point of progress.
// Its labels are not translated: players never see it.
import { useState } from "react";
import { UPGRADES, UPGRADE_KEYS } from "../data/progression";
import { MAX_LEVEL } from "../game/progression";
import { toSaveData } from "../game/state";
import { useTranslation } from "../i18n/I18nContext";
import { encodeSaveCode, type JsonObject } from "../utils/saveCode";
import type { ScreenProps } from "../views/types";
import { SoundLab } from "./SoundLab";
import { buildDevGame, DEFAULT_DEV_SETUP, maxUpgrades, noUpgrades, type DevSetup } from "./devSave";

const NumberField = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max?: number; onChange: (value: number) => void }) => (
  <label className="dev-field">
    <span>{label}</span>
    <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />
  </label>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="dev-toggle">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    {label}
  </label>
);

export const DevPanel = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const [setup, setSetup] = useState<DevSetup>(DEFAULT_DEV_SETUP);
  const [code, setCode] = useState("");
  const update = (changes: Partial<DevSetup>) => setSetup((current) => ({ ...current, ...changes }));
  const saveData = () => JSON.parse(JSON.stringify(toSaveData(buildDevGame(setup, state)))) as JsonObject;

  return (
    <div className="card pad dev-panel">
      <h2 className="h">🛠 Dev : partie de test</h2>
      <p className="hint">Visible seulement en local (npm run dev). Remplace la partie en cours.</p>
      <div className="dev-grid">
        <NumberField label={`Niveau (1–${MAX_LEVEL})`} value={setup.level} min={1} max={MAX_LEVEL} onChange={(level) => update({ level })} />
        <NumberField label="Caisse (€)" value={setup.money} min={0} onChange={(money) => update({ money })} />
        <NumberField label="Jour" value={setup.day} min={1} onChange={(day) => update({ day })} />
        <NumberField label="Stock par ingrédient" value={setup.stock} min={0} onChange={(stock) => update({ stock })} />
      </div>
      <Toggle label="Tous les fournisseurs signés" checked={setup.allIngredients} onChange={(allIngredients) => update({ allIngredients })} />
      <Toggle label="Secret de Nonna" checked={setup.nonnaSecret} onChange={(nonnaSecret) => update({ nonnaSecret })} />
      <Toggle label="Secret de Mamma" checked={setup.mammaSecret} onChange={(mammaSecret) => update({ mammaSecret })} />
      <Toggle label="Habitués avec des histoires (l'album : une ce soir, une en cours, une finie)" checked={setup.stories} onChange={(stories) => update({ stories })} />
      <Toggle label="La Gazette (3 numéros, le dernier sorti ce matin)" checked={setup.gazettes} onChange={(gazettes) => update({ gazettes })} />
      <div className="row">
        <strong className="grow">Améliorations</strong>
        <button className="btn sm" onClick={() => update({ upgrades: noUpgrades() })}>Aucune</button>
        <button className="btn sm" onClick={() => update({ upgrades: maxUpgrades() })}>Toutes au max</button>
      </div>
      <div className="dev-grid">
        {UPGRADE_KEYS.map((key) => (
          <NumberField
            key={key}
            label={`${t.upgradeName(key)} (0–${UPGRADES[key].costs.length})`}
            value={setup.upgrades[key]}
            min={0}
            max={UPGRADES[key].costs.length}
            onChange={(level) => update({ upgrades: { ...setup.upgrades, [key]: level } })}
          />
        ))}
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => dispatch({ type: "importSave", saveData: saveData() })}>Jouer cette partie de test</button>
        {/* To play it on a phone: paste the code in the deployed game, Settings > Load a code. */}
        <button className="btn" onClick={() => setCode(encodeSaveCode(saveData()))}>Générer le code</button>
      </div>
      {code && <textarea className="dev-code" readOnly value={code} rows={3} onFocus={(event) => event.target.select()} />}
      <SoundLab />
    </div>
  );
};
