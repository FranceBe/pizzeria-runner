// A name is a person (see game/regulars.ts): the longer these lists, the longer it takes to meet everyone.
// Names are only used for looks (facial hair, hair length); nothing else in the game depends on them.
const FEMININE_NAMES = [
  "Giulia", "Sofia", "Chiara", "Elena", "Léa", "Nina", "Inès", "Aïcha", "Zoé", "Priya",
  "Rosa", "Lina", "Ada", "Alba", "Francesca", "Bianca", "Martina", "Valentina", "Serena", "Manon",
  "Chloé", "Jade", "Louise", "Alice", "Yasmine", "Fatou", "Mei", "Ana", "Olga", "Emma",
  "Maya", "Iris", "Sara", "Clara", "Margot", "Lucie", "Rania", "Suzanne", "Mila",
  "Agathe", "Beatrice", "Carla", "Diane", "Eva", "Flora", "Hana", "Ilaria", "Joséphine", "Kiara",
  "Léonie", "Marta", "Noémie", "Ornella", "Paula", "Romane", "Salomé", "Tess", "Ursula", "Violette",
  "Amélie", "Anouk", "Bérénice", "Capucine", "Célia", "Dalia", "Elsa", "Gaïa", "Héloïse", "Isaure",
  "Jeanne", "Leila", "Maëlle", "Nadia", "Olivia", "Pia", "Rachel", "Sabrina", "Thaïs", "Yuna",
  "Zélie", "Aya", "Mariam", "Ludovica", "Greta",
] as const;
const MASCULINE_NAMES = [
  "Luca", "Marco", "Matteo", "Paolo", "Hugo", "Théo", "Jules", "Malik", "Tom", "Oscar",
  "Enzo", "Félix", "Bruno", "Lorenzo", "Giorgio", "Dario", "Nico", "Pietro", "Louis", "Gabriel",
  "Arthur", "Raphaël", "Noah", "Karim", "Moussa", "Kenji", "Diego", "Ivan", "Liam", "Leo",
  "Adam", "Elias", "Basile", "Victor", "Simon", "Omar", "Gaspard",
  "Achille", "Baptiste", "Carlo", "Damien", "Émile", "Fabio", "Gino", "Hector", "Ilan", "Joachim",
  "Kofi", "Lino", "Mathis", "Nils", "Otto", "Pablo", "Rémi", "Silvio", "Tiago", "Yanis",
  "Alessandro", "Amir", "Antoine", "Bastien", "Cyril", "Edoardo", "Ethan", "Ferdinand", "Hamza", "Ismaël",
  "Jonas", "Kévin", "Léandre", "Marius", "Nathan", "Owen", "Riccardo", "Samuel", "Tristan", "Ugo",
  "Valentin", "Wassim", "Yohan", "Zacharie", "Sami",
] as const;
const UNISEX_NAMES = [
  "Camille", "Sam", "Nour", "Lou", "Alex", "Charlie", "Robin", "Sacha", "Eden", "Noa",
  "Andrea", "Ariel", "Dominique", "Ange", "Alix", "Jo", "Kim", "Sasha", "Yael", "Morgan",
] as const;

export const CUSTOMER_NAMES: readonly string[] = [...FEMININE_NAMES, ...MASCULINE_NAMES, ...UNISEX_NAMES];

export type NameKind = "feminine" | "masculine" | "unisex";
const FEMININE: ReadonlySet<string> = new Set(FEMININE_NAMES);
const MASCULINE: ReadonlySet<string> = new Set(MASCULINE_NAMES);

// Critics and names from older saves count as unisex.
export const nameKind = (name: string): NameKind => (FEMININE.has(name) ? "feminine" : MASCULINE.has(name) ? "masculine" : "unisex");

export const SKIN_TONES: readonly string[] = ["#f1c9a5", "#e0ac83", "#c68b62", "#9b6644", "#6f4630", "#f5d7bd", "#d9a07a", "#4f3122"];
export const HAIR_COLORS: readonly string[] = [
  "#2b1d14", "#5b3a22", "#a8652e", "#d9b25f", "#1b1b1b", "#8c8c8c", "#b2402a", "#e8e2d6", "#7a2e1f", "#d98a5b", "#3e2a1e",
];
// Now and then, someone with blue, green, pink or purple hair.
export const BOLD_HAIR_COLORS: readonly string[] = ["#3d6fd9", "#2fa36b", "#e26aa6", "#8a55d6", "#1fb3b3"];
export const BOLD_HAIR_CHANCE = 0.12;

// Short, bob, bun, long, curly, ponytail, bald, spiky, afro, side part, two buns, braids (see components/CustomerFace.tsx).
export const HAIR_STYLE_COUNT = 12;
// Mostly longer hair for feminine names, shorter for masculine ones, with now and then the other way round.
export const LONGER_HAIR_STYLES: readonly number[] = [1, 2, 3, 4, 5, 8, 10, 11];
export const SHORTER_HAIR_STYLES: readonly number[] = [0, 4, 6, 7, 8, 9];
export const UNUSUAL_HAIR_CHANCE = 0.1;
export const FACIAL_HAIR: ReadonlySet<string> = new Set(["moustache", "beard", "goatee"]);

// What some customers wear, so regulars are easy to spot. The ids are stored in save files: never rename them.
export const ACCESSORY_IDS = [
  "glasses", "sunglasses", "moustache", "beard", "beret", "cap", "earrings", "flower",
  "headband", "bow", "bandana", "headphones", "freckles", "hat",
  "beanie", "scarf", "noseRing", "goatee", "pearls", "monocle",
] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];
export const ACCESSORY_CHANCE = 0.5;

// Each customer picks one of this many lines per mood (the lines themselves live in src/i18n).
export const LINES_PER_MOOD = 3;
