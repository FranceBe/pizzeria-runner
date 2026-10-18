import { useEffect, useRef } from "react";
import { cuesBetween, effectsLevel, isSizzling, musicLevel, snapshotOf } from "../audio/cues";
import { audio } from "../audio/engine";
import type { GameState } from "../game/types";

// Plays the music and the sound effects that follow the game (see audio/cues.ts for what plays when).
export function useGameAudio(state: GameState): void {
  const previous = useRef(snapshotOf(state));

  // Browsers only allow sound after the player touches the page.
  useEffect(() => {
    const unlock = () => audio.unlock();
    const onVisibility = () => audio.setPageVisible(document.visibilityState === "visible");
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const music = musicLevel(state);
  const effects = effectsLevel(state);
  useEffect(() => {
    audio.setLevels(music, effects);
    audio.setMusic(music > 0);
  }, [music, effects]);

  const sizzling = isSizzling(state);
  useEffect(() => {
    audio.setSizzle(sizzling);
  }, [sizzling]);

  useEffect(() => {
    const current = snapshotOf(state);
    const cues = cuesBetween(previous.current, current);
    previous.current = current;
    if (cues.newOrder) audio.play("newOrder");
    if (cues.payment) audio.play("payment");
  }, [state]);
}
