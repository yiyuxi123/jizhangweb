import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import zhCN from './locales/zh-CN';
import en from './locales/en';

type Locale = 'zh-CN' | 'en';

const messages: Record<Locale, typeof zhCN> = { 'zh-CN': zhCN, en };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh-CN',
  setLocale: () => {},
  t: (key: string) => key,
});

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem('app-locale');
      if (stored === 'en') return 'en';
    } catch {}
    return 'zh-CN';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem('app-locale', newLocale); } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const msg = messages[locale];
      let value = getNestedValue(msg, key);
      if (value === undefined) {
        // Fallback to zh-CN
        value = getNestedValue(zhCN, key);
      }
      if (value === undefined) return key;

      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{${k}}`, String(v)),
          value
        );
      }
      return value;
    },
    [locale]
  );

  const ctx = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
