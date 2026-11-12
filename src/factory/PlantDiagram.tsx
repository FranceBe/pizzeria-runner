// Era 3's plant, drawn as a diagram: each building in its place, from the sources on the left to the pizza factory on
// the right (the trucks above it, the laboratory below, a power plant at each end of that column), and an arrow for each good
// going from a building to the next. An arrow shows its good,
// what waits on it and which way that moves, and how it is doing: green, it flows; orange, the next building runs short
// of it; dotted, it overflows. Reading the arrows is how the plant is balanced: nothing says what to build. The same plant
// also reads as chains, one building under the other, each saying what it takes in and sends on.
import { useEffect, useRef, type CSSProperties } from "react";
import { useFitZoom } from "./fitZoom";
import {
  BUILDING_IDS, buildingCost, buildingStatus, sellValue, storeCap, usageOf, type BuildingId, type BuildingStatus, type Good, type PlantState,
} from "./plant";
import { hitBuildings, incidentSpeeds, INCIDENTS, type Incident } from "./incidents";
import type { FactoryTexts } from "./texts";

/** Each building's place: its column (left to right, as goods flow) and row. */
const PLACES: Record<BuildingId, { col: number; row: number }> = {
  wheatFarm: { col: 0, row: 0 },
  waterPump: { col: 0, row: 1 },
  saltWorks: { col: 0, row: 2 },
  greenhouse: { col: 0, row: 3 },
  oliveGrove: { col: 0, row: 4 },
  dairyFarm: { col: 0, row: 5 },
  mill: { col: 1, row: 0 },
  oilPress: { col: 1, row: 4 },
  kneader: { col: 2, row: 1 },
  cannery: { col: 2, row: 3 },
  creamery: { col: 2, row: 5 },
  windTurbine: { col: 3, row: 0 },
  shippingDock: { col: 3, row: 1.3 },
  pizzaFactory: { col: 3, row: 2.7 },
  researchLab: { col: 3, row: 4.1 },
  biogasPlant: { col: 3, row: 5.3 },
};

/** The goods going from a building to the next. `labelAt`: where along the arrow its label sits (halfway, unless that
 * would put it on a building). */
const ARROWS: readonly { from: BuildingId; to: BuildingId; good: Good; labelAt?: number }[] = [
  { from: "wheatFarm", to: "mill", good: "wheat" },
  { from: "mill", to: "kneader", good: "flour" },
  { from: "waterPump", to: "kneader", good: "water" },
  { from: "saltWorks", to: "kneader", good: "salt" },
  { from: "saltWorks", to: "creamery", good: "salt", labelAt: 0.3 },
  { from: "greenhouse", to: "cannery", good: "tomato" },
  { from: "oliveGrove", to: "oilPress", good: "olive" },
  { from: "oilPress", to: "cannery", good: "oil" },
  { from: "dairyFarm", to: "creamery", good: "milk" },
  { from: "kneader", to: "pizzaFactory", good: "dough" },
  { from: "cannery", to: "pizzaFactory", good: "sauce" },
  { from: "creamery", to: "pizzaFactory", good: "cheese" },
  { from: "pizzaFactory", to: "shippingDock", good: "frozen" },
  { from: "pizzaFactory", to: "researchLab", good: "frozen" },
  { from: "creamery", to: "biogasPlant", good: "whey" },
];

export const GOOD_ICONS: Record<Good, string> = {
  wheat: "🌾", water: "💧", tomato: "🍅", olive: "🫒", milk: "🥛", salt: "🧂", flour: "🌫️", dough: "🫓", oil: "🛢️", sauce: "🥫",
  cheese: "🧀", whey: "🫗", frozen: "🍕",
};
export const BUILDING_ICONS: Record<BuildingId, string> = {
  wheatFarm: "🌾", waterPump: "💧", greenhouse: "🍅", oliveGrove: "🫒", dairyFarm: "🐄", saltWorks: "🧂", mill: "⚙️", kneader: "🫓",
  oilPress: "🛢️", cannery: "🥫", creamery: "🧀", pizzaFactory: "🍕", shippingDock: "🚚", researchLab: "🔬", windTurbine: "🌬️", biogasPlant: "♨️",
};

const NODE_WIDTH = 168;
const NODE_HEIGHT = 104;
const COL_STEP = 292;
const ROW_STEP = 108;
const COLUMNS = 4;
export const DIAGRAM_WIDTH = (COLUMNS - 1) * COL_STEP + NODE_WIDTH;
const DIAGRAM_HEIGHT = Math.max(...BUILDING_IDS.map((id) => PLACES[id].row)) * ROW_STEP + NODE_HEIGHT;

const at = (id: BuildingId) => ({ x: PLACES[id].col * COL_STEP, y: PLACES[id].row * ROW_STEP });

type Point = readonly [number, number];

/** An arrow's curve: from the right side of a building to the left side of the next one, or, within a column, from the
 * top or bottom of one to the bottom or top of the other. */
