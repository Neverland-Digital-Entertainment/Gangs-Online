'use client';

import Link from 'next/link';
import { FileText, MapPin, Palette, Plus, ArrowRight } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';

export default function NpcManagementPage() {
  const { t } = useI18n();

  return (
    <div className="container-fixed">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          {t('npc.title')}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {t('npc.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* NPC Templates */}
        <Link href="/npc/templates" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {t('npc.templates')}
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                {t('npc.templates.subtitle')}
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>{t('npc.templates')}</span>
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
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MapPin className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {t('npc.instances')}
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                {t('npc.instances.subtitle')}
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>{t('npc.instances')}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* NPC Appearances */}
        <Link href="/npc/appearances" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Palette className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {t('npc.appearances')}
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                {t('npc.appearances.subtitle')}
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>{t('npc.appearances')}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('home.quickActions')}</h2>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <Link href="/npc/templates/new">
              <button className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                {t('npc.templates.create')}
              </button>
            </Link>
            <Link href="/npc/instances/new">
              <button className="btn btn-outline">
                <Plus className="w-4 h-4 mr-2" />
                {t('npc.instances.create')}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
