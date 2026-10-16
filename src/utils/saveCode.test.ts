import { describe, it, expect } from "vitest";
import { encodeSaveCode, decodeSaveCode } from "./saveCode";

describe("save codes", () => {
  it("round-trips accented text", () => {
    const save = { name: "Chèvre & Œuf", money: 12.5, recipes: [] };
    expect(decodeSaveCode(encodeSaveCode(save))).toEqual(save);
  });

  it("matches the format of codes made before the cleanup", () => {
    const save = { name: "Pâte", money: 1, recipes: [] };
    const legacyCode = btoa(unescape(encodeURIComponent(JSON.stringify(save))));
    expect(encodeSaveCode(save)).toBe(legacyCode);
    expect(decodeSaveCode(legacyCode)).toEqual(save);
  });

  it("ignores surrounding whitespace", () => {
    const code = encodeSaveCode({ money: 1, recipes: [] });
    expect(decodeSaveCode(`  ${code}\n`)).toEqual({ money: 1, recipes: [] });
  });

  it("rejects garbage and non-save JSON", () => {
    expect(() => decodeSaveCode("not base64 !!")).toThrow();
    expect(() => decodeSaveCode(btoa(JSON.stringify({ hello: "world" })))).toThrow();
  });
});
