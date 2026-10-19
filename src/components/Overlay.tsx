import { useEffect, type ReactNode } from "react";

// How many overlays are open: the page under them stays still until the last one closes.
let openCount = 0;

interface OverlayProps {
  label: string;
  /** A tap on the dimmed background, outside the dialog. Left out, such a tap does nothing. */
  onClose?: () => void;
  children: ReactNode;
}

// A dialog over the page. The page under it doesn't scroll while it is open.
export function Overlay({ label, onClose, children }: OverlayProps) {
  useEffect(() => {
    openCount += 1;
    document.documentElement.classList.add("modal-open");
    return () => {
      openCount -= 1;
      if (openCount === 0) document.documentElement.classList.remove("modal-open");
    };
  }, []);
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose ? (event) => event.target === event.currentTarget && onClose() : undefined}
    >
      {children}
    </div>
  );
}
