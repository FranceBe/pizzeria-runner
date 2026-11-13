import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import { botSecond } from "./bot";
import {
  addShips, buildOven, explore, EXPLORE_SECONDS, newCosmos, nextToExplore, openPlanet, ovenCapacity, perShip, planetStatus, PLANET_IDS, PLANETS, production,
  raiseLevel, readCosmos, removeShip, routeCapacity, runCosmos, shipCost, shipsNeeded, STAGES, type PlanetId,
} from "./cosmos";
import { advance, buildStellarStage, newFactory, readFactory, tick, type FactoryState } from "./engine";

const universe = (overrides: Partial<FactoryState> = {}): FactoryState => ({ ...newFactory(), era: 4, money: 1e15, ...overrides });

/** A universe with these planets opened (the terroirs' farms at level 2, enough for the first civilisation), their routes
 * equipped to carry everything, and enough ovens. */
const running = (ids: readonly PlanetId[], ovens = 3): FactoryState => {
  let state = universe();
  for (const id of ids) state = openPlanet(state, id)!;
  for (const id of ids) state = PLANETS[id].kind === "terroir" ? raiseLevel(state, id)! : state;
  for (const id of ids) state = shipsNeeded(state, id) > 0 ? addShips(state, id, shipsNeeded(state, id))! : state;
  for (let i = 0; i < ovens; i++) state = buildOven(state)!;
  return state;
};

const play = (state: FactoryState, seconds: number) => advance(state, seconds, seededRandom(1));

