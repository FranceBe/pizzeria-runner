import { useEffect, useRef } from "react";
import { saveState } from "../game/state.js";

const TICK_SECONDS = 0.25;
const AUTOSAVE_INTERVAL_MS = 2000;
const TOAST_DURATION_MS = 3200;

// Drives the game clock, autosaves, and expires toasts one at a time.
export function useGameLoop(state, dispatch) {
  const latestState = useRef(state);
  latestState.current = state;

  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "tick", seconds: TICK_SECONDS }), TICK_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [dispatch]);

  useEffect(() => {
    const save = () => saveState(latestState.current);
    const timer = setInterval(save, AUTOSAVE_INTERVAL_MS);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, []);

  // Outside service, save right away on meaningful changes like purchases.
  useEffect(() => {
    if (state.phase !== "service") saveState(state);
  }, [state.money, state.phase, state.recipes, state.day]);

  useEffect(() => {
    if (!state.toasts.length) return;
    const oldestToastId = state.toasts[0].id;
    const timer = setTimeout(() => dispatch({ type: "dismissToast", toastId: oldestToastId }), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state.toasts, dispatch]);
}
