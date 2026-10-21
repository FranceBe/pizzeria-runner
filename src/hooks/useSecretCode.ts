import { useCallback, useEffect, useRef, useState } from "react";
import { awaitsButtons, swipeKey, typeSecretKey } from "../game/secretCode";
import type { Dispatch } from "../game/types";

// How long the two buttons stay on screen after the swipes.
const PAD_SECONDS = 6;

export interface SecretPad {
  isOpen: boolean;
  press: (key: "a" | "b") => void;
}

// Listens for a certain sequence, anywhere in the game: typed on a keyboard, or swiped on a touch screen,
// where two buttons then show up to finish it. They go away on success, on a wrong press, or after a few seconds.
export const useSecretCode = (dispatch: Dispatch): SecretPad => {
  const typed = useRef<string[]>([]);
  const [isOpen, setOpen] = useState(false);

  const type = useCallback(
    (key: string) => {
      const result = typeSecretKey(typed.current, key);
      typed.current = result.typed;
      if (result.isComplete) dispatch({ type: "enterSecretCode" });
      return result;
    },
    [dispatch],
  );

  const press = useCallback(
    (key: "a" | "b") => {
      const { typed: after, isComplete } = type(key);
      // B then A: after B, the sequence must still be waiting for A.
      const isOnTrack = key === "b" && after.at(-1) === "b" && awaitsButtons(after.slice(0, -1));
      if (isComplete || !isOnTrack) {
        setOpen(false);
        if (!isComplete) typed.current = [];
      }
    },
    [type],
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setOpen(false);
      typed.current = [];
    }, PAD_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;
      type(event.key);
    };
    let start: { x: number; y: number } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const key = swipeKey(touch.clientX - start.x, touch.clientY - start.y);
      start = null;
      if (!key) return;
      type(key);
      if (awaitsButtons(typed.current)) setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    // Passive: the game's own scrolling and taps work exactly as before.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [type]);

  return { isOpen, press };
};
