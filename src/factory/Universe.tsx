// Era 4's page parts: the galaxy (as a star map, or as lists), the stellar oven, and the ending. The map reads like the
// plant's diagram: the terroirs on the left send their ingredients to Earth in the middle, Earth sends cosmic pizzas to
// the civilisations on the right; the farther column holds the farther planets. Each route is an arrow, green when it
// flows, orange when something is short, dotted when goods wait.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { SpaceNode } from "./coach";
import {
  addShips, buildOven, COSMIC_GOODS, explore, exploreCost, EXPLORE_SECONDS, isReachable, levelCost, nextToExplore, openPlanet, ovenCapacity, ovenCost,
  ovenStatus, PLANET_IDS, planetStatus, PLANETS, production, raiseFarms, removeShip, routeCapacity, routeTarget, shipCost, shipRefund, shipsNeeded,
  STAGES, storeCap, type CosmicGood, type PlanetId, type PlanetStatus,
} from "./cosmos";
import { buildStellarStage, type FactoryState } from "./engine";
import { useFitZoom } from "./fitZoom";
import type { PlantView } from "./PlantDiagram";
import type { FactoryTexts } from "./texts";

export const COSMIC_ICONS: Record<CosmicGood, string> = { starWheat: "🌾", redTomato: "🍅", moonCheese: "🧀", cosmicPizza: "🍕" };
export const PLANET_ICONS: Record<PlanetId, string> = {
  helia: "☀️", rubra: "🔴", selena: "🌙", farro: "🌾", pomodor: "🌋", grana: "🧀",
  orbitans: "🛰️", tellures: "⛏️", nebulins: "☁️", cometaires: "☄️", quasari: "✨", aurorains: "🌌",
};

/** Each planet's place: the near column (rows 0, 2, 4) or the far one (rows 1, 3, 5), on its side of Earth. */
const PLACES: Record<PlanetId, { col: 0 | 1 | 3 | 4; row: number }> = {
  helia: { col: 1, row: 0 }, rubra: { col: 1, row: 2 }, selena: { col: 1, row: 4 },
  farro: { col: 0, row: 1 }, pomodor: { col: 0, row: 3 }, grana: { col: 0, row: 5 },
  orbitans: { col: 3, row: 0 }, tellures: { col: 3, row: 2 }, nebulins: { col: 3, row: 4 },
  cometaires: { col: 4, row: 1 }, quasari: { col: 4, row: 3 }, aurorains: { col: 4, row: 5 },
};

const CARD_WIDTH = 170;
const CARD_HEIGHT = 150;
const ROW_STEP = 100;
const COLUMN_X = { 0: 0, 1: 185, 3: 705, 4: 890 } as const;
const EARTH_X = 435;
const EARTH_WIDTH = 190;
export const MAP_WIDTH = COLUMN_X[4] + CARD_WIDTH;
const MAP_HEIGHT = 5 * ROW_STEP + CARD_HEIGHT;

const placeOf = (id: PlanetId) => ({ x: COLUMN_X[PLACES[id].col], y: PLACES[id].row * ROW_STEP });

/** A route's arrow: level with its planet, from the planet to Earth (a terroir), or from Earth to it (a civilisation). */
const routeOf = (id: PlanetId): { from: number; to: number; y: number } => {
  const { x, y } = placeOf(id);
  const middle = y + CARD_HEIGHT / 2;
  return PLANETS[id].kind === "terroir" ? { from: x + CARD_WIDTH, to: EARTH_X, y: middle } : { from: EARTH_X + EARTH_WIDTH, to: x, y: middle };
};

type RouteLook = "idle" | "flowing" | "short" | "full";

const lookOf = (status: PlanetStatus, flow: number): RouteLook => {
  if (status.kind === "needsShips" || status.kind === "hungry") return "short";
  if (status.kind === "storeFull") return "full";
  return flow > 0.01 ? "flowing" : "idle";
};

export interface Formats {
  count: (n: number) => string;
  rate: (n: number) => string;
  money: (n: number) => string;
}

interface GalaxyProps {
  state: FactoryState;
  texts: FactoryTexts;
  f: Formats;
  act: (action: (s: FactoryState) => FactoryState | null) => void;
  view: PlantView;
  isNarrow: boolean;
  /** What the space tour points at. */
  highlight: readonly SpaceNode[];
}

