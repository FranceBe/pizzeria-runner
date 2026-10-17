// A well-known sequence of keys. Typing it anywhere in the game is worth something.
const SEQUENCE = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

// Adds a key to the ones typed so far. Returns the keys to keep, and whether the sequence was just completed.
export function typeSecretKey(typed: readonly string[], key: string): { typed: string[]; isComplete: boolean } {
  const next = [...typed, key.toLowerCase()].slice(-SEQUENCE.length);
  const isComplete = next.length === SEQUENCE.length && next.every((typedKey, index) => typedKey === SEQUENCE[index]);
  return { typed: isComplete ? [] : next, isComplete };
}

// On touch screens, swipes stand in for the arrows. Once the arrows are all in, two buttons appear for the rest.
const SWIPE_MIN_DISTANCE = 40;
const ARROW_COUNT = 8;

// The arrow a swipe means, or null for a tap or a small movement.
export function swipeKey(dx: number, dy: number): string | null {
  if (Math.hypot(dx, dy) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "arrowright" : "arrowleft";
  return dy > 0 ? "arrowdown" : "arrowup";
}

// True when the keys typed so far end with every arrow of the sequence: only the two buttons are missing.
export const awaitsButtons = (typed: readonly string[]): boolean =>
  typed.length >= ARROW_COUNT && typed.slice(-ARROW_COUNT).every((key, index) => key === SEQUENCE[index]);
