import { describe, it, expect } from "vitest";
import { makeState, play, stateInService, makeCustomer } from "../test/helpers.js";
import { shortcutAction } from "./shortcuts.js";

const luca = makeCustomer();
const sofia = makeCustomer({ id: "cust-2", name: "Sofia", ingredients: ["pate", "tomate", "origan"] });

describe("shortcutAction", () => {
  it("does nothing outside service", () => {
    expect(shortcutAction(makeState(), "0")).toBeNull();
  });

  it("maps 0 to the dough and 1–9 to the selected order's ingredients", () => {
    const state = stateInService([luca]);
    expect(shortcutAction(state, "0")).toEqual({ type: "toggleIngredient", ingredientId: "pate" });
    expect(shortcutAction(state, "1")).toEqual({ type: "toggleIngredient", ingredientId: "tomate" });
    expect(shortcutAction(state, "3")).toEqual({ type: "toggleIngredient", ingredientId: "basilic" });
    expect(shortcutAction(state, "4")).toBeNull();
  });

  it("doesn't give recipes away when help is off", () => {
    const state = stateInService([luca]);
    state.settings.showHelp = false;
    expect(shortcutAction(state, "1")).toBeNull();
  });

  it("bakes with Space only once dough is down", () => {
    const state = stateInService([luca]);
    expect(shortcutAction(state, " ")).toBeNull();
    expect(shortcutAction(play(state, { type: "toggleIngredient", ingredientId: "pate" }), " ")).toEqual({ type: "bake" });
  });

  it("serves with Enter, the selected customer first", () => {
    let state = stateInService([luca, sofia]);
    state.service.ready = [
      { id: "p-luca", ingredients: luca.ingredients },
      { id: "p-sofia", ingredients: sofia.ingredients },
    ];
    expect(shortcutAction(state, "Enter")).toEqual({ type: "servePizza", pizzaId: "p-luca" });
    state = play(state, { type: "selectCustomer", customerId: "cust-2" });
    expect(shortcutAction(state, "Enter")).toEqual({ type: "servePizza", pizzaId: "p-sofia" });
  });

  it("cycles through orders with the arrow keys", () => {
    const state = stateInService([luca, sofia]);
    expect(shortcutAction(state, "ArrowRight")).toEqual({ type: "selectCustomer", customerId: "cust-2" });
    expect(shortcutAction(state, "ArrowLeft")).toEqual({ type: "selectCustomer", customerId: "cust-2" });
  });

  it("bins the board with Backspace and lets the assistant build with A", () => {
    const state = play(stateInService([luca]), { type: "toggleIngredient", ingredientId: "pate" });
    expect(shortcutAction(state, "Backspace")).toEqual({ type: "trashBoard" });
    expect(shortcutAction(state, "a")).toBeNull();
    state.upgrades.commis = 2;
    expect(shortcutAction(state, "a")).toEqual({ type: "assembleOrder" });
  });
});
