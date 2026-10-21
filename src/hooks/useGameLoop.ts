import { useEffect, useRef } from "react";
import { saveState } from "../game/state";
import type { Dispatch, GameState } from "../game/types";

const TICK_SECONDS = 0.25;
const AUTOSAVE_INTERVAL_MS = 2000;
const TOAST_DURATION_MS = 4000;

// Drives the game clock, autosaves, and expires the message shown in the ticker.
export const useGameLoop = (state: GameState, dispatch: Dispatch): void => {
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
  // Only these fields trigger it, so it reads the latest state rather than depending on all of it.
  useEffect(() => {
    if (latestState.current.phase !== "service") saveState(latestState.current);
  }, [state.money, state.phase, state.recipes, state.day]);

  useEffect(() => {
    const newest = state.toasts[state.toasts.length - 1];
    if (!newest) return;
    const timer = setTimeout(() => dispatch({ type: "dismissToast", toastId: newest.id }), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state.toasts, dispatch]);
};
