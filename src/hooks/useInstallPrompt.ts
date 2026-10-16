import { useEffect, useState } from "react";

// Chrome and Edge fire `beforeinstallprompt` when the game can be installed; the event is kept to show
// the browser's dialog later, from a button. Safari has no such event (the hint explains its menu instead).
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;

export function useInstallPrompt(): { canInstall: boolean; isInstalled: boolean; install: () => void } {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = () => {
    if (!promptEvent) return;
    void promptEvent.prompt();
    void promptEvent.userChoice.then(() => setPromptEvent(null));
  };

  return { canInstall: promptEvent !== null, isInstalled, install };
}
