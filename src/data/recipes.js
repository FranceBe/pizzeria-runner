// Classic recipes appear in the recipe book as soon as all their ingredients are unlocked.
// The ids are stored in save files: never rename them.
export const CLASSIC_RECIPES = [
  { id: "margherita", name: "Margherita", ingredients: ["pate", "tomate", "mozza", "basilic"] },
  { id: "marinara", name: "Marinara", ingredients: ["pate", "tomate", "origan"] },
  { id: "regina", name: "Regina", ingredients: ["pate", "tomate", "mozza", "jambon", "champi"] },
  { id: "diavola", name: "Diavola", ingredients: ["pate", "tomate", "mozza", "salami", "piment"] },
  { id: "ortolana", name: "Ortolana", ingredients: ["pate", "tomate", "mozza", "champi", "poivron", "oignon"] },
  { id: "quattro", name: "Quattro formaggi", ingredients: ["pate", "creme", "mozza", "gorgo", "chevre", "parmesan"] },
  { id: "chevremiel", name: "Chèvre-miel", ingredients: ["pate", "creme", "mozza", "chevre", "miel"] },
  { id: "napoli", name: "Napoletana", ingredients: ["pate", "tomate", "mozza", "anchois", "capres", "olive"] },
  { id: "bismarck", name: "Bismarck", ingredients: ["pate", "tomate", "mozza", "jambon", "oeuf"] },
  { id: "capri", name: "Capricciosa", ingredients: ["pate", "tomate", "mozza", "jambon", "champi", "artichaut", "olive"] },
  { id: "savoyarde", name: "Savoyarde", ingredients: ["pate", "creme", "lardons", "patate", "oignon", "reblochon"] },
  { id: "parma", name: "Parma", ingredients: ["pate", "tomate", "mozza", "jcru", "roquette", "parmesan"] },
  { id: "burrata", name: "Burrata", ingredients: ["pate", "tomate", "burrata", "roquette", "basilic"] },
  { id: "tartufo", name: "Tartufo", ingredients: ["pate", "creme", "mozza", "champi", "truffe", "parmesan"] },
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
