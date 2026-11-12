import { describe, it, expect } from "vitest";
import { seededRandom } from "../utils/random";
import { advance, fixIncident, frozenRate, incidentFixCost, newFactory, readFactory, shippedRate, tick, toggleIncidents, type FactoryState } from "./engine";
import { FAIR_PRICE, FIRST_INCIDENT, INCIDENT_GAP, INCIDENT_KINDS, INCIDENTS, pickIncident, readIncident, type Incident, type IncidentKind } from "./incidents";
import { BUILDING_IDS, BUILDINGS, noBuildings, planFor, WHOLESALE_PRICE, type BuildingId } from "./plant";

const plantState = (buildings: Partial<Record<BuildingId, number>>, overrides: Partial<FactoryState> = {}): FactoryState =>
  ({ ...newFactory(), money: 1e9, era: 3, buildings: { ...noBuildings(), ...buildings }, ...overrides });

// A plant sized by the planner for two pizza factories, run until it is flat out.
const running = (overrides: Partial<FactoryState> = {}): FactoryState => {
  const plan = planFor(plantState({}), 2 * (BUILDINGS.pizzaFactory.makes.frozen ?? 0));
  const state = plantState(Object.fromEntries(BUILDING_IDS.map((id) => [id, Math.ceil(plan[id] - 1e-9)])), { incidentsOn: false });
  return { ...advance(state, 90, seededRandom(1)), incidentsOn: true, ...overrides };
};

/** Seconds of play with someone there (incidents can come). */
const play = (state: FactoryState, seconds: number, random = seededRandom(2)): FactoryState => {
  let next = state;
  for (let i = 0; i < seconds; i++) next = tick(next, 1, random);
  return next;
};

describe("incidents", () => {
  it("come once the plant makes pizzas, after a while, one at a time, said in the journal", () => {
    expect(play(plantState({ wheatFarm: 3, windTurbine: 1 }, { incidentClock: 1 }), 30).incident).toBeNull();
    const state = play(running({ incidentClock: 5 }), 10);
    expect(state.incident).not.toBeNull();
    expect(state.incidentClock).toBeGreaterThanOrEqual(INCIDENT_GAP.min - 10);
    expect(state.log.at(-1)).toMatchObject({ key: "incident", incident: state.incident!.kind });
    // While it lasts, no other comes; then it runs out.
    const later = play(state, Math.ceil(state.incident!.left) + 1);
    expect(later.incident).toBeNull();
    expect(later.log.filter((entry) => entry.key === "incident")).toHaveLength(1);
  });

  it("never come while the player is away, nor when switched off (which ends the one going on)", () => {
    const away = advance(running({ incidentClock: 5 }), 3600, seededRandom(3));
    expect(away.incident).toBeNull();
    expect(away.log.some((entry) => entry.key === "incident")).toBe(false);
    const striking = running({ incident: { kind: "strike", building: "mill", left: 100 } });
    expect(advance(striking, 200, seededRandom(3)).incident).toBeNull();
    const off = toggleIncidents(striking);
    expect(off).toMatchObject({ incidentsOn: false, incident: null });
    expect(play({ ...off, incidentClock: 1 }, 30).incident).toBeNull();
    expect(toggleIncidents(off).incidentsOn).toBe(true);
  });

  it("only hit what is built: a strike at a workshop there is, the calm only with wind turbines, the fair with trucks", () => {
    const random = seededRandom(5);
    const fewBuildings = plantState({ mill: 1, pizzaFactory: 1, wheatFarm: 1 });
    const kinds = new Set<IncidentKind>();
    for (let i = 0; i < 500; i++) {
      const incident = pickIncident(fewBuildings, random)!;
      kinds.add(incident.kind);
      if (incident.building) expect(["mill", "pizzaFactory"]).toContain(incident.building);
      expect(incident.left).toBe(INCIDENTS[incident.kind].seconds);
    }
    expect([...kinds].sort()).toEqual(INCIDENT_KINDS.filter((kind) => kind !== "calm" && kind !== "fair").sort());
  });

  it("break down less often, and for less long, with maintenance", () => {
    const count = (researched: FactoryState["researched"]) => {
      const random = seededRandom(6);
      const state = running({ researched });
      let breakdowns = 0;
      for (let i = 0; i < 2000; i++) if (pickIncident(state, random)?.kind === "breakdown") breakdowns++;
      return breakdowns;
    };
    expect(count(["maintenance"])).toBeLessThan(count([]) * 0.7);
    const random = seededRandom(7);
    let breakdown: Incident | null = null;
    while (breakdown?.kind !== "breakdown") breakdown = pickIncident(running({ researched: ["maintenance"] }), random);
    expect(breakdown.left).toBe(INCIDENTS.breakdown.seconds / 2);
  });

  it("slow the plant: a strike at the pizza factories halves them, a breakdown stops them", () => {
    const flat = frozenRate(play(running({ incidentsOn: false }), 20));
    const strike = play(running({ incidentsOn: false, incident: { kind: "strike", building: "pizzaFactory", left: 100 } }), 20);
    expect(frozenRate(strike)).toBeCloseTo(flat / 2, -2);
    const breakdown = play(running({ incidentsOn: false, incident: { kind: "breakdown", building: "pizzaFactory", left: 100 } }), 20);
    expect(frozenRate(breakdown)).toBeLessThan(flat * 0.05);
  });

  it("can be lucky: a trade fair sells the pizzas dearer", () => {
    const usual = running({ incidentsOn: false });
    const fair = { ...usual, incident: { kind: "fair" as const, left: 100 } };
    const earned = (state: FactoryState) => tick(state, 1, seededRandom(1)).totalEarned - state.totalEarned;
    expect(earned(fair)).toBeCloseTo(earned(usual) * FAIR_PRICE, -2);
    expect(earned(usual)).toBeGreaterThan(shippedRate(usual) * WHOLESALE_PRICE * 0.9);
  });

  it("end at once for a bonus or a repair (a strike, a breakdown), never the weather", () => {
    const strike = running({ incident: { kind: "strike", building: "mill", left: 100 } });
    const cost = incidentFixCost(strike)!;
    expect(cost).toBeGreaterThan(0);
    const settled = fixIncident(strike)!;
    expect(settled.incident).toBeNull();
    expect(settled.money).toBeCloseTo(strike.money - cost);
    expect(fixIncident({ ...strike, money: cost / 2 })).toBeNull();
    const drought = running({ incident: { kind: "drought", left: 100 } });
    expect(incidentFixCost(drought)).toBeNull();
    expect(fixIncident(drought)).toBeNull();
  });

  it("load back with the save, and anything odd is dropped", () => {
    const state = running({ incident: { kind: "breakdown", building: "creamery", left: 42 }, incidentClock: 120 });
    expect(readFactory(JSON.parse(JSON.stringify(state)))).toMatchObject({ incident: state.incident, incidentClock: 120, incidentsOn: true });
    expect(readIncident({ kind: "earthquake", left: 10 })).toBeNull();
    expect(readIncident({ kind: "strike", left: 10 })).toBeNull();
    expect(readIncident({ kind: "strike", building: "wheatFarm", left: 10 })).toBeNull();
    expect(readIncident({ kind: "drought", building: "wheatFarm", left: 10 })).toBeNull();
    expect(readIncident({ kind: "calm", left: -3 })).toBeNull();
    expect(readIncident({ kind: "calm", left: 1e9 })).toEqual({ kind: "calm", left: INCIDENTS.calm.seconds });
    expect(readFactory({ ...state, incident: "boom", incidentClock: -1 })).toMatchObject({ incident: null, incidentClock: FIRST_INCIDENT });
  });
});
