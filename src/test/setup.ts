// Before every test file: the texts of every language, which the game itself loads one at a time, on demand.
import { loadAllLanguages } from "../i18n";

await loadAllLanguages();
