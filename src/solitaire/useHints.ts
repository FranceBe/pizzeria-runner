// Asks the hint worker (hintWorker.ts) for help, one question at a time: a newer question makes the older one's answer
// be dropped. Where workers aren't available, the search runs on the page.
import { useCallback, useEffect, useRef } from "react";
import { findHint, type Hint } from "./hint";
import type { Game } from "./klondike";

export const useHints = () => {
  const worker = useRef<Worker | null>(null);
  const pending = useRef<{ id: number; resolve: (hint: Hint | null) => void } | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    try {
      worker.current = new Worker(new URL("./hintWorker.ts", import.meta.url), { type: "module" });
      worker.current.onmessage = (event: MessageEvent<{ id: number; hint: Hint }>) => {
        if (pending.current?.id !== event.data.id) return;
        pending.current.resolve(event.data.hint);
        pending.current = null;
      };
    } catch {
      worker.current = null;
    }
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);

  // The hint for this game, or null when a newer question took its place.
  return useCallback((game: Game): Promise<Hint | null> => {
    pending.current?.resolve(null);
    if (!worker.current) return Promise.resolve(findHint(game));
    const id = nextId.current++;
    return new Promise((resolve) => {
      pending.current = { id, resolve };
      worker.current?.postMessage({ id, game });
    });
  }, []);
};
