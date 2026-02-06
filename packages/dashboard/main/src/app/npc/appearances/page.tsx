'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { User } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { EquipmentState, EquipmentSlot } from '@/components/npc/CharacterViewer';

const CharacterViewer = dynamic(
  () => import('@/components/npc/CharacterViewer'),
  { ssr: false }
);

type Gender = 'male' | 'female';

// Equipment catalog: slot -> array of { id, labelKey }
// id = null means "none", otherwise matches filename without .glb
interface EquipmentOption {
  id: string | null;
  labelKey: string;
}

const EQUIPMENT_CATALOG: Record<EquipmentSlot, EquipmentOption[]> = {
  hair: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'short', labelKey: 'npc.appearances.hair.short' },
    { id: 'buzzed', labelKey: 'npc.appearances.hair.buzzed' },
    { id: 'buzzed-female', labelKey: 'npc.appearances.hair.buzzedFemale' },
    { id: 'long', labelKey: 'npc.appearances.hair.long' },
    { id: 'bun', labelKey: 'npc.appearances.hair.bun' },
  ],
  beard: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'beard', labelKey: 'npc.appearances.beard.beard' },
  ],
  head: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'cap', labelKey: 'npc.appearances.head.cap' },
  ],
  top: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'shirt01', labelKey: 'npc.appearances.top.shirt01' },
  ],
  bottom: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'pants01', labelKey: 'npc.appearances.bottom.pants01' },
  ],
  shoe: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'shoe01', labelKey: 'npc.appearances.shoe.shoe01' },
  ],
};

const SLOT_CONFIG: { slot: EquipmentSlot; titleKey: string }[] = [
  { slot: 'hair', titleKey: 'npc.appearances.hair' },
  { slot: 'beard', titleKey: 'npc.appearances.beard' },
  { slot: 'head', titleKey: 'npc.appearances.head' },
  { slot: 'top', titleKey: 'npc.appearances.top' },
  { slot: 'bottom', titleKey: 'npc.appearances.bottom' },
  { slot: 'shoe', titleKey: 'npc.appearances.shoes' },
];

export default function NpcAppearancesPage() {
  const { t } = useI18n();
  const [gender, setGender] = useState<Gender>('male');
  const [equipment, setEquipment] = useState<EquipmentState>({
    hair: null,
    beard: null,
    head: null,
    top: null,
    bottom: null,
    shoe: null,
  });

  const handleSlotChange = useCallback((slot: EquipmentSlot, itemId: string | null) => {
    setEquipment((prev) => ({ ...prev, [slot]: itemId }));
  }, []);

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
              <CharacterViewer gender={gender} equipment={equipment} />
            </div>
          </div>
        </div>

        {/* Right Panel - Controls */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
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

          {/* Equipment Slots */}
          {SLOT_CONFIG.map(({ slot, titleKey }) => {
            const options = EQUIPMENT_CATALOG[slot];
            const current = equipment[slot];

            return (
              <div key={slot} className="card">
                <div className="card-header py-2">
                  <h3 className="card-title text-sm">{t(titleKey)}</h3>
                </div>
                <div className="card-body pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((opt) => (
                      <button
                        key={opt.id ?? '__none__'}
                        onClick={() => handleSlotChange(slot, opt.id)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          current === opt.id
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
