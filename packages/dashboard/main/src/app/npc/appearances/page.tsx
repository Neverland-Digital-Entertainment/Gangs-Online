'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { User, Palette } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';

// Dynamic import to avoid SSR issues with Babylon.js
const CharacterViewer = dynamic(
  () => import('@/components/npc/CharacterViewer'),
  { ssr: false }
);

type Gender = 'male' | 'female';

export default function NpcAppearancesPage() {
  const { t } = useI18n();
  const [gender, setGender] = useState<Gender>('male');

  return (
    <div className="container-fixed">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          {t('npc.appearances.title')}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {t('npc.appearances.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - 3D Viewer */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-body p-0 overflow-hidden rounded-lg" style={{ height: '600px' }}>
              <CharacterViewer gender={gender} />
            </div>
          </div>
        </div>

        {/* Right Panel - Controls */}
        <div className="space-y-4">
          {/* Gender Selection */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('npc.appearances.gender')}
              </h3>
            </div>
            <div className="card-body">
              <div className="flex gap-2">
                <button
                  onClick={() => setGender('male')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    gender === 'male'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {t('npc.appearances.male')}
                </button>
                <button
                  onClick={() => setGender('female')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    gender === 'female'
                      ? 'bg-pink-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {t('npc.appearances.female')}
                </button>
              </div>
            </div>
          </div>

          {/* Hair Selection - Placeholder for Phase 2 */}
          <div className="card opacity-50">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Palette className="w-4 h-4" />
                {t('npc.appearances.hair')}
              </h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                Phase 2
              </span>
            </div>
            <div className="card-body">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t('nav.comingSoon')}
              </p>
            </div>
          </div>

          {/* Top Selection - Placeholder for Phase 2 */}
          <div className="card opacity-50">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Palette className="w-4 h-4" />
                {t('npc.appearances.top')}
              </h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                Phase 2
              </span>
            </div>
            <div className="card-body">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t('nav.comingSoon')}
              </p>
            </div>
          </div>

          {/* Bottom Selection - Placeholder for Phase 2 */}
          <div className="card opacity-50">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Palette className="w-4 h-4" />
                {t('npc.appearances.bottom')}
              </h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                Phase 2
              </span>
            </div>
            <div className="card-body">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t('nav.comingSoon')}
              </p>
            </div>
          </div>

          {/* Shoes Selection - Placeholder for Phase 2 */}
          <div className="card opacity-50">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Palette className="w-4 h-4" />
                {t('npc.appearances.shoes')}
              </h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                Phase 2
              </span>
            </div>
            <div className="card-body">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t('nav.comingSoon')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
