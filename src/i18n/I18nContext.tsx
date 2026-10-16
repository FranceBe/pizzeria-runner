import { createContext, useContext } from "react";
import { createTranslator, DEFAULT_LANGUAGE, type Translator } from "./index";

const I18nContext = createContext<Translator>(createTranslator(DEFAULT_LANGUAGE));

export const I18nProvider = I18nContext.Provider;

export const useTranslation = (): Translator => useContext(I18nContext);
