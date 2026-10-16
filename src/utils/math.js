export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const roundToHalf = (value) => Math.round(value * 2) / 2;

// Absorbs floating-point noise when comparing money amounts (0.1 + 0.2 > 0.3).
export const MONEY_EPSILON = 1e-9;
export const canAfford = (money, cost) => money + MONEY_EPSILON >= cost;
