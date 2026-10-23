export const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

export const randomIndex = (length: number): number => Math.floor(Math.random() * length);

export const pickRandom = <T>(list: readonly T[]): T => list[randomIndex(list.length)];

// Random, plus a counter: two ids made in the same session can never be the same, however the random numbers fall
// (the tests' seeded generator only has 10,000 of them).
let idCounter = 0;
export const makeId = (): string => `${Math.random().toString(36).slice(2, 9)}-${(idCounter++).toString(36)}`;

// FNV-1a: turns a string into a stable 32-bit number, used to seed drawings.
export const hashString = (text: string): number => {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

// Xorshift generator: same seed, same sequence of numbers in [0, 1).
// Keeps toppings in the same spot on every render.
export const seededRandom = (seed: number): () => number => {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };
};

// One step of the same xorshift generator, for sequences that must survive a save and reload:
// the caller stores `next` and passes it back for the following number.
export const seededStep = (seed: number): { value: number; next: number } => {
  let next = seed || 1;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { value: (next % 10000) / 10000, next };
};
