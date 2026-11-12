import { describe, it, expect } from "vitest";
import {
  BUILDING_IDS, BUILDINGS, buildingStatus, factoryCapacity, nextModule, noBuildings, noStocks, planFor, powerBalance, runPlant, speedOf, storeCap,
  usageOf, type BuildingId, type PlantState,
} from "./plant";
import type { ResearchId } from "./research";

const plant = (buildings: Partial<Record<BuildingId, number>>, researched: ResearchId[] = []): PlantState => ({
  buildings: { ...noBuildings(), ...buildings },
  stocks: noStocks(),
  factoryRates: noBuildings(),
  stockTrends: noStocks(),
  researched,
});

const run = (state: PlantState, seconds: number): PlantState => {
  let next = state;
  for (let i = 0; i < seconds; i++) next = runPlant(next, 1).state;
  return next;
};

/** A plant sized by the planner for this many factories, built in full (rounded up). */
const balanced = (factories: number, researched: ResearchId[] = []): PlantState => {
  const base = plant({}, researched);
  const plan = planFor(base, factories * (BUILDINGS.pizzaFactory.makes.frozen ?? 0) * speedOf(base, "pizzaFactory"));
  return plant(Object.fromEntries(BUILDING_IDS.map((id) => [id, Math.ceil(plan[id] - 1e-9)])), researched);
};

describe("the plant", () => {
  it("needs power: a field alone does nothing, a wind turbine gets it going and fills the wheat store", () => {
    const dark = run(plant({ wheatFarm: 1 }), 3);
    expect(dark.stocks.wheat).toBe(0);
    expect(buildingStatus(dark, "wheatFarm")).toEqual({ kind: "unpowered" });
    const lit = run(plant({ wheatFarm: 1, windTurbine: 1 }), 3);
    expect(lit.stocks.wheat).toBeCloseTo(3 * (BUILDINGS.wheatFarm.makes.wheat ?? 0));
    expect(powerBalance(lit)).toEqual({ supply: 8, demand: 1 });
  });

  it("slows everything down when the power runs short", () => {
    // Ten fields need 10 MW; a turbine makes 8: everything runs at 80%.
    const short = run(plant({ wheatFarm: 10, windTurbine: 1 }), 30);
    expect(usageOf(short, "wheatFarm")).toBeCloseTo(0.8, 1);
    expect(buildingStatus(short, "wheatFarm")).toEqual({ kind: "unpowered" });
  });

  it("turns goods into others, leaves the creamery's whey besides, and stops a building whose store is full", () => {
    const mill = run(plant({ wheatFarm: 1, mill: 1, windTurbine: 1 }), 2);
    expect(mill.stocks.flour).toBeGreaterThan(0);
    // Nothing takes the flour away: its store fills up, and the mill stops.
    const full = run(mill, 120);
    expect(full.stocks.flour).toBeCloseTo(storeCap(full, "flour"));
    expect(buildingStatus(full, "mill").kind).toBe("blocked");
    const creamery = run(plant({ dairyFarm: 1, saltWorks: 1, creamery: 1, windTurbine: 1 }), 5);
    expect(creamery.stocks.whey).toBeCloseTo(creamery.stocks.cheese * 2);
  });

  it("shares a good between lines: the salt, for the dough and the mozzarella", () => {
    const salty = run(plant({ waterPump: 1, saltWorks: 1, wheatFarm: 2, mill: 2, kneader: 2, dairyFarm: 4, creamery: 4, windTurbine: 6 }), 20);
    const short = [buildingStatus(salty, "kneader"), buildingStatus(salty, "creamery")];
    expect(short).toContainEqual({ kind: "starved", good: "salt" });
  });

  it("burns the whey for power, once some wind has got it going", () => {
    const state = run(plant({ dairyFarm: 2, saltWorks: 1, creamery: 2, biogasPlant: 1, windTurbine: 2 }), 10);
    expect(powerBalance(state).supply).toBeGreaterThan(16);
    // With no wind at all, nothing ever starts: the biogas needs whey, which needs power.
    expect(powerBalance(run(plant({ dairyFarm: 2, saltWorks: 1, creamery: 2, biogasPlant: 4 }), 10)).supply).toBe(0);
  });

  it("runs flat out when built as the planner says: every factory busy, every pizza shipped", () => {
    const state = run(balanced(2), 90);
    expect(usageOf(state, "pizzaFactory")).toBeGreaterThan(0.95);
    const frozen = state.factoryRates.pizzaFactory * (BUILDINGS.pizzaFactory.makes.frozen ?? 0);
    expect(frozen).toBeCloseTo(factoryCapacity(state), -2);
    const shipped = state.factoryRates.shippingDock * (BUILDINGS.shippingDock.uses.frozen ?? 0);
    expect(shipped).toBeCloseTo(frozen, -2);
  });

  it("feeds the laboratories before the docks", () => {
    const state = { ...balanced(1), buildings: { ...balanced(1).buildings, researchLab: 1 } };
    const step = runPlant(run(state, 30), 1);
    expect(step.research).toBeGreaterThan(0.9);
    expect(step.shipped).toBeLessThan(factoryCapacity(state));
  });

  it("grows by modules: the first holds every kind of building, the next ones one more factory's worth", () => {
    const first = nextModule(plant({}));
    expect(Object.keys(first.builds).sort()).toEqual(BUILDING_IDS.filter((id) => id !== "researchLab").sort());
    expect(first.cost).toBeGreaterThan(0);
    const second = nextModule(balanced(1));
    expect(second.builds.pizzaFactory).toBe(1);
    expect(second.cost).toBeLessThan(first.cost * 1.5);
  });

  it("works faster with research, and the plan follows", () => {
    expect(speedOf(plant({}, ["conveyorBelts"]), "mill")).toBe(1.5);
    expect(speedOf(plant({}, ["fertilizer"]), "wheatFarm")).toBe(2);
    expect(speedOf(plant({}, ["robotArms"]), "pizzaFactory")).toBe(2);
    expect(speedOf(plant({}, ["modernised", "futuristic"]), "creamery")).toBe(4);
    const plain = planFor(plant({}), 3000);
    const fertilised = planFor(plant({}, ["fertilizer"]), 3000);
    expect(fertilised.wheatFarm).toBeCloseTo(plain.wheatFarm / 2);
  });
});
