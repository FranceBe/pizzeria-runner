import { describe, it, expect } from "vitest";
import { coopViewFor, createCoopGame, decodeCoop, encodeCoop, isCoopMove, isRoleMove, playCoopMove, rolesFor, tickCoop, type CoopGame } from "./coop";
import { ovenSlots } from "../game/service";

const HOST = "host";
const GUEST = "guest";
const startKitchen = (): CoopGame => {
  let coop = createCoopGame("coop-seed", [HOST, GUEST], "en");
  // Let the first customers in.
  for (let second = 0; second < 8; second++) coop = tickCoop(coop, 1);
  return coop;
};

describe("a co-op kitchen", () => {
  it("is a shared challenge apart from anyone's pizzeria: two ovens of two pizzas, endless pans, a team score", () => {
    const coop = createCoopGame("coop-seed", [HOST, GUEST], "en");
    expect(coop.game.service?.challenge).toMatchObject({ multiplayer: true, coop: true });
    expect(ovenSlots(coop.game)).toBe(4);
    expect(Object.keys(coop.boards)).toEqual([HOST, GUEST]);
    // Its two ovens don't earn anyone the "second oven" achievement.
    expect(tickCoop(coop, 1).game.toasts.filter((toast) => toast.key === "achievement")).toEqual([]);
  });

  it("gives each player their own board and order, and a different order each when there is a choice", () => {
    let coop = startKitchen();
    const [first, second] = coop.game.service?.customers ?? [];
    expect(first && second).toBeTruthy();
    expect(coop.boards[HOST].selectedCustomerId).not.toBe(coop.boards[GUEST].selectedCustomerId);
    coop = playCoopMove(coop, HOST, { type: "toggleIngredient", ingredientId: "pate" });
    coop = playCoopMove(coop, HOST, { type: "toggleIngredient", ingredientId: "tomate" });
    coop = playCoopMove(coop, GUEST, { type: "toggleIngredient", ingredientId: "pate" });
    expect(coop.boards[HOST].board).toEqual(["pate", "tomate"]);
    expect(coop.boards[GUEST].board).toEqual(["pate"]);
  });

  it("lets a player choose the same order as the other: making it twice is theirs to avoid", () => {
    let coop = startKitchen();
    const hostOrder = coop.boards[HOST].selectedCustomerId;
    coop = playCoopMove(coop, GUEST, { type: "selectCustomer", customerId: hostOrder ?? "" });
    coop = tickCoop(coop, 3);
    expect(coop.boards[GUEST].selectedCustomerId).toBe(hostOrder);
  });

  it("shares the ovens and the pass: one player's pizza can go to the other's customer", () => {
    let coop = startKitchen();
    coop = playCoopMove(coop, HOST, { type: "toggleIngredient", ingredientId: "pate" });
    coop = playCoopMove(coop, HOST, { type: "bake" });
    coop = playCoopMove(coop, GUEST, { type: "toggleIngredient", ingredientId: "pate" });
    coop = playCoopMove(coop, GUEST, { type: "bake" });
    expect(coop.game.service?.oven).toHaveLength(2);
    expect(coop.boards[HOST].board).toEqual([]);
  });

  it("shows each player their own board, and what their partner is on", () => {
    let coop = startKitchen();
    coop = playCoopMove(coop, GUEST, { type: "toggleIngredient", ingredientId: "pate" });
    const view = coopViewFor(coop, GUEST, { id: HOST, color: 2, name: "Léa" });
    expect(view.service?.board).toEqual(["pate"]);
    expect(view.service?.selectedCustomerId).toBe(coop.boards[GUEST].selectedCustomerId);
    expect(view.service?.partner).toEqual({ selectedCustomerId: coop.boards[HOST].selectedCustomerId, color: 2, name: "Léa" });
  });

  it("only takes kitchen moves from the other phone", () => {
    expect(isCoopMove({ type: "bake" })).toBe(true);
    expect(isCoopMove({ type: "servePizza", pizzaId: "x" })).toBe(true);
    expect(isCoopMove({ type: "buyUpgrade", upgradeKey: "oven" })).toBe(false);
    expect(isCoopMove({ type: "resetGame" })).toBe(false);
    expect(isCoopMove({ type: "tick", seconds: 999 })).toBe(false);
    expect(isCoopMove("bake")).toBe(false);
  });

  it("travels to the other phone and back unchanged, and ends with a team result", () => {
    let coop = startKitchen();
    expect(decodeCoop(encodeCoop(coop))).toEqual(coop);
    expect(decodeCoop("nonsense")).toBeNull();
    for (let second = 0; second < 125; second++) coop = tickCoop(coop, 1);
    expect(coop.game.challengeResult).toMatchObject({ multiplayer: true, coop: true });
  });
});

