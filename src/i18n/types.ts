import type { IngredientId } from "../data/ingredients";
import type { AchievementId } from "../data/achievements";
import type { DrinkId } from "../data/drinks";
import type { FestivalId } from "../data/festivals";
import type { StoryId } from "../data/stories";
import type { PostcardId } from "../data/postcards";
import type { QuestGiver } from "../data/quests";
import type { UpgradeKey } from "../data/progression";
import type { Pairing } from "../data/recipes";
import type { fr } from "./fr";
import type { Language } from "./languages";

// The French dictionary is the reference: its shape defines the keys, and its literal strings and
// function signatures define the params each key takes. Every other language must match that shape.

/** Available to dictionary entries written as functions, and on every translator. */
export interface TranslationHelpers {
  money(amount: number): string;
  number(value: number): string;
  ingredient(id: IngredientId): string;
  /** "a, b, c" (Chinese: "a、b、c"). */
  list(items: readonly string[]): string;
  /** Words put side by side: spaced, except in Chinese, which writes without spaces. */
  words(...parts: string[]): string;
  ingredientList(ids: readonly IngredientId[]): string;
  /** Everything but the dough, for recipe cards. */
  toppings(ids: readonly IngredientId[]): string;
  /** Classic recipes are translated; custom ones keep the name the player gave them. */
  recipe(recipe: { id: string; name?: string | null }): string;
  upgradeName(key: UpgradeKey): string;
  upgradeDescription(key: UpgradeKey, level: number): string;
  /** "Chèvre & miel" */
  pairing(pairing: Pairing): string;
  achievementName(id: AchievementId): string;
  drink(id: DrinkId): string;
  questGiver(giver: QuestGiver): string;
  festival(id: FestivalId): string;
  storyTitle(id: StoryId): string;
  postcardTitle(id: PostcardId): string;
  medal(medal: "gold" | "silver" | "bronze"): string;
}

type Reference = typeof fr;

/** The reference dictionary with its literal strings widened to `string`: the type of every language. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : T extends readonly (infer Element)[]
      ? readonly Widen<Element>[]
      : { [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<Reference>;

type Leaf = string | ((...args: never[]) => string);
type ArrayPaths<A> = A extends readonly (infer Element)[]
  ? Element extends readonly unknown[]
    ? `${number}.${ArrayPaths<Element>}`
    : `${number}`
  : never;
type Paths<T> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? K
    : T[K] extends readonly unknown[]
      ? `${K}.${ArrayPaths<T[K]>}`
      : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Every valid key, like "prep.title" or "customerLines.2.1". */
export type TranslationKey = Paths<Reference>;

type Step<T, Part extends string> = T extends readonly (infer Element)[] ? Element : Part extends keyof T ? T[Part] : never;
/** The reference entry stored under a key. */
export type EntryAt<Key extends string, T = Reference> = Key extends `${infer Head}.${infer Rest}`
  ? EntryAt<Rest, Step<T, Head>>
  : Step<T, Key>;

type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never;

/** What an entry needs: its function's params, the values of its {placeholders}, or nothing. */
export type ParamsOf<Entry> = Entry extends (params: infer Params, helpers: TranslationHelpers) => string
  ? Params
  : Entry extends string
    ? [Placeholders<Entry>] extends [never]
      ? undefined
      : { [Name in Placeholders<Entry>]: string | number }
    : never;

export type TranslationParams<Key extends string> = ParamsOf<EntryAt<Key>>;

type ParamsArgument<Params> = [Params] extends [undefined] ? [params?: undefined] : [params: Params];

export type Translate = <Key extends TranslationKey>(key: Key, ...params: ParamsArgument<TranslationParams<Key>>) => string;

export type Translator = Translate & TranslationHelpers & { language: Language };

/**
 * A message kept in the game state and translated when shown (toasts, tutorial steps):
 * each key comes with exactly the params its entry needs.
 */
export type MessageInput<Section extends "toasts" | "tutorial", Key extends string> = Key extends unknown
  ? [TranslationParams<`${Section}.${Key}`>] extends [undefined]
    ? { key: Key; params?: undefined }
    : { key: Key; params: TranslationParams<`${Section}.${Key}`> }
  : never;

export type ToastKey = keyof Reference["toasts"];
export type TutorialKey = Exclude<keyof Reference["tutorial"], "label" | "skip">;
