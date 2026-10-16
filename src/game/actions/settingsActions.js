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

  dismissToast(state, { toastId }) {
    state.toasts = state.toasts.filter((toast) => toast.id !== toastId);
  },

  // These two replace the whole state instead of mutating it.
  importSave(state, { saveData }) {
    const imported = hydrateState(saveData);
    pushToast(imported, "Partie chargée.");
    return imported;
  },

  resetGame() {
    const fresh = createInitialState();
    pushToast(fresh, "Nouvelle pizzeria ouverte.");
    return fresh;
  },
};
