import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { INGREDIENTS } from "../data/ingredients";
import { CLASSIC_RECIPES } from "../data/recipes";
import { UPGRADE_KEYS } from "../data/progression";
import { createTranslator, LANGUAGES } from "./index";
import { en } from "./en";
import { fr } from "./fr";

// Flattens a dictionary into "path.to.key" -> "string" | "function" | "array".
const shapeOf = (node: object, prefix = ""): [string, string][] => {
  return Object.entries(node).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) return [[path, `array(${value.map((row: unknown[]) => row.length).join(",")})`]];
    if (typeof value === "object" && value !== null) return shapeOf(value, path);
    return [[path, typeof value]];
  });
};

// "{name}" placeholders of every plain-string entry, by path.
const placeholdersOf = (node: object, prefix = ""): Record<string, string[]> => {
  return Object.fromEntries(
    Object.entries(node).flatMap(([key, value]): [string, string[]][] => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") return [[path, [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()]];
      if (typeof value === "object" && value !== null && !Array.isArray(value)) return Object.entries(placeholdersOf(value, path));
      return [];
    }),
  );
};

const sourceFiles = (directory: string): string[] => {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
};

describe("dictionaries", () => {
  it("have exactly the same keys in every language", () => {
    expect(shapeOf(en)).toEqual(shapeOf(fr));
  });

  // TypeScript checks the shape, but not that both languages use the same {placeholders}.
  it("use the same placeholders in every language", () => {
    expect(placeholdersOf(en)).toEqual(placeholdersOf(fr));
  });

  it("name every ingredient, classic recipe, upgrade and station", () => {
    for (const language of LANGUAGES) {
      const t = createTranslator(language);
      for (const { id } of INGREDIENTS) expect(t.ingredient(id), `${language}: ${id}`).not.toBe(`ingredients.${id}`);
      for (const { id } of CLASSIC_RECIPES) expect(t.recipe({ id }), `${language}: ${id}`).not.toBe(`recipes.${id}`);
      for (const key of UPGRADE_KEYS) expect(t.upgradeName(key), `${language}: ${key}`).not.toBe(`upgrades.${key}.name`);
    }
  });

  it("translate every toast pushed by the game", () => {
    const source = sourceFiles(join(import.meta.dirname, "..")).map((file) => readFileSync(file, "utf8")).join("\n");
    const toastKeys = [...source.matchAll(/pushToast\(\w+, \{ key: "(\w+)"/g)].map((match) => match[1]);
    expect(toastKeys.length).toBeGreaterThan(15);
    for (const language of LANGUAGES) {
      const dictionary = language === "fr" ? fr : en;
      for (const key of toastKeys) expect(dictionary.toasts, `${language}: toasts.${key}`).toHaveProperty(key);
    }
  });
});

describe("createTranslator", () => {
  const french = createTranslator("fr");
  const english = createTranslator("en");

  it("fills in placeholders", () => {
    expect(english("prep.title", { day: 3 })).toBe("Day 3 · prep");
    expect(french("prep.title", { day: 3 })).toBe("Jour 3 · mise en place");
  });

  it("runs function entries with formatted values", () => {
    expect(french("pops.tip", { amount: 0.5 })).toBe("+0,50 € pourboire");
    expect(english("toasts.restocked", { cost: 12 })).toBe("Stock topped up for €12.00.");
  });

  it("handles plurals", () => {
    expect(french("upgrades.oven.describe", { level: 0 })).toBe("1 pizza à la fois · cuisson 6 s");
    expect(english("upgrades.oven.describe", { level: 1 })).toBe("2 pizzas at a time · 4.5s bake");
  });

  it("translates classic recipe names but keeps custom ones", () => {
    expect(english.recipe({ id: "chevremiel", name: null })).toBe("Goat cheese & honey");
    expect(french.recipe({ id: "chevremiel", name: "Chèvre-miel" })).toBe("Chèvre-miel");
    expect(english.recipe({ id: "c-abc123", name: "La Fellows" })).toBe("La Fellows");
  });

  it("lists toppings without the dough", () => {
    expect(english.toppings(["pate", "tomate", "mozza"])).toBe("Tomato sauce, Mozzarella");
  });

  it("formats money per language", () => {
    expect(french.money(7.5)).toBe("7,50 €");
    expect(english.money(7.5)).toBe("€7.50");
    expect(english.money(-3)).toBe("-€3.00");
  });

  it("shows the key itself when a translation is missing", () => {
    // Rejected at compile time too: keys are typed.
    // @ts-expect-error unknown key
    expect(english("nope.missing")).toBe("nope.missing");
  });
});
