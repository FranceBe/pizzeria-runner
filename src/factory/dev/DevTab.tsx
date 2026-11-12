// Dev only: the 🛠 tab, to load a game at any point (presets, or every figure by hand) and to move time or money on.
// Loaded on demand by Factory.tsx in development builds only: the built game holds none of it. Its words are in French
// only, like the game's own dev panel.
import { useState } from "react";
import { advance, UPGRADE_IDS, UPGRADES, type Era, type FactoryState, type UpgradeId } from "../engine";
import { INCIDENT_KINDS, INCIDENTS, type IncidentKind } from "../incidents";
import { BUILDING_IDS, type BuildingId } from "../plant";
import { RESEARCH_IDS, type ResearchId } from "../research";
import type { FactoryTexts } from "../texts";
import { buildDevFactory, DEV_PRESET_IDS, DEV_PRESETS, devSetupOf, type DevPresetId, type DevSetup } from "./devFactory";

const PRESET_NAMES: Record<DevPresetId, string> = {
  era2Start: "Début époque 2",
  era3Start: "Début époque 3",
  era3Running: "Époque 3 en route",
  era3Late: "Fin époque 3",
  era4Start: "Début époque 4",
  era4Late: "Juste avant la fin",
};

type NumberField = "money" | "totalSold" | "restaurants" | "cooks" | "marketing" | "kits" | "research";

const NUMBER_FIELDS: readonly [NumberField, string][] = [
  ["money", "Argent (€)"],
  ["totalSold", "Pizzas vendues"],
  ["restaurants", "Restaurants"],
  ["cooks", "Brigade"],
  ["marketing", "Niveau de pub"],
  ["kits", "Kits d'ingrédients"],
  ["research", "Points de recherche"],
];

interface DevTabProps {
  state: FactoryState;
  texts: FactoryTexts;
  /** Replaces the game (the tour is switched off, so the bubbles keep out of the way). */
  onLoad: (state: FactoryState) => void;
}

// An incident right now (a strike or a breakdown at the first kind of building built that it can hit).
const startIncident = (state: FactoryState, kind: IncidentKind): FactoryState => {
  const spec = INCIDENTS[kind];
  const building = spec.picksOne ? spec.hits.find((id) => state.buildings[id] > 0) ?? spec.hits[0] : undefined;
  return { ...state, incidentsOn: true, incident: { kind, left: spec.seconds, ...(building ? { building } : {}) } };
};

export const DevTab = ({ state, texts, onLoad }: DevTabProps) => {
  const [setup, setSetup] = useState<DevSetup>(() => devSetupOf(state));
  const set = <K extends keyof DevSetup>(key: K, value: DevSetup[K]) => setSetup((current) => ({ ...current, [key]: value }));
  const setBuilding = (id: BuildingId, value: number) => setSetup((current) => ({ ...current, buildings: { ...current.buildings, [id]: value } }));
  const toggleUpgrade = (id: UpgradeId) =>
    setSetup((current) => ({ ...current, upgrades: current.upgrades.includes(id) ? current.upgrades.filter((x) => x !== id) : [...current.upgrades, id] }));
  const toggleResearch = (id: ResearchId) =>
    setSetup((current) => ({ ...current, researched: current.researched.includes(id) ? current.researched.filter((x) => x !== id) : [...current.researched, id] }));
  const load = (next: DevSetup) => {
    setSetup(next);
    onLoad(buildDevFactory(next));
  };

  return (
    <section className="fi-card fi-dev">
      <div className="fi-card-head">
        <h2 className="fi-card-title">🛠 Dev · tester sans tout rejouer</h2>
      </div>
      <p className="fi-hint">Visible en développement seulement (npm run dev:factory). Charger une partie remplace la partie en cours et coupe le tutoriel.</p>

      <h3 className="fi-dev-title">Parties prêtes</h3>
      <div className="fi-dev-row">
        {DEV_PRESET_IDS.map((id) => (
          <button key={id} className="fi-btn" onClick={() => load(DEV_PRESETS[id])}>{PRESET_NAMES[id]}</button>
        ))}
      </div>

      <h3 className="fi-dev-title">Raccourcis sur la partie en cours</h3>
      <div className="fi-dev-row">
        <button className="fi-btn" onClick={() => onLoad({ ...state, money: state.money + 1e6 })}>+1 M€</button>
        <button className="fi-btn" onClick={() => onLoad({ ...state, money: state.money + 1e8 })}>+100 M€</button>
        <button className="fi-btn" onClick={() => onLoad({ ...state, money: state.money + 1e11 })}>+100 Md€</button>
        <button className="fi-btn" onClick={() => onLoad({ ...state, money: state.money * 10 })}>Argent ×10</button>
        <button className="fi-btn" onClick={() => onLoad(advance(state, 600))}>Avancer 10 min</button>
        <button className="fi-btn" onClick={() => setSetup(devSetupOf(state))}>Reprendre la partie en cours</button>
      </div>

      <h3 className="fi-dev-title">Incidents (époque 3)</h3>
      <div className="fi-dev-row">
        {INCIDENT_KINDS.map((kind) => (
          <button key={kind} className="fi-btn" onClick={() => onLoad(startIncident(state, kind))}>
            {texts.incidents[kind].icon} {texts.incidents[kind].name}
          </button>
        ))}
        <button className="fi-btn" onClick={() => onLoad({ ...state, incident: null, incidentClock: 5 })}>Prochain dans 5 s</button>
      </div>

      <h3 className="fi-dev-title">Tout régler</h3>
      <div className="fi-dev-grid">
        <label className="fi-dev-field">
          <span>Époque</span>
          <select value={setup.era} onChange={(event) => set("era", Number(event.target.value) as Era)}>
            {([1, 2, 3, 4] as const).map((era) => <option key={era} value={era}>{era}</option>)}
          </select>
        </label>
        {NUMBER_FIELDS.map(([key, label]) => (
          <label key={key} className="fi-dev-field">
            <span>{label}</span>
            <input type="number" min={0} value={setup[key]} onChange={(event) => set(key, Number(event.target.value))} />
          </label>
        ))}
      </div>

      <h3 className="fi-dev-title">Bâtiments (époque 3)</h3>
      <div className="fi-dev-grid">
        {BUILDING_IDS.map((id) => (
          <label key={id} className="fi-dev-field">
            <span>{texts.buildings[id].name}</span>
            <input type="number" min={0} value={setup.buildings[id]} onChange={(event) => setBuilding(id, Number(event.target.value))} />
          </label>
        ))}
      </div>

      <h3 className="fi-dev-title">Améliorations</h3>
      <div className="fi-dev-upgrades">
        {UPGRADE_IDS.filter((id) => !UPGRADES[id].comingSoon).map((id) => (
          <label key={id} className="fi-switch">
            <input type="checkbox" checked={setup.upgrades.includes(id)} onChange={() => toggleUpgrade(id)} />
            <span>{texts.upgrade[id].name} <em>(ép. {UPGRADES[id].era})</em></span>
          </label>
        ))}
      </div>

      <h3 className="fi-dev-title">Recherches (époques 3 et 4)</h3>
      <div className="fi-dev-upgrades">
        {RESEARCH_IDS.map((id) => (
          <label key={id} className="fi-switch">
            <input type="checkbox" checked={setup.researched.includes(id)} onChange={() => toggleResearch(id)} />
            <span>{texts.researches[id].name}</span>
          </label>
        ))}
      </div>

      <button className="fi-btn primary wide" onClick={() => load(setup)}>Charger cette partie</button>
    </section>
  );
};
