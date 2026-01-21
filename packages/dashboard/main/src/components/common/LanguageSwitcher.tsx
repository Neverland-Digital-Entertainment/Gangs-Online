'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const handleToggle = () => {
    setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW');
  };

  return (
    <button
      onClick={handleToggle}
      className="btn btn-sm btn-light flex items-center gap-2"
      title={locale === 'zh-TW' ? 'Switch to English' : '切換至繁體中文'}
    >
      <Languages className="w-4 h-4" />
      <span className="font-medium">
        {locale === 'zh-TW' ? '繁' : 'EN'}
      </span>
    </button>
  );
}
