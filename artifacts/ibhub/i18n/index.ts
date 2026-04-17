import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ptBR from "./pt-BR";
import es from "./es";
import en from "./en";
import fr from "./fr";
import it from "./it";

export const LOCALE_STORAGE_KEY = "@ibhub_locale";

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v4",
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    resources: {
      "pt-BR": { translation: ptBR },
      es:      { translation: es },
      en:      { translation: en },
      fr:      { translation: fr },
      it:      { translation: it },
    },
    interpolation: { escapeValue: false },
  });

/**
 * Call once at app startup (before rendering).
 * Reads the persisted locale from AsyncStorage and applies it to i18n.
 */
export async function initLocale(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && saved !== i18n.language) {
      await i18n.changeLanguage(saved);
    }
  } catch {
    // ignore — default pt-BR stays
  }
}

/**
 * Change app language and persist the selection.
 */
export async function changeLocale(code: string): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    // ignore storage errors
  }
}

export default i18n;
