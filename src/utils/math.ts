export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const roundToHalf = (value: number): number => Math.round(value * 2) / 2;

// Absorbs floating-point noise when comparing money amounts (0.1 + 0.2 > 0.3).
export const MONEY_EPSILON = 1e-9;
export const canAfford = (money: number, cost: number): boolean => money + MONEY_EPSILON >= cost;
