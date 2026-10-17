import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { ErrorBoundary } from "./ErrorBoundary";
import { setBrokenSaveAside } from "../game/state";

afterEach(() => vi.unstubAllGlobals());

// A tiny stand-in for the browser's localStorage.
function stubStorage(entries: Record<string, string>): Map<string, string> {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  return store;
}

describe("ErrorBoundary", () => {
  it("shows the game until something breaks, then a way out", () => {
    expect(renderToString(<ErrorBoundary><p>game</p></ErrorBoundary>)).toBe("<p>game</p>");
    const boundary = new ErrorBoundary({ children: <p>game</p> });
    boundary.state = ErrorBoundary.getDerivedStateFromError();
    const html = renderToString(boundary.render());
    expect(html).toContain("the kitchen caught fire");
    expect(html).toContain("Start a new game");
  });

  it("sets the broken save aside instead of deleting it", () => {
    const store = stubStorage({ "forno-lento-save-v1": "{broken" });
    setBrokenSaveAside();
    expect(store.get("forno-lento-save-v1")).toBeUndefined();
    expect(store.get("forno-lento-broken-save")).toBe("{broken");
  });
});
