'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { User, ChevronDown, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { EquipmentState, EquipmentSlot } from '@/components/npc/CharacterViewer';
import { generateAllThumbnails, type ThumbnailMap } from '@/lib/character-thumbnails';

const CharacterViewer = dynamic(
  () => import('@/components/npc/CharacterViewer'),
  { ssr: false }
);

type Gender = 'male' | 'female';

interface EquipmentOption {
  id: string | null;
  labelKey: string;
  thumbnailKey?: string;
}

const MALE_HAIR_OPTIONS: EquipmentOption[] = [
  { id: null, labelKey: 'npc.appearances.none' },
  { id: 'short', labelKey: 'npc.appearances.hair.short', thumbnailKey: 'hair/male/short' },
  { id: 'buzzed', labelKey: 'npc.appearances.hair.buzzed', thumbnailKey: 'hair/male/buzzed' },
];

const FEMALE_HAIR_OPTIONS: EquipmentOption[] = [
  { id: null, labelKey: 'npc.appearances.none' },
  { id: 'buzzed-female', labelKey: 'npc.appearances.hair.buzzedFemale', thumbnailKey: 'hair/female/buzzed-female' },
  { id: 'long', labelKey: 'npc.appearances.hair.long', thumbnailKey: 'hair/female/long' },
  { id: 'bun', labelKey: 'npc.appearances.hair.bun', thumbnailKey: 'hair/female/bun' },
];

const SHARED_CATALOG: Record<Exclude<EquipmentSlot, 'hair'>, EquipmentOption[]> = {
  beard: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'beard', labelKey: 'npc.appearances.beard.beard', thumbnailKey: 'beard/beard' },
  ],
  head: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'cap', labelKey: 'npc.appearances.head.cap', thumbnailKey: 'head/cap' },
  ],
  top: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'shirt01', labelKey: 'npc.appearances.top.shirt01', thumbnailKey: 'top/shirt01' },
  ],
  bottom: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'pants01', labelKey: 'npc.appearances.bottom.pants01', thumbnailKey: 'bottom/pants01' },
  ],
  shoe: [
    { id: null, labelKey: 'npc.appearances.none' },
    { id: 'shoe01', labelKey: 'npc.appearances.shoe.shoe01', thumbnailKey: 'shoe/shoe01' },
  ],
};

function getCatalog(gender: Gender): Record<EquipmentSlot, EquipmentOption[]> {
  return {
    hair: gender === 'male' ? MALE_HAIR_OPTIONS : FEMALE_HAIR_OPTIONS,
    ...SHARED_CATALOG,
  };
}

/** Build the list of thumbnail items for the given gender */
function getThumbnailItems(gender: Gender) {
  const catalog = getCatalog(gender);
  const items: { folder: string; file: string }[] = [];
  for (const options of Object.values(catalog)) {
    for (const opt of options) {
      if (opt.thumbnailKey) {
        const parts = opt.thumbnailKey.split('/');
        const file = parts.pop()!;
        const folder = parts.join('/');
        items.push({ folder, file });
      }
    }
  }
  return items;
}

const SLOT_ORDER: { slot: EquipmentSlot; titleKey: string }[] = [
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
    hair: null, beard: null, head: null, top: null, bottom: null, shoe: null,
  });
  const [expandedSlot, setExpandedSlot] = useState<EquipmentSlot | null>('hair');
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({});

  const catalog = useMemo(() => getCatalog(gender), [gender]);

  // Generate thumbnails when gender changes (hair thumbnails differ per gender)
  useEffect(() => {
    let cancelled = false;
    const items = getThumbnailItems(gender);
    generateAllThumbnails(items, (key, dataUrl) => {
      if (!cancelled) {
        setThumbnails((prev) => ({ ...prev, [key]: dataUrl }));
      }
    });
    return () => { cancelled = true; };
  }, [gender]);

  const handleGenderChange = useCallback((newGender: Gender) => {
    setGender(newGender);
    // Clear hair when switching gender since hair options differ
    setEquipment((prev) => ({ ...prev, hair: null }));
  }, []);

  const handleSlotChange = useCallback((slot: EquipmentSlot, itemId: string | null) => {
    setEquipment((prev) => ({ ...prev, [slot]: itemId }));
  }, []);

  const toggleSlot = useCallback((slot: EquipmentSlot) => {
    setExpandedSlot((prev) => (prev === slot ? null : slot));
  }, []);

  const getSelectedLabel = (slot: EquipmentSlot): string | null => {
    const current = equipment[slot];
    if (!current) return null;
    const opt = catalog[slot].find((o) => o.id === current);
    return opt ? t(opt.labelKey) : null;
  };

  return (
    <div className="container-fixed">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          {t('npc.appearances.title')}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {t('npc.appearances.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Viewer */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-body p-0 overflow-hidden rounded-lg" style={{ height: '600px' }}>
              <CharacterViewer gender={gender} equipment={equipment} />
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex flex-col gap-0 max-h-[600px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {/* Gender */}
          <div className="p-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-[var(--muted-foreground)]" />
              <span className="text-sm font-medium">{t('npc.appearances.gender')}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenderChange('male')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  gender === 'male'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {t('npc.appearances.male')}
              </button>
              <button
                onClick={() => handleGenderChange('female')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  gender === 'female'
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {t('npc.appearances.female')}
              </button>
            </div>
          </div>

          {/* Accordion Equipment Slots */}
          {SLOT_ORDER.map(({ slot, titleKey }) => {
            const isExpanded = expandedSlot === slot;
            const options = catalog[slot];
            const current = equipment[slot];
            const selectedLabel = getSelectedLabel(slot);

            return (
              <div key={slot} className="border-b border-[var(--border)] last:border-b-0">
                {/* Header */}
                <button
                  onClick={() => toggleSlot(slot)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--sidebar-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t(titleKey)}</span>
                    {selectedLabel && (
                      <span className="text-xs text-[var(--muted-foreground)] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {selectedLabel}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform duration-200 ${
                      isExpanded ? '' : '-rotate-90'
                    }`}
                  />
                </button>

                {/* Content - Thumbnail Grid */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <div className="grid grid-cols-6 gap-1.5">
                      {options.map((opt) => {
                        const isSelected = current === opt.id;
                        const thumbSrc = opt.thumbnailKey ? thumbnails[opt.thumbnailKey] : null;
                        const isNone = opt.id === null;

                        return (
                          <button
                            key={opt.id ?? '__none__'}
                            onClick={() => handleSlotChange(slot, opt.id)}
                            className={`flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${
                              isSelected
                                ? 'ring-2 ring-primary bg-primary/10'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div
                              className={`w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center ${
                                isNone ? 'bg-gray-100 dark:bg-gray-800' : 'bg-[#38383f]'
                              }`}
                            >
                              {isNone ? (
                                <X className="w-5 h-5 text-gray-400" />
                              ) : thumbSrc ? (
                                <img
                                  src={thumbSrc}
                                  alt={t(opt.labelKey)}
                                  className="w-full h-full object-cover"
                                  draggable={false}
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--muted-foreground)] leading-tight truncate w-full text-center">
                              {t(opt.labelKey)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
