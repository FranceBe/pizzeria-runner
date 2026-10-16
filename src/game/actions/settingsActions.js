import { LANGUAGES } from "../../i18n/index.js";
import { createInitialState, hydrateState } from "../state.js";
import { pushToast } from "../toasts.js";

const MAX_NAME_LENGTH = 32;

export const settingsActions = {
  renamePizzeria(state, { name }) {
    state.name = name.slice(0, MAX_NAME_LENGTH);
  },

  toggleHelp(state) {
    state.settings.showHelp = !state.settings.showHelp;
  },

  setLanguage(state, { language }) {
    if (LANGUAGES.includes(language)) state.settings.language = language;
  },

  dismissToast(state, { toastId }) {
    state.toasts = state.toasts.filter((toast) => toast.id !== toastId);
  },

  // These two replace the whole state instead of mutating it.
  // Both keep the language chosen on this device.
  importSave(state, { saveData }) {
    const imported = hydrateState(saveData);
    imported.settings.language = state.settings.language;
    pushToast(imported, "gameLoaded");
    return imported;
  },

  resetGame(state) {
    const fresh = createInitialState(state.settings.language);
    pushToast(fresh, "gameReset");
    return fresh;
  },
};
