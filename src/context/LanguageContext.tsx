import React, { useState, useEffect } from 'react';
import { type Language, translations } from '../services/i18n';
import { LanguageContext } from './useTranslation';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('inka_language');
      if (saved === 'en' || saved === 'id') return saved;
    } catch {
      
    }
    return 'id'; 
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('inka_language', lang);
    } catch {
      
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};