describe("roles in a shared kitchen", () => {
  it("follow the host's choice: free, the host at the board, or the host at the pass", () => {
    expect(rolesFor("free", [HOST, GUEST])).toBeUndefined();
    expect(rolesFor(undefined, [HOST, GUEST])).toBeUndefined();
    expect(rolesFor("hostCooks", [HOST, GUEST])).toEqual({ [HOST]: "cook", [GUEST]: "pass" });
    expect(rolesFor("hostServes", [HOST, GUEST])).toEqual({ [HOST]: "pass", [GUEST]: "cook" });
    expect(rolesFor("hostCooks", [HOST])).toBeUndefined();
  });

  it("keep the board and the oven for the cook, the pass and the bar for the other; the rest is everyone's", () => {
    const roles = rolesFor("hostCooks", [HOST, GUEST]);
    expect(isRoleMove(roles, HOST, { type: "toggleIngredient", ingredientId: "pate" })).toBe(true);
    expect(isRoleMove(roles, GUEST, { type: "toggleIngredient", ingredientId: "pate" })).toBe(false);
    expect(isRoleMove(roles, GUEST, { type: "bake" })).toBe(false);
    expect(isRoleMove(roles, HOST, { type: "servePizza", pizzaId: "p" })).toBe(false);
    expect(isRoleMove(roles, GUEST, { type: "servePizza", pizzaId: "p" })).toBe(true);
    expect(isRoleMove(roles, HOST, { type: "pourDrink", drinkId: "eau" })).toBe(false);
    expect(isRoleMove(roles, GUEST, { type: "selectCustomer", customerId: "c" })).toBe(true);
    expect(isRoleMove(roles, HOST, { type: "selectCustomer", customerId: "c" })).toBe(true);
    // The group order is chosen like any order: the cook makes its pizzas.
    expect(isRoleMove(roles, HOST, { type: "selectBatch" })).toBe(true);
    expect(isRoleMove(undefined, GUEST, { type: "bake" })).toBe(true);
  });

  it("leave the kitchen as it was for a move of the other side, and tell each player their role", () => {
    let coop = createCoopGame("coop-seed", [HOST, GUEST], "en", 120, "hostServes");
    for (let second = 0; second < 8; second++) coop = tickCoop(coop, 1);
    expect(playCoopMove(coop, HOST, { type: "toggleIngredient", ingredientId: "pate" })).toBe(coop);
    expect(playCoopMove(coop, GUEST, { type: "toggleIngredient", ingredientId: "pate" }).boards[GUEST].board).toEqual(["pate"]);
    expect(coopViewFor(coop, HOST).service?.role).toBe("pass");
    expect(coopViewFor(coop, GUEST).service?.role).toBe("cook");
    expect(coopViewFor(createCoopGame("coop-seed", [HOST, GUEST], "en"), HOST).service?.role).toBeUndefined();
    // The roles travel with the kitchen to the other phone.
    expect(decodeCoop(encodeCoop(coop))?.roles).toEqual(coop.roles);
  });
});
