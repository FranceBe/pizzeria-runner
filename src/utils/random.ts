export const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

export const randomIndex = (length: number): number => Math.floor(Math.random() * length);

export const pickRandom = <T>(list: readonly T[]): T => list[randomIndex(list.length)];

export const makeId = (): string => Math.random().toString(36).slice(2, 9);

// FNV-1a: turns a string into a stable 32-bit number, used to seed drawings.
export function hashString(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Xorshift generator: same seed, same sequence of numbers in [0, 1).
// Keeps toppings in the same spot on every render.
export function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };
}
