// Classic recipes appear in the recipe book as soon as all their ingredients are unlocked.
// The ids are stored in save files: never rename them. Names live in src/i18n.
export const CLASSIC_RECIPES = [
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
];

export const MARGHERITA = CLASSIC_RECIPES[0];

// Flavour pairings reward thoughtful custom recipes; clashes cost a little appeal.
export const GOOD_PAIRINGS = [
  ["tomate", "basilic"], ["mozza", "basilic"], ["jambon", "champi"], ["chevre", "miel"], ["gorgo", "miel"],
  ["anchois", "capres"], ["anchois", "olive"], ["roquette", "jcru"], ["roquette", "parmesan"], ["lardons", "patate"],
  ["patate", "reblochon"], ["oignon", "lardons"], ["salami", "piment"], ["burrata", "tomate"], ["truffe", "champi"],
  ["truffe", "creme"], ["poivron", "oignon"], ["artichaut", "olive"], ["jambon", "oeuf"], ["tomate", "origan"],
  ["salami", "miel"], ["chevre", "roquette"], ["gorgo", "champi"],
];

export const BAD_PAIRINGS = [
  ["miel", "anchois"], ["truffe", "piment"], ["burrata", "reblochon"],
  ["capres", "miel"], ["truffe", "salami"], ["oeuf", "anchois"],
];
