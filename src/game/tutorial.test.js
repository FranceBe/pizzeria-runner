import { describe, it, expect } from "vitest";
import { makeState, play, stateInService, makeCustomer } from "../test/helpers.js";
import { tutorialStep } from "./tutorial.js";

const toggle = (ingredientId) => ({ type: "toggleIngredient", ingredientId });

describe("tutorialStep", () => {
  it("invites the player to open on day one", () => {
    expect(tutorialStep(makeState())).toMatchObject({ key: "open", target: "open" });
  });

  it("stays quiet after day one or once done", () => {
    expect(tutorialStep(makeState({ day: 2 }))).toBeNull();
    expect(tutorialStep(play(makeState(), { type: "skipTutorial" }))).toBeNull();
  });

  it("walks through a whole first order", () => {
    let state = stateInService([]);
    expect(tutorialStep(state).key).toBe("waiting");

    state = stateInService([makeCustomer()]);
    expect(tutorialStep(state)).toMatchObject({ key: "dough", target: "dough", params: { name: "Luca" } });

    state = play(state, toggle("pate"), toggle("tomate"));
    expect(tutorialStep(state)).toMatchObject({ key: "toppings", target: "toppings", params: { ingredientIds: ["mozza", "basilic"] } });

    state = play(state, toggle("mozza"), toggle("basilic"));
    expect(tutorialStep(state)).toMatchObject({ key: "bake", target: "bake" });

    state = play(state, { type: "bake" }, { type: "tick", seconds: 10 });
    expect(tutorialStep(state)).toMatchObject({ key: "serve", target: "serve", params: { name: "Luca" } });

    state = play(state, { type: "servePizza", pizzaId: state.service.ready[0].id });
    expect(state.settings.tutorialDone).toBe(true);
    expect(tutorialStep(state)).toBeNull();
  });

  it("points out an ingredient that isn't in the order", () => {
    const start = stateInService([makeCustomer()]);
    start.unlocked.origan = true;
    start.stock.origan = 3;
    const state = play(start, toggle("pate"), toggle("origan"));
    expect(tutorialStep(state)).toMatchObject({ key: "extra", params: { ingredientIds: ["origan"] } });
  });
});
