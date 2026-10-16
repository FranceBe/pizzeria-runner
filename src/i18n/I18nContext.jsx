import { createContext, useContext } from "react";
import { createTranslator, DEFAULT_LANGUAGE } from "./index.js";

const I18nContext = createContext(createTranslator(DEFAULT_LANGUAGE));

export const I18nProvider = I18nContext.Provider;

export const useTranslation = () => useContext(I18nContext);