const curveOf = (from: BuildingId, to: BuildingId): readonly [Point, Point, Point, Point] => {
  const a = at(from);
  const b = at(to);
  if (PLACES[from].col === PLACES[to].col) {
    const isDown = b.y > a.y;
    const start: Point = [a.x + NODE_WIDTH / 2, isDown ? a.y + NODE_HEIGHT : a.y];
    const end: Point = [b.x + NODE_WIDTH / 2, isDown ? b.y : b.y + NODE_HEIGHT];
    const bend = isDown ? 30 : -30;
    return [start, [start[0], start[1] + bend], [end[0], end[1] - bend], end];
  }
  const start: Point = [a.x + NODE_WIDTH, a.y + NODE_HEIGHT / 2];
  const end: Point = [b.x, b.y + NODE_HEIGHT / 2];
  return [start, [start[0] + 60, start[1]], [end[0] - 60, end[1]], end];
};

/** A point along a curve (t from 0 to 1). */
const pointOn = ([p0, p1, p2, p3]: readonly [Point, Point, Point, Point], t: number): Point => {
  const u = 1 - t;
  const mix = (i: 0 | 1) => u ** 3 * p0[i] + 3 * u ** 2 * t * p1[i] + 3 * u * t ** 2 * p2[i] + t ** 3 * p3[i];
  return [mix(0), mix(1)];
};

type ArrowLook = "idle" | "flowing" | "short" | "full";

interface PlantDiagramProps {
  state: PlantState;
  texts: FactoryTexts;
  money: number;
  formatCount: (n: number) => string;
  formatMoney: (n: number) => string;
  /** With the calculator researched: how many of each it would take for the factories to run flat out. */
  needed: Record<BuildingId, number> | null;
  /** Buildings the tour points at. */
  highlight: readonly BuildingId[];
  onBuild: (id: BuildingId) => void;
  /** Sells one back, to slow a step down (and free its power). */
  onSell: (id: BuildingId) => void;
  /** The diagram, or the chains. */
  view: PlantView;
  isNarrow: boolean;
  /** The incident of the moment: the buildings it hits are marked, and say so. */
  incident: Incident | null;
}

export type PlantView = "graph" | "chains";

/** The plant as chains, in the order goods flow. */
const CHAINS: readonly { id: "power" | "dough" | "sauce" | "cheese" | "pizza"; buildings: readonly BuildingId[] }[] = [
  { id: "power", buildings: ["windTurbine", "biogasPlant"] },
  { id: "dough", buildings: ["wheatFarm", "mill", "waterPump", "saltWorks", "kneader"] },
  { id: "sauce", buildings: ["greenhouse", "oliveGrove", "oilPress", "cannery"] },
  { id: "cheese", buildings: ["dairyFarm", "creamery"] },
  { id: "pizza", buildings: ["pizzaFactory", "shippingDock", "researchLab"] },
];
export type ChainId = (typeof CHAINS)[number]["id"];

