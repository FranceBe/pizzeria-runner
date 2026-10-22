// The daily challenge: two minutes, free ingredients, and the same customers in the same order for everyone
// who plays on that date, so friends can compare scores. Everything random comes from a generator seeded by the date.
import { CUSTOMER_NAMES, LINES_PER_MOOD } from "../data/customers";
import { CLASSIC_RECIPES, type ClassicRecipeId } from "../data/recipes";
import { hashString, makeId, seededStep } from "../utils/random";
import { rollLooks } from "./looks";
import { fairPrice, isDessert } from "./pizza";
import type { Challenge, Customer } from "./types";

export const CHALLENGE_SECONDS = 120;
const MENU_SIZE = 4;
export const CHALLENGE_ARRIVALS = { min: 2, max: 4 };
const ROYALE_SECONDS = 300;

// "2026-10-17", in the player's own time zone.
export const localDate = (date: Date = new Date()): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Draws a number in [0, 1) and moves the challenge's generator along. Mutates the challenge.
const draw = (challenge: Challenge): number => {
  const { value, next } = seededStep(challenge.seed);
  challenge.seed = next;
  return value;
};

const drawFrom = <T>(challenge: Challenge, list: readonly T[]): T => list[Math.floor(draw(challenge) * list.length)];

// Savoury classics only: every player gets the same four, whatever they have unlocked.
const CHALLENGE_RECIPES = CLASSIC_RECIPES.filter((classic) => !classic.signatureLevel && !classic.festival && !isDessert(classic.ingredients));

// `seconds`: a match against friends may be shorter or longer, as its host picked.
export const createChallenge = (date: string, multiplayer = false, seconds: number = CHALLENGE_SECONDS, royale = false): Challenge => {
  const challenge: Challenge = {
    ...(multiplayer ? { multiplayer } : {}),
    ...(royale ? { royale } : {}),
    secondsLeft: seconds,
    score: 0,
    date,
    seed: hashString(`forno-lento:${date}`),
    menu: [],
    happy: 0,
  };
  const pool = [...CHALLENGE_RECIPES];
  while (challenge.menu.length < MENU_SIZE && pool.length) {
    const [picked] = pool.splice(Math.floor(draw(challenge) * pool.length), 1);
    challenge.menu.push(picked.id);
  }
  return challenge;
};

export const challengeRecipe = (id: ClassicRecipeId) => CLASSIC_RECIPES.find((classic) => classic.id === id) ?? CLASSIC_RECIPES[0];

// Pizza Royale speeds up: customers come up to this much faster by the end, so even the careful ones are pushed.
export const ROYALE_FASTEST_PACE = 0.4;
export const nextChallengeArrival = (challenge: Challenge): number => {
  const wait = CHALLENGE_ARRIVALS.min + draw(challenge) * (CHALLENGE_ARRIVALS.max - CHALLENGE_ARRIVALS.min);
  if (!challenge.royale) return wait;
  const remaining = Math.min(1, Math.max(0, challenge.secondsLeft / ROYALE_SECONDS));
  return wait * (ROYALE_FASTEST_PACE + (1 - ROYALE_FASTEST_PACE) * remaining);
};

// The next customer of the day's sequence. Mutates the challenge's generator.
export const createChallengeCustomer = (challenge: Challenge, waitingNames: ReadonlySet<string>): Customer => {
  const recipe = challengeRecipe(drawFrom(challenge, challenge.menu));
  const name = drawFrom(challenge, CUSTOMER_NAMES.filter((candidate) => !waitingNames.has(candidate)));
  return {
    // Ids only need to be unique, not shared between players.
    id: makeId(),
    name,
    ...rollLooks(name, () => draw(challenge)),
    recipeId: recipe.id,
    recipeName: null,
    ingredients: recipe.ingredients,
    extraIngredient: null,
    removedIngredient: null,
    price: fairPrice(recipe.ingredients),
    waitedSeconds: 0,
    lineIndex: Math.floor(draw(challenge) * LINES_PER_MOOD),
  };
};
