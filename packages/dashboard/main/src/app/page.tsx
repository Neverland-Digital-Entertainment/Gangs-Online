'use client';

import Link from 'next/link';
import { Package, Users, Store, ArrowRight, FileText, UserCheck, ScrollText } from 'lucide-react';
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

      {/* Shop & Item Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          {t('nav.shopAndItem')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {t('nav.item')}
                </h3>
                <p className="text-[var(--muted-foreground)] text-sm mb-4">
                  {t('home.itemManagement.desc')}
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <span>{t('common.manage')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>

          {/* Shop Management */}
          <Link href="/shop" className="group">
            <div className="card hover:shadow-lg transition-all duration-200 h-full">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-light rounded-lg">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  {t('nav.shop')}
                </h3>
                <p className="text-[var(--muted-foreground)] text-sm mb-4">
                  {t('home.shopManagement.desc')}
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <span>{t('common.manage')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* NPC Management Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          {t('nav.npc')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NPC Templates */}
          <Link href="/npc/templates" className="group">
            <div className="card hover:shadow-lg transition-all duration-200 h-full">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-light rounded-lg">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  {t('nav.npcTemplates')}
                </h3>
                <p className="text-[var(--muted-foreground)] text-sm mb-4">
                  {t('home.npcTemplates.desc')}
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <span>{t('common.manage')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>

          {/* NPC Instances */}
          <Link href="/npc/instances" className="group">
            <div className="card hover:shadow-lg transition-all duration-200 h-full">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-light rounded-lg">
                    <UserCheck className="w-8 h-8 text-primary" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  {t('nav.npcInstances')}
                </h3>
                <p className="text-[var(--muted-foreground)] text-sm mb-4">
                  {t('home.npcInstances.desc')}
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <span>{t('common.manage')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quest Management Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          {t('home.questManagement')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/quest" className="group">
            <div className="card hover:shadow-lg transition-all duration-200 h-full">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-light rounded-lg">
                    <ScrollText className="w-8 h-8 text-primary" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  {t('nav.quest')}
                </h3>
                <p className="text-[var(--muted-foreground)] text-sm mb-4">
                  {t('home.questManagement.desc')}
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <span>{t('common.manage')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