describe("the universe", () => {
  it("opens with the rocket plans: before era 4, nothing can be done there", () => {
    const early = { ...universe(), era: 3 as const };
    expect(openPlanet(early, "helia")).toBeNull();
    expect(buildOven(early)).toBeNull();
    expect(newFactory().cosmos.known).toEqual(PLANET_IDS.filter((id) => PLANETS[id].ring === 1));
  });

  it("brings the terroirs' ingredients home, bakes them, and sells the pizzas to the civilisations", () => {
    const state = running(["helia", "rubra", "selena", "orbitans"]);
    const later = play(state, 120);
    expect(later.cosmos.sold).toBeGreaterThan(100);
    expect(later.cosmos.flows.orbitans).toBeCloseTo(PLANETS.orbitans.kind === "civ" ? PLANETS.orbitans.demand : 0, 1);
    expect(later.money).toBeGreaterThan(state.money);
    expect(later.totalSold - state.totalSold).toBeCloseTo(later.cosmos.sold - state.cosmos.sold, 0);
    expect(later.log.some((entry) => entry.key === "firstCosmicSale")).toBe(true);
  });

  it("needs ships for the distance: a far route carries less per ship, and says so when short", () => {
    expect(perShip(universe(), "selena")).toBeGreaterThan(perShip(universe(), "grana"));
    const thin = openPlanet(universe(), "helia")!;
    const raised = raiseLevel(raiseLevel(raiseLevel(thin, "helia")!, "helia")!, "helia")!;
    expect(production(raised, "helia")).toBeCloseTo(4 * (PLANETS.helia.kind === "terroir" ? PLANETS.helia.yield : 0));
    expect(planetStatus(raised, "helia").kind).toBe("needsShips");
    const equipped = addShips(raised, "helia", shipsNeeded(raised, "helia"))!;
    expect(routeCapacity(equipped, "helia")).toBeGreaterThanOrEqual(production(equipped, "helia"));
    expect(equipped.money).toBeCloseTo(raised.money - shipsNeeded(raised, "helia") * shipCost("helia"));
    // Selling a ship back gives half; a route keeps at least one.
    expect(removeShip(equipped, "helia")!.money).toBeCloseTo(equipped.money + shipCost("helia") / 2);
    expect(removeShip(thin, "helia")).toBeNull();
  });

  it("starves the civilisations when the ovens lack an ingredient, and shares out what there is", () => {
    const noCheese = play(running(["helia", "rubra", "orbitans", "tellures"]), 60);
    expect(noCheese.cosmos.sold).toBe(0);
    expect(planetStatus(noCheese, "orbitans").kind).toBe("hungry");
    const short = play(running(["helia", "rubra", "selena", "orbitans", "tellures"], 1), 120);
    // One oven for two civilisations: each gets the same share of what it asks.
    const share = (id: "orbitans" | "tellures") => short.cosmos.flows[id] / (PLANETS[id].kind === "civ" ? PLANETS[id].demand : 1);
    expect(share("orbitans")).toBeCloseTo(share("tellures"), 2);
    expect(ovenCapacity(short)).toBeLessThan(9);
  });

  it("finds planets by exploring, the farthest only with the hyperdrive", () => {
    const sent = explore(universe())!;
    expect(sent.cosmos.exploring).toEqual({ planet: "farro", left: EXPLORE_SECONDS });
    expect(explore(sent)).toBeNull();
    const found = play(sent, EXPLORE_SECONDS + 1);
    expect(found.cosmos.known).toContain("farro");
    expect(found.log.at(-1)).toMatchObject({ key: "planetFound", planet: "farro" });
    const ring2 = universe({ cosmos: { ...newCosmos(), known: PLANET_IDS.filter((id) => PLANETS[id].ring < 3) } });
    expect(nextToExplore(ring2)).toBe("quasari");
    expect(explore(ring2)).toBeNull();
    expect(explore({ ...ring2, researched: ["cargoHolds", "hyperdrive"] })).not.toBeNull();
  });

  it("builds the stellar oven stage by stage, once enough pizzas are delivered; the last stage ends the game", () => {
    const state = universe({ seconds: 5000 });
    expect(buildStellarStage(state)).toBeNull();
    let built = { ...state, cosmos: { ...state.cosmos, sold: STAGES.at(-1)!.sold } };
    for (let i = 0; i < STAGES.length; i++) built = buildStellarStage(built)!;
    expect(built.cosmos).toMatchObject({ stage: STAGES.length, endedAt: 5000 });
    expect(built.log.at(-1)?.key).toBe("ending");
    expect(buildStellarStage(built)).toBeNull();
    // The game goes on after the end.
    expect(tick(built, 1).seconds).toBe(5001);
  });

  it("loads back with the save, and anything odd goes back to how it starts", () => {
    const state = play(running(["helia", "rubra", "selena", "orbitans"]), 30);
    expect(readFactory(JSON.parse(JSON.stringify(state)))?.cosmos).toEqual(state.cosmos);
    expect(readCosmos("nonsense")).toEqual(newCosmos());
    const odd = readCosmos({ planets: { helia: { open: true, level: -4, ships: "lots" }, aurorains: { open: true } }, stage: 99, known: ["mars"], ovens: -1 });
    expect(odd.planets.helia).toEqual({ open: true, level: 1, ships: 1 });
    expect(odd.known).toContain("aurorains");
    expect(odd).toMatchObject({ stage: STAGES.length, endedAt: 0, ovens: 0 });
    expect(runCosmos(universe({ cosmos: odd }), 1).cosmos.sold).toBe(0);
  });
});

describe("a whole game to the end, played by a robot", () => {
  it("opens the universe after the factories, and lights the stellar oven a few hours later", () => {
    const random = seededRandom(1);
    let state = newFactory();
    let universeAt = 0;
    for (let second = 0; second < 450 * 60 && state.cosmos.endedAt === null; second++) {
      state = botSecond(state, { clicksPerSecond: 4, random });
      expect(state.money).toBeGreaterThanOrEqual(0);
      if (state.era >= 4) universeAt ||= second / 60;
    }
    // The universe after about two and a half hours for the robot, the stellar oven lit about three hours later: some
    // five and a half hours in all (about eight for a player, who neither plays perfectly nor stays all the time).
    expect(universeAt).toBeGreaterThan(120);
    expect(universeAt).toBeLessThan(190);
    const ended = (state.cosmos.endedAt ?? Infinity) / 60;
    expect(ended - universeAt).toBeGreaterThan(120);
    expect(ended - universeAt).toBeLessThan(220);
    expect(PLANET_IDS.every((id) => state.cosmos.planets[id].open)).toBe(true);
  }, 300_000);
});
