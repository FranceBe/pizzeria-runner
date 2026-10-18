import type { IngredientId } from "./ingredients";

// Classic recipes appear in the recipe book as soon as all their ingredients are unlocked.
// The ids are stored in save files: never rename them. Names live in src/i18n.
const CLASSIC_LIST = [
  { id: "margherita", ingredients: ["pate", "tomate", "mozza", "basilic"] },
  { id: "marinara", ingredients: ["pate", "tomate", "origan"] },
  { id: "regina", ingredients: ["pate", "tomate", "mozza", "jambon", "champi"] },
  { id: "diavola", ingredients: ["pate", "tomate", "mozza", "salami", "piment"] },
  { id: "ortolana", ingredients: ["pate", "tomate", "mozza", "champi", "poivron", "oignon"] },
  { id: "quattro", ingredients: ["pate", "creme", "mozza", "gorgo", "chevre", "parmesan"] },
  { id: "chevremiel", ingredients: ["pate", "creme", "mozza", "chevre", "miel"] },
  { id: "napoli", ingredients: ["pate", "tomate", "mozza", "anchois", "capres", "olive"] },
  { id: "bismarck", ingredients: ["pate", "tomate", "mozza", "jambon", "oeuf"] },
  { id: "capri", ingredients: ["pate", "tomate", "mozza", "jambon", "champi", "artichaut", "olive"] },
  { id: "savoyarde", ingredients: ["pate", "creme", "lardons", "patate", "oignon", "reblochon"] },
  { id: "parma", ingredients: ["pate", "tomate", "mozza", "jcru", "roquette", "parmesan"] },
  { id: "burrata", ingredients: ["pate", "tomate", "burrata", "roquette", "basilic"] },
  { id: "tartufo", ingredients: ["pate", "creme", "mozza", "champi", "truffe", "parmesan"] },
  // Desserts
  { id: "chocobanane", ingredients: ["pate", "chocolat", "banane", "noisette"] },
  { id: "fraisemasca", ingredients: ["pate", "mascarpone", "fraise", "miel"] },
  // Nonna's secret recipes: she hands them over when the pizzeria reaches their level.
  { id: "nonna", ingredients: ["pate", "tomate", "mozza", "parmesan", "origan", "basilic"], signatureLevel: 4 },
  { id: "nonnarosa", ingredients: ["pate", "creme", "mozza", "jambon", "champi", "roquette"], signatureLevel: 7 },
  { id: "segreto", ingredients: ["pate", "creme", "burrata", "truffe", "roquette", "miel"], signatureLevel: 10 },
  { id: "capolavoro", ingredients: ["pate", "tomate", "burrata", "jcru", "artichaut", "basilic", "parmesan"], signatureLevel: 15 },
  // Festivals: made with the basics plus the festival's ingredient, so every pizzeria can join in.
  { id: "zucca", ingredients: ["pate", "mozza", "potiron", "basilic"], festival: "halloween" },
  { id: "natale", ingredients: ["pate", "tomate", "mozza", "marron"], festival: "christmas" },
  { id: "amore", ingredients: ["pate", "mozza", "framboise", "basilic"], festival: "valentine" },
] as const satisfies readonly { id: string; ingredients: readonly IngredientId[]; signatureLevel?: number; festival?: string }[];

export type ClassicRecipeId = (typeof CLASSIC_LIST)[number]["id"];

export interface ClassicRecipe {
  id: ClassicRecipeId;
  ingredients: readonly IngredientId[];
  /** Nonna's recipes: the level at which she shares them. They are a little more appealing. */
  signatureLevel?: number;
  /** Only cookable while this calendar festival lasts. */
  festival?: string;
}

export const CLASSIC_RECIPES: readonly ClassicRecipe[] = CLASSIC_LIST;

export const MARGHERITA: ClassicRecipe = CLASSIC_LIST[0];

export type Pairing = readonly [IngredientId, IngredientId];

// Flavour pairings reward thoughtful custom recipes; clashes cost a little appeal.
export const GOOD_PAIRINGS: readonly Pairing[] = [
  ["tomate", "basilic"], ["mozza", "basilic"], ["jambon", "champi"], ["chevre", "miel"], ["gorgo", "miel"],
  ["anchois", "capres"], ["anchois", "olive"], ["roquette", "jcru"], ["roquette", "parmesan"], ["lardons", "patate"],
  ["patate", "reblochon"], ["oignon", "lardons"], ["salami", "piment"], ["burrata", "tomate"], ["truffe", "champi"],
  ["truffe", "creme"], ["poivron", "oignon"], ["artichaut", "olive"], ["jambon", "oeuf"], ["tomate", "origan"],
  ["salami", "miel"], ["chevre", "roquette"], ["gorgo", "champi"],
  ["chocolat", "banane"], ["chocolat", "noisette"], ["banane", "noisette"], ["fraise", "mascarpone"], ["chocolat", "fraise"],
];

export const BAD_PAIRINGS: readonly Pairing[] = [
  ["miel", "anchois"], ["truffe", "piment"], ["burrata", "reblochon"],
  ["capres", "miel"], ["truffe", "salami"], ["oeuf", "anchois"],
  ["chocolat", "tomate"], ["fraise", "anchois"],
];
