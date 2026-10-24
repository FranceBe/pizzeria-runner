import { useEffect, type RefObject } from "react";

// A panel lying over the rest of the screen closes on a tap anywhere else, or with Escape.
export const useDismiss = (ref: RefObject<HTMLElement | null>, isOpen: boolean, close: () => void): void => {
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, isOpen, close]);
};
