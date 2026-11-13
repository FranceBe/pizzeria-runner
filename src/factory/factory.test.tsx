import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { MESSAGE_KEYS, newFactory, UPGRADE_IDS, type FactoryState } from "./engine";
import { newCoach } from "./coach";
import { Factory, formatters, loadFactory, STORAGE_KEY, TAB_OF, TAB_SECTIONS, TABS } from "./Factory";
import { TEXTS } from "./texts";
import { PlantDiagram } from "./PlantDiagram";
import { noBuildings, noStocks } from "./plant";
import { Ending, Galaxy } from "./Universe";
import { PLANET_IDS, STAGES } from "./cosmos";

afterEach(() => vi.unstubAllGlobals());

// A storage in memory, as the browser's, for the tests that load a saved factory.
const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
};

describe("Forno Infinito's page", () => {
  it("has every text in every language: each upgrade, each message", () => {
    const keys = Object.keys(TEXTS.fr).sort();
    Object.values(TEXTS).forEach((texts) => {
      expect(Object.keys(texts).sort()).toEqual(keys);
      expect(Object.keys(texts.upgrade).sort()).toEqual([...UPGRADE_IDS].sort());
      expect(Object.keys(texts.message).sort()).toEqual([...MESSAGE_KEYS].sort());
    });
  });

  it("renders in every language", () => {
    Object.values(TEXTS).forEach((texts) => {
      const html = renderToString(<Factory texts={texts} />).replaceAll("&#x27;", "'");
      expect(html).toContain(texts.makePizza);
      const journal = renderToString(<Factory texts={texts} initialTab="journal" />).replaceAll("&#x27;", "'");
      expect(journal).toContain(texts.message.welcome);
    });
  });

  it("reads back a save with when it was made, and nothing broken", () => {
    const state = newFactory();
    const coach = { step: 2, plantStep: 0, spaceStep: 0, seen: [], chapterSeen: 0, off: false };
    expect(loadFactory(JSON.stringify({ state, savedAt: 1000, coach }))).toEqual({ state, savedAt: 1000, coach });
    // A save from before the tour: the tour starts from the beginning (and skips what is already done).
    expect(loadFactory(JSON.stringify({ state, savedAt: 1000 }))?.coach).toEqual(newCoach());
    expect(loadFactory(JSON.stringify({ state, savedAt: "yesterday" }))).toBeNull();
    expect(loadFactory("{oops")).toBeNull();
    expect(loadFactory(null)).toBeNull();
  });

  it("writes numbers the reader's way, from cents to astronomical", () => {
    const fr = formatters("fr-FR");
    expect(fr.money(12.5)).toMatch(/12,50\s€/);
    expect(fr.count(1234)).toMatch(/1\s234/);
    expect(fr.count(2_500_000)).toMatch(/2,5\sM/);
    expect(fr.count(3e18)).toBe("3.00e18");
    expect(formatters("en-GB").money(1_500_000)).toMatch(/^€1\.5m$/i);
    expect(fr.time(3 * 3600 + 5 * 60)).toBe("3 h 05");
    expect(fr.time(20)).toBe("1 min");
  });

  it("puts every part in exactly one tab, the tab the tour opens to point at it", () => {
    const parts = Object.keys(TAB_OF).filter((part) => part !== "stats").sort();
    expect(TABS.flatMap((tab) => TAB_SECTIONS[tab]).sort()).toEqual(parts);
    TABS.forEach((tab) => TAB_SECTIONS[tab].forEach((part) => expect(TAB_OF[part]).toBe(tab)));
  });

  it("shows the chain and the automations from the start, locked, so nothing moves when they open", () => {
    const kitchen = renderToString(<Factory texts={TEXTS.fr} initialTab="kitchen" />).replaceAll("&#x27;", "'");
    expect(kitchen).toContain(TEXTS.fr.chainLocked);
    const upgrades = renderToString(<Factory texts={TEXTS.fr} initialTab="upgrades" />).replaceAll("&#x27;", "'");
    expect(upgrades).toContain(TEXTS.fr.upgrade.supplier.name);
    expect(upgrades).toContain("🔒");
  });

  it("keeps the help behind a \"?\"", () => {
    const html = renderToString(<Factory texts={TEXTS.fr} />).replaceAll("&#x27;", "'");
    expect(html).toContain(`aria-label="${TEXTS.fr.whatFor}"`);
    expect(html).not.toContain(TEXTS.fr.help.sales);
  });

  it("keeps the same shape whatever happens: the circuit's line, the price line, the three hiring buttons", () => {
    const shape = (html: string) => ({
      status: html.split('class="fi-flow-status').length - 1,
      suggest: html.split('class="fi-suggest').length - 1,
      buttons: html.split('class="fi-hire"')[1]?.split("</div>")[0].split("<button").length - 1,
      reserved: html.split("fi-hint reserved").length - 1,
    });
    vi.stubGlobal("localStorage", memoryStorage());
    const page = (state: FactoryState, tab: "counter" | "kitchen") => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, savedAt: Date.now(), coach: { step: 99, seen: [], off: true } }));
      const html = renderToString(<Factory texts={TEXTS.fr} initialTab={tab} />).replaceAll("&#x27;", "'");
      localStorage.removeItem(STORAGE_KEY);
      return html;
    };
    const calm = newFactory();
    const stuck = { ...newFactory(), cooks: 5, kits: 0, pizzas: 5000, money: 0 };
    expect(shape(page(stuck, "counter")).status).toBe(shape(page(calm, "counter")).status);
    expect(shape(page(stuck, "counter")).suggest).toBe(1);
    expect(shape(page(calm, "counter")).suggest).toBe(1);
    expect(shape(page(calm, "kitchen"))).toMatchObject({ buttons: 3, reserved: 1 });
    expect(shape(page(stuck, "kitchen"))).toMatchObject({ buttons: 3, reserved: 1 });
    expect(page(stuck, "counter")).toContain(TEXTS.fr.blockKits);
  });

  it("draws the plant as a diagram or as chains, every building in both, each with a button to sell one back", () => {
    const plant = { buildings: { ...noBuildings(), wheatFarm: 2, mill: 1 }, stocks: { ...noStocks(), wheat: 500 }, factoryRates: noBuildings(), stockTrends: noStocks(), researched: [] };
    const props = { state: plant, texts: TEXTS.fr, money: 1e9, formatCount: String, formatMoney: String, needed: null, highlight: ["mill" as const], onBuild: () => {}, onSell: () => {}, isNarrow: false, incident: null };
    const wide = renderToString(<PlantDiagram {...props} view="graph" />);
    const narrow = renderToString(<PlantDiagram {...props} view="chains" />).replaceAll("&#x27;", "'").replaceAll("<!-- -->", "");
    for (const html of [wide, narrow]) {
      expect(html.split("data-building=").length - 1).toBe(16);
      expect(html.split("fi-btn small sell").length - 1).toBe(16);
    }
    expect(wide).toContain("fi-arrow");
    expect(narrow).toContain(TEXTS.fr.chains.dough);
    expect(narrow).toContain(`${TEXTS.fr.goods.wheat} · 500`);
    expect(narrow).toContain(`→ ${TEXTS.fr.buildings.mill.name}`);
    // A strike at the mill: its card says so.
    const strike = renderToString(<PlantDiagram {...props} view="graph" incident={{ kind: "strike", building: "mill", left: 60 }} />);
    expect(strike).toContain(TEXTS.fr.incidents.strike.status);
    expect(strike).toMatch(/data-building="mill" class="fi-node-card [a-z]+ hit/);
  });

  it("draws the galaxy as a map or as lists, every planet and Earth in both, and the ending with its figures", () => {
    const state: FactoryState = { ...newFactory(), era: 4, money: 1e10 };
    const props = { state, texts: TEXTS.fr, f: formatters("fr-FR"), act: () => {}, isNarrow: false, highlight: ["earth" as const] };
    for (const view of ["graph", "chains"] as const) {
      const html = renderToString(<Galaxy {...props} view={view} />).replaceAll("<!-- -->", "");
      expect(html.split("data-node=").length - 1).toBe(PLANET_IDS.length + 1);
      expect(html).toContain(TEXTS.fr.planets.helia.name);
      expect(html).toContain(TEXTS.fr.planetStatus.unknown);
    }
    const ended = { ...state, totalSold: 1e9, cosmos: { ...state.cosmos, stage: STAGES.length, endedAt: 3 * 3600 } };
    const ending = renderToString(<Ending state={ended} texts={TEXTS.fr} f={formatters("fr-FR")} isConfirmingNewGame={false} onKeepPlaying={() => {}} onNewGame={() => {}} />).replaceAll("&#x27;", "'");
    expect(ending).toContain(TEXTS.fr.ending.title);
    expect(ending).toContain("3 h 00");
    expect(ending).toContain(TEXTS.fr.ending.keepPlaying);
  });
});
