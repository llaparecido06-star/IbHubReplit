import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./pt-BR";
import es from "./es";
import en from "./en";
import fr from "./fr";
import it from "./it";

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v4",
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    resources: {
      "pt-BR": { translation: ptBR },
      es: { translation: es },
      en: { translation: en },
      fr: { translation: fr },
      it: { translation: it },
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
