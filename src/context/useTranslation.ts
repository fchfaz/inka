import { createContext, useContext } from 'react';
import { type Language, type Translations, translations } from '../services/i18n';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'id',
  setLanguage: () => {},
  t: translations.id,
});

export const useTranslation = () => useContext(LanguageContext);