const clock = (seconds: number) => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export const Galaxy = ({ state, texts, f, act, view, isNarrow, highlight }: GalaxyProps) => {
  const scroller = useRef<HTMLDivElement>(null);
  const zoom = useFitZoom(scroller, MAP_WIDTH, MAP_HEIGHT, view === "graph", isNarrow);
  const { cosmos } = state;
  const statuses = Object.fromEntries(PLANET_IDS.map((id) => [id, planetStatus(state, id)])) as Record<PlanetId, PlanetStatus>;

  // What the tour points at comes into view.
  const highlightKey = highlight.join(",");
  useEffect(() => {
    const first = highlight[0];
    if (!first) return;
    scroller.current?.querySelector(`[data-node="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    // Each new set of nodes, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKey, view]);

  const statusText = (id: PlanetId): string => {
    const status = statuses[id];
    switch (status.kind) {
      case "unknown":
      case "unreachable":
      case "closed":
      case "storeFull":
        return texts.planetStatus[status.kind];
      case "needsShips":
        return texts.needsShips;
      case "hungry":
        return texts.hungry(`${Math.round(status.share * 100)} %`);
      case "running":
        return PLANETS[id].kind === "terroir" ? texts.planetStatus.terroirRunning : texts.planetStatus.civRunning;
    }
  };

  // A planet's card: who or what it is, what it grows or wants, its ships, how it is doing, and what can be done.
  const planetBody = (id: PlanetId): ReactNode => {
    const spec = PLANETS[id];
    const planet = cosmos.planets[id];
    const status = statuses[id];
    const words = texts.planets[id];
    if (status.kind === "unknown") {
      return (
        <>
          <div className="fi-node-head"><span aria-hidden="true">❔</span><strong>{texts.planetStatus.unknown}</strong></div>
          <span className="fi-node-recipe">{texts.lightYears(f.rate(spec.distance))}</span>
        </>
      );
    }
    // Cargo ships: as many as the route lacks, or one more.
    const shipCount = planet.open ? Math.max(1, shipsNeeded(state, id)) : 0;
    const capacity = routeCapacity(state, id);
    const target = routeTarget(state, id);
    const carries = capacity < target * 0.98 ? `${f.rate(capacity)} / ${f.rate(target)}` : f.rate(target);
    return (
      <>
        <div className="fi-node-head">
          <span aria-hidden="true">{PLANET_ICONS[id]}</span>
          <strong>{words.name}</strong>
          <span className="fi-node-count">{planet.open ? (spec.kind === "terroir" ? texts.farms(planet.level) : "") : texts.lightYears(f.rate(spec.distance))}</span>
        </div>
        <span className="fi-node-recipe">
          {spec.kind === "terroir"
            ? `${COSMIC_ICONS[spec.good]} ${texts.grows(f.rate(planet.open ? production(state, id) : spec.yield), texts.cosmicGoods[spec.good])}`
            : `🍕 ${texts.wants(f.rate(spec.demand), f.money(spec.price))}`}
        </span>
        {planet.open ? (
          <span className="fi-planet-ships">{texts.ships(planet.ships, f.count(planet.ships), carries)}</span>
        ) : (
          <span className="fi-planet-text">{words.text}</span>
        )}
        <span className="fi-node-status">{statusText(id)}</span>
        {planet.open ? (
          <div className="fi-node-actions wrap">
            <button className="fi-btn small sell" onClick={() => act((s) => removeShip(s, id))} disabled={planet.ships <= 1}
              title={texts.removeShip(f.money(shipRefund(id)))} aria-label={texts.removeShip(f.money(shipRefund(id)))}>−🚀</button>
            <button className="fi-btn small" onClick={() => act((s) => addShips(s, id, shipCount))} disabled={state.money < shipCost(id)}
              title={texts.fillShips(f.count(shipCount), f.money(shipCount * shipCost(id)))}>
              🚀 +{f.count(shipCount)} · {f.money(shipCount * shipCost(id))}
            </button>
            {spec.kind === "terroir" && (
              <button className="fi-btn small" onClick={() => act((s) => raiseFarms(s, id))} disabled={state.money < levelCost(state, id)}>
                {texts.raiseFarms(f.money(levelCost(state, id)))}
              </button>
            )}
          </div>
        ) : status.kind === "closed" && (
          <div className="fi-node-actions">
            <button className="fi-btn small primary" onClick={() => act((s) => openPlanet(s, id))} disabled={state.money < spec.openCost}>
              {(spec.kind === "terroir" ? texts.colonize : texts.contact)(f.money(spec.openCost))}
            </button>
          </div>
        )}
      </>
    );
  };

  const oven = ovenStatus(state);
  const next = nextToExplore(state);
  const earthBody = (
    <>
      <div className="fi-node-head"><span aria-hidden="true">🌍</span><strong>{texts.earth}</strong></div>
      <ul className="fi-earth-stores">
        {COSMIC_GOODS.map((good) => {
          const trend = cosmos.trends[good];
          return (
            <li key={good}>
              <span>{COSMIC_ICONS[good]} {texts.cosmicGoods[good]}</span>
              <strong>{f.count(cosmos.stocks[good])}{Math.abs(trend) < 0.05 ? "" : trend > 0 ? " ↑" : " ↓"}</strong>
              <div className="fi-node-bar"><i style={{ width: `${Math.min(1, cosmos.stocks[good] / storeCap(state, good)) * 100}%` }} /></div>
            </li>
          );
        })}
      </ul>
      <span className="fi-planet-ships">{texts.ovens(f.count(cosmos.ovens), f.rate(Math.min(cosmos.ovenRate, ovenCapacity(state))))}</span>
      <span className={`fi-node-status ${oven.kind === "running" ? "ok" : "warn"}`}>
        {oven.kind === "short" ? texts.ovenShort(texts.cosmicGoods[oven.good]) : texts.ovenStatus[oven.kind]}
      </span>
      <button className="fi-btn small" onClick={() => act(buildOven)} disabled={state.money < ovenCost(state)}>{texts.buildOven(f.money(ovenCost(state)))}</button>
      <div className="fi-earth-explore">
        {cosmos.exploring ? (
          <span className="fi-node-status">{texts.exploring(texts.planets[cosmos.exploring.planet].name, clock(cosmos.exploring.left))}</span>
        ) : !next ? (
          <span className="fi-node-status">{texts.exploredAll}</span>
        ) : !isReachable(state, next) ? (
          <span className="fi-node-status">{texts.exploreNeedsHyperdrive}</span>
        ) : (
          <button className="fi-btn small" onClick={() => act(explore)} disabled={state.money < exploreCost(next)}>{texts.explore(f.money(exploreCost(next)))}</button>
        )}
        {cosmos.exploring && <div className="fi-node-bar"><i style={{ width: `${(1 - cosmos.exploring.left / EXPLORE_SECONDS) * 100}%` }} /></div>}
      </div>
      <span className="fi-planet-text">{texts.cosmicSold(f.count(cosmos.sold))}</span>
    </>
  );

  const cardClass = (id: PlanetId) => {
    const status = statuses[id].kind;
    const look = status === "unknown" ? "unknown" : status === "running" ? "running" : status === "closed" || status === "unreachable" ? "none" : "starved";
    return `${look}${highlight.includes(id) ? " coach-target" : ""}`;
  };

  if (view === "chains") {
    const listOf = (kind: "terroir" | "civ") => PLANET_IDS.filter((id) => PLANETS[id].kind === kind)
      .sort((a, b) => PLANETS[a].distance - PLANETS[b].distance);
    return (
      <div className="fi-chains" ref={scroller}>
        <section className="fi-chain">
          <div data-node="earth" className={`fi-chain-card fi-earth${highlight.includes("earth") ? " coach-target" : ""}`}>{earthBody}</div>
        </section>
        {(["terroir", "civ"] as const).map((kind) => (
          <section key={kind} className="fi-chain">
            <h3 className="fi-group-title">{kind === "terroir" ? texts.terroirs : texts.civilisations}</h3>
            <div className="fi-chain-cards">
              {listOf(kind).map((id) => (
                <div key={id} data-node={id} className={`fi-chain-card fi-planet ${cardClass(id)}`}>{planetBody(id)}</div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="fi-diagram-scroll" ref={scroller}>
      <div className="fi-diagram fi-galaxy" style={{ width: MAP_WIDTH, height: MAP_HEIGHT, zoom }}>
        <svg className="fi-arrows" width={MAP_WIDTH} height={MAP_HEIGHT} aria-hidden="true">
          <defs>
            {(["idle", "flowing", "short", "full"] as const).map((look) => (
              <marker key={look} id={`route-${look}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className={`fi-head ${look}`} />
              </marker>
            ))}
          </defs>
          {PLANET_IDS.filter((id) => cosmos.known.includes(id)).map((id) => {
            const { from, to, y } = routeOf(id);
            const look = cosmos.planets[id].open ? lookOf(statuses[id], cosmos.flows[id]) : "idle";
            return (
              <path key={id} d={`M${from},${y} L${to},${y}`} className={`fi-arrow ${look}${cosmos.planets[id].open ? "" : " planned"}`}
                markerEnd={cosmos.planets[id].open ? `url(#route-${look})` : undefined} />
            );
          })}
        </svg>

        {PLANET_IDS.filter((id) => cosmos.planets[id].open).map((id) => {
          const { from, to, y } = routeOf(id);
          const spec = PLANETS[id];
          const icon = spec.kind === "terroir" ? COSMIC_ICONS[spec.good] : COSMIC_ICONS.cosmicPizza;
          return (
            <span key={`${id}-label`} className={`fi-arrow-label ${lookOf(statuses[id], cosmos.flows[id])}`} style={{ left: (from + to) / 2, top: y } as CSSProperties}>
              <span className="fi-arrow-good">{icon}</span>
              <span className="fi-arrow-amount">{f.rate(cosmos.flows[id])}/s</span>
            </span>
          );
        })}

        <div data-node="earth" className={`fi-node-card fi-earth${highlight.includes("earth") ? " coach-target" : ""}`}
          style={{ left: EARTH_X, top: 0, width: EARTH_WIDTH, height: MAP_HEIGHT }}>
          {earthBody}
        </div>

        {PLANET_IDS.map((id) => {
          const { x, y } = placeOf(id);
          return (
            <div key={id} data-node={id} className={`fi-node-card fi-planet ${cardClass(id)}`} style={{ left: x, top: y, width: CARD_WIDTH, height: CARD_HEIGHT }}>
              {planetBody(id)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface StellarOvenProps {
  state: FactoryState;
  texts: FactoryTexts;
  f: Formats;
  act: (action: (s: FactoryState) => FactoryState | null) => void;
  onShowEnding: () => void;
}

/** The stellar oven, stage by stage: built, buildable, or waiting for more pizzas delivered. */
export const StellarOven = ({ state, texts, f, act, onShowEnding }: StellarOvenProps) => {
  const { cosmos } = state;
  return (
    <>
      <p className="fi-research-points">🍕 {texts.cosmicSold(f.count(cosmos.sold))}</p>
      <ol className="fi-list fi-stages">
        {STAGES.map((stage, i) => {
          const isDone = cosmos.stage > i;
          const isNext = cosmos.stage === i;
          const isWaiting = isNext && cosmos.sold < stage.sold;
          return (
            <li key={i} className={`fi-upgrade${isDone ? " done" : isNext ? "" : " locked"}`}>
              <div className="grow">
                <strong>{i + 1}. {texts.stages[i].name}</strong>
                <span>{isWaiting || !isNext && !isDone ? texts.stageNeeds(f.count(stage.sold)) : texts.stages[i].text}</span>
              </div>
              {isDone ? (
                <span className="fi-done">{texts.stageDone}</span>
              ) : (
                <button className="fi-btn primary" onClick={() => act(buildStellarStage)} disabled={!isNext || isWaiting || state.money < stage.cost}>
                  {texts.stageBuild(f.money(stage.cost))}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {cosmos.endedAt !== null && <button className="fi-btn wide" onClick={onShowEnding}>✨ {texts.ending.again}</button>}
    </>
  );
};

interface EndingProps {
  state: FactoryState;
  texts: FactoryTexts;
  f: Formats & { time: (seconds: number) => string };
  isConfirmingNewGame: boolean;
  onKeepPlaying: () => void;
  onNewGame: () => void;
}

/** The end of the game: the pizza of the universe, and what it took. */
export const Ending = ({ state, texts, f, isConfirmingNewGame, onKeepPlaying, onNewGame }: EndingProps) => {
  const words = texts.ending;
  const facts: [string, string][] = [
    [words.time, f.time(state.cosmos.endedAt ?? state.seconds)],
    [words.sold, f.count(state.totalSold)],
    [words.earned, f.money(state.totalEarned)],
    [words.restaurants, f.count(state.restaurants)],
    [words.factories, f.count(state.buildings.pizzaFactory)],
    [words.planets, f.count(PLANET_IDS.filter((id) => state.cosmos.planets[id].open).length)],
    [words.cosmic, f.count(state.cosmos.sold)],
  ];
  return (
    <div className="fi-ending-backdrop">
      <section className="fi-ending" role="dialog" aria-modal="true" aria-labelledby="fi-ending-title">
        <div className="fi-ending-sun" aria-hidden="true">🍕</div>
        <h2 id="fi-ending-title" className="fi-ending-title">{words.title}</h2>
        <p className="fi-ending-text">{words.text}</p>
        <dl className="fi-ending-facts">
          {facts.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <div className="fi-ending-actions">
          <button className="fi-btn primary" onClick={onKeepPlaying} autoFocus>{words.keepPlaying}</button>
          <button className="fi-btn ghost" onClick={onNewGame}>{isConfirmingNewGame ? words.confirmNewGame : words.newGame}</button>
        </div>
      </section>
    </div>
  );
};
