import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { INGREDIENTS } from "../data/ingredients.js";
import { CLASSIC_RECIPES } from "../data/recipes.js";
import { UPGRADES } from "../data/progression.js";
import { createTranslator, LANGUAGES } from "./index.js";
import { en } from "./en.js";
import { fr } from "./fr.js";

// Flattens a dictionary into "path.to.key" -> "string" | "function" | "array".
function shapeOf(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && !Array.isArray(value)) return shapeOf(value, path);
    if (Array.isArray(value)) return [[path, `array(${value.map((row) => row.length ?? 1).join(",")})`]];
    return [[path, typeof value]];
  });
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
}

describe("dictionaries", () => {
  it("have exactly the same keys in every language", () => {
    expect(shapeOf(en)).toEqual(shapeOf(fr));
  });

  it("name every ingredient, classic recipe, upgrade and station", () => {
    for (const language of LANGUAGES) {
      const t = createTranslator(language);
      const keys = [
        ...INGREDIENTS.map((i) => `ingredients.${i.id}`),
        ...CLASSIC_RECIPES.map((r) => `recipes.${r.id}`),
        ...Object.keys(UPGRADES).map((key) => `upgrades.${key}.name`),
      ];
      for (const key of keys) expect(t(key), `${language}: ${key}`).not.toBe(key);
    }
  });

  it("translate every toast pushed by the game", () => {
    const source = sourceFiles(join(import.meta.dirname, "..")).map((file) => readFileSync(file, "utf8")).join("\n");
    const toastKeys = [...source.matchAll(/pushToast\(\w+, "(\w+)"/g)].map((match) => match[1]);
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
    expect(english("nope.missing")).toBe("nope.missing");
  });
});
