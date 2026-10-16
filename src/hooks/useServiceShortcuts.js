import { useEffect, useRef } from "react";
import { shortcutAction } from "../game/shortcuts.js";

// Listens to the keyboard while the service screen is shown (see game/shortcuts.js for the keys).
export function useServiceShortcuts(state, dispatch, isEnabled) {
  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    if (!isEnabled) return;
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.target.closest?.("input, textarea, select, [role='dialog']")) return;
      const action = shortcutAction(latestState.current, event.key);
      if (!action) return;
      // Otherwise Space or Enter would also press whichever button was clicked last.
      event.preventDefault();
      document.activeElement?.blur?.();
      dispatch(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEnabled, dispatch]);
}
