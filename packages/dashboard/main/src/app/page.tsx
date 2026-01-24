'use client';

import Link from 'next/link';
import { Package, Users, ScrollText, ArrowRight } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';

export default function DashboardHome() {
  const { t } = useI18n();

  return (
    <div className="container-fixed">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          {t('home.title')}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {t('home.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Item Management */}
        <Link href="/item" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary-light rounded-lg">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {t('home.itemManagement')}
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                {t('home.itemManagement.desc')}
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>{t('nav.item')}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* NPC Management */}
        <Link href="/npc" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary-light rounded-lg">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {t('home.npcManagement')}
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                {t('home.npcManagement.desc')}
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>{t('nav.npc')}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* Quest Management - Coming Soon */}
        <div className="group cursor-not-allowed">
          <div className="card opacity-60 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <ScrollText className="w-8 h-8 text-gray-400" />
                </div>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded">
                  {t('nav.comingSoon')}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {t('nav.comingSoon')}
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                {t('nav.comingSoon')}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                <span>{t('nav.comingSoon')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
