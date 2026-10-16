// kind: base | sauce | cheese | topping.
// requiredLevel = reputation level needed to sign the supplier, supplierFee = one-off cost to sign it.
// Drawing fields: shape, count (pieces scattered on a pizza), radius / strokeWidth (rings and dots),
// hasVeins (blue cheese), thin (leaf variant).
// The ids are stored in save files: never rename them.
export const INGREDIENTS = [
  { id: "pate", name: "Pâte", kind: "base", cost: 0.6, requiredLevel: 1, supplierFee: 0, color: "#ecd2a0" },
  { id: "tomate", name: "Sauce tomate", kind: "sauce", cost: 0.4, requiredLevel: 1, supplierFee: 0, color: "#c8321f" },
  { id: "mozza", name: "Mozzarella", kind: "cheese", cost: 0.9, requiredLevel: 1, supplierFee: 0, color: "#fbf6e9", shape: "blob", count: 9 },
  { id: "basilic", name: "Basilic", kind: "topping", cost: 0.2, requiredLevel: 1, supplierFee: 0, color: "#3f8f3a", shape: "leaf", count: 6 },
  { id: "origan", name: "Origan", kind: "topping", cost: 0.1, requiredLevel: 1, supplierFee: 12, color: "#6b7d3a", shape: "dot", count: 30, radius: 1.5 },
  { id: "jambon", name: "Jambon", kind: "topping", cost: 1.2, requiredLevel: 2, supplierFee: 25, color: "#eda3a0", shape: "square", count: 8 },
  { id: "champi", name: "Champignons", kind: "topping", cost: 0.7, requiredLevel: 2, supplierFee: 25, color: "#c9b195", shape: "mushroom", count: 9 },
  { id: "olive", name: "Olives noires", kind: "topping", cost: 0.5, requiredLevel: 2, supplierFee: 20, color: "#2b2622", shape: "ring", count: 10, radius: 4.2, strokeWidth: 2.8 },
  { id: "creme", name: "Crème fraîche", kind: "sauce", cost: 0.7, requiredLevel: 3, supplierFee: 35, color: "#f1e6cc" },
  { id: "oignon", name: "Oignons rouges", kind: "topping", cost: 0.3, requiredLevel: 3, supplierFee: 20, color: "#a8679f", shape: "ring", count: 8, radius: 7, strokeWidth: 1.6 },
  { id: "poivron", name: "Poivrons", kind: "topping", cost: 0.5, requiredLevel: 3, supplierFee: 25, color: "#e39a22", shape: "strip", count: 10 },
  { id: "salami", name: "Salami piquant", kind: "topping", cost: 1.1, requiredLevel: 3, supplierFee: 35, color: "#b5302c", shape: "disc", count: 7 },
  { id: "piment", name: "Piment", kind: "topping", cost: 0.2, requiredLevel: 3, supplierFee: 20, color: "#e8401f", shape: "dot", count: 18, radius: 1.9 },
  { id: "chevre", name: "Chèvre", kind: "cheese", cost: 1.4, requiredLevel: 4, supplierFee: 45, color: "#f7f3ea", shape: "round", count: 7 },
  { id: "gorgo", name: "Gorgonzola", kind: "cheese", cost: 1.5, requiredLevel: 4, supplierFee: 45, color: "#e3e8d3", shape: "blob", count: 7, hasVeins: true },
  { id: "parmesan", name: "Parmesan", kind: "cheese", cost: 1.2, requiredLevel: 4, supplierFee: 40, color: "#efd892", shape: "shaving", count: 14 },
  { id: "miel", name: "Miel", kind: "topping", cost: 0.6, requiredLevel: 4, supplierFee: 30, color: "#e9a91f", shape: "drizzle", count: 1 },
  { id: "anchois", name: "Anchois", kind: "topping", cost: 1.3, requiredLevel: 5, supplierFee: 40, color: "#8a5a3c", shape: "fish", count: 6 },
  { id: "capres", name: "Câpres", kind: "topping", cost: 0.5, requiredLevel: 5, supplierFee: 30, color: "#6f8a3e", shape: "dot", count: 14, radius: 2.6 },
  { id: "artichaut", name: "Artichauts", kind: "topping", cost: 1.1, requiredLevel: 5, supplierFee: 40, color: "#9bb06a", shape: "heart", count: 7 },
  { id: "oeuf", name: "Œuf", kind: "topping", cost: 0.5, requiredLevel: 5, supplierFee: 35, color: "#ffffff", shape: "egg", count: 1 },
  { id: "lardons", name: "Lardons", kind: "topping", cost: 1.0, requiredLevel: 6, supplierFee: 50, color: "#d98e7e", shape: "cube", count: 16 },
  { id: "patate", name: "Pommes de terre", kind: "topping", cost: 0.5, requiredLevel: 6, supplierFee: 40, color: "#e8d29a", shape: "slice", count: 7 },
  { id: "reblochon", name: "Reblochon", kind: "cheese", cost: 1.8, requiredLevel: 6, supplierFee: 60, color: "#f2e1ad", shape: "blob", count: 7 },
  { id: "roquette", name: "Roquette", kind: "topping", cost: 0.6, requiredLevel: 7, supplierFee: 45, color: "#4f8f2f", shape: "leaf", count: 11, thin: true },
  { id: "jcru", name: "Jambon cru", kind: "topping", cost: 2.0, requiredLevel: 7, supplierFee: 70, color: "#c9575a", shape: "ribbon", count: 6 },
  { id: "burrata", name: "Burrata", kind: "cheese", cost: 2.4, requiredLevel: 7, supplierFee: 90, color: "#ffffff", shape: "ball", count: 1 },
  { id: "truffe", name: "Truffe noire", kind: "topping", cost: 3.5, requiredLevel: 8, supplierFee: 150, color: "#3a2a22", shape: "shaving", count: 10 },
];

// Same objects, keyed by id, with their position in the list (used as a stable sort order).
export const INGREDIENTS_BY_ID = Object.fromEntries(
  INGREDIENTS.map((ingredient, index) => [ingredient.id, { ...ingredient, listOrder: index }]),
);

export const ingredientName = (id) => INGREDIENTS_BY_ID[id].name;

export const KIND_LABELS = { base: "Base", sauce: "Sauces", cheese: "Fromages", topping: "Garnitures" };

// Order in which layers go on the dough.
export const KIND_LAYER_ORDER = { base: 0, sauce: 1, cheese: 2, topping: 3 };

// Ingredients pale enough to need a darker backdrop when drawn on a light background.
export const PALE_COLORS = ["#ffffff", "#fbf6e9", "#f7f3ea", "#e3e8d3", "#f2e1ad", "#efd892", "#e8d29a"];

// Prep-line stations, left to right, like the cold rail in front of a pizzaiolo.
export const PREP_STATIONS = [
  { id: "base", label: "Pâte", ingredientIds: ["pate"] },
  { id: "sauce", label: "Sauces", ingredientIds: ["tomate", "creme"] },
  { id: "cheese", label: "Fromages", ingredientIds: ["mozza", "chevre", "gorgo", "parmesan", "reblochon", "burrata"] },
  { id: "meat", label: "Charcuterie & poisson", ingredientIds: ["jambon", "salami", "lardons", "jcru", "anchois"] },
  { id: "veg", label: "Légumes", ingredientIds: ["champi", "olive", "oignon", "poivron", "artichaut", "patate", "capres"] },
  { id: "herb", label: "Herbes & épices", ingredientIds: ["basilic", "origan", "roquette", "piment"] },
  { id: "finish", label: "Finitions", ingredientIds: ["miel", "oeuf", "truffe"] },
];
