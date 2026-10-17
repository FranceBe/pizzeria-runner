// A name is a person (see game/regulars.ts): the longer this list, the longer it takes to meet everyone.
export const CUSTOMER_NAMES: readonly string[] = [
  "Luca", "Giulia", "Marco", "Sofia", "Matteo", "Chiara", "Paolo", "Elena", "Hugo", "Léa",
  "Nina", "Théo", "Inès", "Jules", "Camille", "Malik", "Aïcha", "Tom", "Zoé", "Sam",
  "Priya", "Oscar", "Rosa", "Enzo", "Lina", "Ada", "Félix", "Nour", "Bruno", "Alba",
  "Lorenzo", "Francesca", "Giorgio", "Bianca", "Dario", "Martina", "Nico", "Valentina", "Pietro", "Serena",
  "Louis", "Manon", "Gabriel", "Chloé", "Arthur", "Jade", "Raphaël", "Louise", "Noah", "Alice",
  "Yasmine", "Karim", "Fatou", "Moussa", "Mei", "Kenji", "Ana", "Diego", "Olga", "Ivan",
  "Emma", "Liam", "Maya", "Leo", "Iris", "Adam", "Sara", "Elias", "Clara", "Basile",
  "Margot", "Victor", "Lucie", "Simon", "Rania", "Omar", "Suzanne", "Gaspard", "Lou", "Mila",
];

export const SKIN_TONES: readonly string[] = ["#f1c9a5", "#e0ac83", "#c68b62", "#9b6644", "#6f4630", "#f5d7bd"];
export const HAIR_COLORS: readonly string[] = ["#2b1d14", "#5b3a22", "#a8652e", "#d9b25f", "#1b1b1b", "#8c8c8c", "#b2402a", "#e8e2d6"];
// Now and then, someone with blue, green, pink or purple hair.
export const BOLD_HAIR_COLORS: readonly string[] = ["#3d6fd9", "#2fa36b", "#e26aa6", "#8a55d6", "#1fb3b3"];
export const BOLD_HAIR_CHANCE = 0.12;

// Short, bob, bun, long, curly, ponytail, bald, spiky (see components/CustomerFace.tsx).
export const HAIR_STYLE_COUNT = 8;

// What some customers wear, so regulars are easy to spot. The ids are stored in save files: never rename them.
export const ACCESSORY_IDS = ["glasses", "sunglasses", "moustache", "beard", "beret", "cap", "earrings", "flower"] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];
export const ACCESSORY_CHANCE = 0.5;

// Each customer picks one of this many lines per mood (the lines themselves live in src/i18n).
export const LINES_PER_MOOD = 3;
