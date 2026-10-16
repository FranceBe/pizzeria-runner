// kind: base | sauce | cheese | topping.
// requiredLevel = reputation level needed to sign the supplier, supplierFee = one-off cost to sign it.
// Drawing fields: shape, count (pieces scattered on a pizza), radius / strokeWidth (rings and dots),
// hasVeins (blue cheese), thin (leaf variant).
// The ids are stored in save files: never rename them. Names live in src/i18n.
export const INGREDIENTS = [
  { id: "pate", kind: "base", cost: 0.6, requiredLevel: 1, supplierFee: 0, color: "#ecd2a0" },
  { id: "tomate", kind: "sauce", cost: 0.4, requiredLevel: 1, supplierFee: 0, color: "#c8321f" },
  { id: "mozza", kind: "cheese", cost: 0.9, requiredLevel: 1, supplierFee: 0, color: "#fbf6e9", shape: "blob", count: 9 },
  { id: "basilic", kind: "topping", cost: 0.2, requiredLevel: 1, supplierFee: 0, color: "#3f8f3a", shape: "leaf", count: 6 },
  { id: "origan", kind: "topping", cost: 0.1, requiredLevel: 1, supplierFee: 12, color: "#6b7d3a", shape: "dot", count: 30, radius: 1.5 },
  { id: "jambon", kind: "topping", cost: 1.2, requiredLevel: 2, supplierFee: 25, color: "#eda3a0", shape: "square", count: 8 },
  { id: "champi", kind: "topping", cost: 0.7, requiredLevel: 2, supplierFee: 25, color: "#c9b195", shape: "mushroom", count: 9 },
  { id: "olive", kind: "topping", cost: 0.5, requiredLevel: 2, supplierFee: 20, color: "#2b2622", shape: "ring", count: 10, radius: 4.2, strokeWidth: 2.8 },
  { id: "creme", kind: "sauce", cost: 0.7, requiredLevel: 3, supplierFee: 35, color: "#f1e6cc" },
  { id: "oignon", kind: "topping", cost: 0.3, requiredLevel: 3, supplierFee: 20, color: "#a8679f", shape: "ring", count: 8, radius: 7, strokeWidth: 1.6 },
  { id: "poivron", kind: "topping", cost: 0.5, requiredLevel: 3, supplierFee: 25, color: "#e39a22", shape: "strip", count: 10 },
  { id: "salami", kind: "topping", cost: 1.1, requiredLevel: 3, supplierFee: 35, color: "#b5302c", shape: "disc", count: 7 },
  { id: "piment", kind: "topping", cost: 0.2, requiredLevel: 3, supplierFee: 20, color: "#e8401f", shape: "dot", count: 18, radius: 1.9 },
  { id: "chevre", kind: "cheese", cost: 1.4, requiredLevel: 4, supplierFee: 45, color: "#f7f3ea", shape: "round", count: 7 },
  { id: "gorgo", kind: "cheese", cost: 1.5, requiredLevel: 4, supplierFee: 45, color: "#e3e8d3", shape: "blob", count: 7, hasVeins: true },
  { id: "parmesan", kind: "cheese", cost: 1.2, requiredLevel: 4, supplierFee: 40, color: "#efd892", shape: "shaving", count: 14 },
  { id: "miel", kind: "topping", cost: 0.6, requiredLevel: 4, supplierFee: 30, color: "#e9a91f", shape: "drizzle", count: 1 },
  { id: "anchois", kind: "topping", cost: 1.3, requiredLevel: 5, supplierFee: 40, color: "#8a5a3c", shape: "fish", count: 6 },
  { id: "capres", kind: "topping", cost: 0.5, requiredLevel: 5, supplierFee: 30, color: "#6f8a3e", shape: "dot", count: 14, radius: 2.6 },
  { id: "artichaut", kind: "topping", cost: 1.1, requiredLevel: 5, supplierFee: 40, color: "#9bb06a", shape: "heart", count: 7 },
  { id: "oeuf", kind: "topping", cost: 0.5, requiredLevel: 5, supplierFee: 35, color: "#ffffff", shape: "egg", count: 1 },
  { id: "lardons", kind: "topping", cost: 1.0, requiredLevel: 6, supplierFee: 50, color: "#d98e7e", shape: "cube", count: 16 },
  { id: "patate", kind: "topping", cost: 0.5, requiredLevel: 6, supplierFee: 40, color: "#e8d29a", shape: "slice", count: 7 },
  { id: "reblochon", kind: "cheese", cost: 1.8, requiredLevel: 6, supplierFee: 60, color: "#f2e1ad", shape: "blob", count: 7 },
  { id: "roquette", kind: "topping", cost: 0.6, requiredLevel: 7, supplierFee: 45, color: "#4f8f2f", shape: "leaf", count: 11, thin: true },
  { id: "jcru", kind: "topping", cost: 2.0, requiredLevel: 7, supplierFee: 70, color: "#c9575a", shape: "ribbon", count: 6 },
  { id: "burrata", kind: "cheese", cost: 2.4, requiredLevel: 7, supplierFee: 90, color: "#ffffff", shape: "ball", count: 1 },
  { id: "truffe", kind: "topping", cost: 3.5, requiredLevel: 8, supplierFee: 150, color: "#3a2a22", shape: "shaving", count: 10 },
];

// Same objects, keyed by id, with their position in the list (used as a stable sort order).
export const INGREDIENTS_BY_ID = Object.fromEntries(
  INGREDIENTS.map((ingredient, index) => [ingredient.id, { ...ingredient, listOrder: index }]),
);

// Order in which layers go on the dough.
export const KIND_LAYER_ORDER = { base: 0, sauce: 1, cheese: 2, topping: 3 };

// Ingredients pale enough to need a darker backdrop when drawn on a light background.
export const PALE_COLORS = ["#ffffff", "#fbf6e9", "#f7f3ea", "#e3e8d3", "#f2e1ad", "#efd892", "#e8d29a"];

// Prep-line stations, left to right, like the cold rail in front of a pizzaiolo.
export const PREP_STATIONS = [
  { id: "base", ingredientIds: ["pate"] },
  { id: "sauce", ingredientIds: ["tomate", "creme"] },
  { id: "cheese", ingredientIds: ["mozza", "chevre", "gorgo", "parmesan", "reblochon", "burrata"] },
  { id: "meat", ingredientIds: ["jambon", "salami", "lardons", "jcru", "anchois"] },
  { id: "veg", ingredientIds: ["champi", "olive", "oignon", "poivron", "artichaut", "patate", "capres"] },
  { id: "herb", ingredientIds: ["basilic", "origan", "roquette", "piment"] },
  { id: "finish", ingredientIds: ["miel", "oeuf", "truffe"] },
];
