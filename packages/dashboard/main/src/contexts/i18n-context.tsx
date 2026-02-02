'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Locale = 'zh-TW' | 'en';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'dashboard_locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load saved locale from localStorage
    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale;
    if (savedLocale && (savedLocale === 'zh-TW' || savedLocale === 'en')) {
      setLocaleState(savedLocale);
    }
  }, []);

  useEffect(() => {
    // Load translations based on current locale
    loadTranslations(locale);
  }, [locale]);

  async function loadTranslations(loc: Locale) {
    try {
      const module = await import(`@/locales/${loc}`);
      setTranslations(module.default);
    } catch (error) {
      console.error(`Failed to load translations for ${loc}:`, error);
    }
  }

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
  }

  function t(key: string): string {
    return translations[key] || key;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