export const PlantDiagram = ({ state, texts, money, formatCount, formatMoney, needed, highlight, onBuild, onSell, view, isNarrow, incident }: PlantDiagramProps) => {
  const scroller = useRef<HTMLDivElement>(null);

  // The diagram fits the screen: its whole height in view, its width in the card.
  const zoom = useFitZoom(scroller, DIAGRAM_WIDTH, DIAGRAM_HEIGHT, view === "graph", isNarrow);
  const speeds = incidentSpeeds(incident);
  const statuses = Object.fromEntries(BUILDING_IDS.map((id) => [id, buildingStatus(state, id, speeds)])) as Record<BuildingId, BuildingStatus>;
  const hit = hitBuildings(incident);
  // A card's classes: how it runs, whether an incident hits it, whether the tour points at it.
  const cardClass = (id: BuildingId) =>
    `${statuses[id].kind}${hit.includes(id) && incident ? (INCIDENTS[incident.kind].isLucky ? " lucky" : " hit") : ""}${highlight.includes(id) ? " coach-target" : ""}`;

  // The building the tour points at comes into view (the diagram may scroll sideways).
  const highlightKey = highlight.join(",");
  useEffect(() => {
    const first = highlight[0];
    if (!first) return;
    const node = scroller.current?.querySelector(`[data-building="${first}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    // Each new set of buildings, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKey, view]);

  const statusText = (id: BuildingId) => {
    if (incident && hit.includes(id) && state.buildings[id] > 0) return `${texts.incidents[incident.kind].icon} ${texts.incidents[incident.kind].status}`;
    const status = statuses[id];
    if (status.kind === "none") return texts.statusNone;
    if (status.kind === "running") return texts.statusRunning;
    if (status.kind === "unpowered") return texts.statusUnpowered;
    return status.kind === "starved" ? texts.statusStarved(texts.goods[status.good]) : texts.statusBlocked(texts.goods[status.good]);
  };

  const lookOf = (from: BuildingId, to: BuildingId, good: Good): ArrowLook => {
    if (state.buildings[from] < 1 || state.buildings[to] < 1) return state.stocks[good] >= 1 ? "full" : "idle";
    if (state.stocks[good] >= storeCap(state, good) * 0.99) return "full";
    const status = statuses[to];
    if (status.kind === "starved" && status.good === good) return "short";
    return usageOf(state, from) > 0 ? "flowing" : "idle";
  };

  // What a building shows in either layout: its name, recipe, speed, state, and buttons to sell one or build one more.
  const nodeBody = (id: BuildingId) => {
    const usage = usageOf(state, id);
    const need = needed && id !== "researchLab" ? Math.ceil(needed[id] - 1e-9) : null;
    const cost = buildingCost(state, id);
    const refund = sellValue(state, id);
    return (
      <>
        <div className="fi-node-head">
          <span aria-hidden="true">{BUILDING_ICONS[id]}</span>
          <strong>{texts.buildings[id].name}</strong>
          <span className="fi-node-count">×{formatCount(state.buildings[id])}</span>
        </div>
        <span className="fi-node-recipe">{texts.buildings[id].text}</span>
        <div className="fi-node-bar"><i style={{ width: `${usage * 100}%` }} /></div>
        <span className="fi-node-status">{need !== null && need > state.buildings[id] ? texts.needed(formatCount(need)) : statusText(id)}</span>
        <div className="fi-node-actions">
          <button className="fi-btn small sell" onClick={() => onSell(id)} disabled={state.buildings[id] < 1}
            title={texts.sell(formatMoney(refund))} aria-label={texts.sell(formatMoney(refund))}>−1</button>
          <button className="fi-btn small" onClick={() => onBuild(id)} disabled={money < cost} title={texts.build(formatMoney(cost))}>
            +1 · {formatMoney(cost)}
          </button>
        </div>
      </>
    );
  };

  // A good on its way, as a small tag: its icon, name and store, coloured as its arrow would be.
  const goodTag = (from: BuildingId, to: BuildingId, good: Good, toward: string | null) => {
    const trend = state.stockTrends[good];
    const arrow = Math.abs(trend) < 1 ? "" : trend > 0 ? " ↑" : " ↓";
    return (
      <span key={`${from}-${to}`} className={`fi-good-tag ${lookOf(from, to, good)}`}>
        {GOOD_ICONS[good]} {texts.goods[good]} · {formatCount(Math.max(0, state.stocks[good]))}{arrow}
        {toward ? ` → ${toward}` : ""}
      </span>
    );
  };

  if (view === "chains") {
    return (
      <div className="fi-chains" ref={scroller}>
        {CHAINS.map((chain) => (
          <section key={chain.id} className="fi-chain">
            <h3 className="fi-group-title">{texts.chains[chain.id]}</h3>
            <div className="fi-chain-cards">
              {chain.buildings.map((id) => {
                const incoming = ARROWS.filter((arrow) => arrow.to === id);
                const outgoing = ARROWS.filter((arrow) => arrow.from === id);
                return (
                  <div key={id} data-building={id} className={`fi-chain-card ${cardClass(id)}`}>
                    {nodeBody(id)}
                    {incoming.length > 0 && (
                      <div className="fi-good-tags">
                        <span className="fi-good-tags-label">{texts.receives}</span>
                        {incoming.map(({ from, good }) => goodTag(from, id, good, null))}
                      </div>
                    )}
                    {outgoing.length > 0 && (
                      <div className="fi-good-tags">
                        <span className="fi-good-tags-label">{texts.sends}</span>
                        {outgoing.map(({ to, good }) => goodTag(id, to, good, texts.buildings[to].name))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="fi-diagram-scroll" ref={scroller}>
      <div className="fi-diagram" style={{ width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT, zoom }}>
        <svg className="fi-arrows" width={DIAGRAM_WIDTH} height={DIAGRAM_HEIGHT} aria-hidden="true">
          <defs>
            {(["idle", "flowing", "short", "full"] as const).map((look) => (
              <marker key={look} id={`head-${look}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className={`fi-head ${look}`} />
              </marker>
            ))}
          </defs>
          {ARROWS.map(({ from, to, good }) => {
            const [p0, p1, p2, p3] = curveOf(from, to);
            const look = lookOf(from, to, good);
            const path = `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
            return <path key={`${from}-${to}`} d={path} className={`fi-arrow ${look}`} markerEnd={`url(#head-${look})`} />;
          })}
        </svg>

        {ARROWS.map(({ from, to, good, labelAt = 0.5 }) => {
          const [x, y] = pointOn(curveOf(from, to), labelAt);
          const trend = state.stockTrends[good];
          const arrow = Math.abs(trend) < 1 ? "" : trend > 0 ? " ↑" : " ↓";
          const look = lookOf(from, to, good);
          return (
            <span key={`${from}-${to}-label`} className={`fi-arrow-label ${look}`} style={{ left: x, top: y } as CSSProperties}>
              <span className="fi-arrow-good">{GOOD_ICONS[good]} {texts.goods[good]}</span>
              <span className="fi-arrow-amount">{formatCount(Math.max(0, state.stocks[good]))}{arrow}</span>
            </span>
          );
        })}

        {BUILDING_IDS.map((id) => {
          const { x, y } = at(id);
          return (
            <div key={id} data-building={id}
              className={`fi-node-card ${cardClass(id)}`}
              style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
              {nodeBody(id)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
