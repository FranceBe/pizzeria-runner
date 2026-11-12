// A drawing fitted to the screen: its whole height in view below the page's sticky header, its width in its card.
import { useLayoutEffect, useState, type RefObject } from "react";

/** It never shrinks below this. */
const MIN_ZOOM = 0.7;
/** On a phone it can't fit: it keeps readable and scrolls sideways. */
const PHONE_ZOOM = 0.8;
/** Room kept free when fitting: for the bar above the drawing, and a little air. */
const FIT_MARGIN = 64;

export const useFitZoom = (box: RefObject<HTMLElement | null>, width: number, height: number, isActive: boolean, isNarrow: boolean): number => {
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const element = box.current;
    if (!isActive || !element) return;
    const fit = () => {
      const byWidth = element.clientWidth / width;
      // The page's header stays stuck to the top of the screen: the drawing fits below it.
      const header = document.querySelector<HTMLElement>(".fi-top")?.offsetHeight ?? 0;
      const byHeight = (window.innerHeight - header - FIT_MARGIN) / height;
      setZoom(isNarrow ? PHONE_ZOOM : Math.max(MIN_ZOOM, Math.min(1, byWidth, byHeight)));
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(element);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [box, width, height, isActive, isNarrow]);
  return zoom;
};
