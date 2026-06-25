'use client';

import Link from 'next/link';
import {
  Package,
  Users,
  Store,
  ArrowRight,
  FileText,
  UserCheck,
  ScrollText,
  Map as MapIcon,
  Building2,
  UserCog,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useAuth } from '@/contexts/auth-context';

type Card = {
  permission: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
};

type Section = {
  titleKey: string;
  cards: Card[];
};

const SECTIONS: Section[] = [
  {
    titleKey: 'nav.shopAndItem',
    cards: [
      { permission: 'item.view', href: '/item', icon: Package, titleKey: 'nav.item', descKey: 'home.itemManagement.desc' },
      { permission: 'shop.view', href: '/shop', icon: Store, titleKey: 'nav.shop', descKey: 'home.shopManagement.desc' },
    ],
  },
  {
    titleKey: 'nav.npc',
    cards: [
      { permission: 'npc.view', href: '/npc/templates', icon: FileText, titleKey: 'nav.npcTemplates', descKey: 'home.npcTemplates.desc' },
      { permission: 'npc.view', href: '/npc/instances', icon: UserCheck, titleKey: 'nav.npcInstances', descKey: 'home.npcInstances.desc' },
    ],
  },
  {
    titleKey: 'nav.quest',
    cards: [
      { permission: 'quest.view', href: '/quest', icon: ScrollText, titleKey: 'nav.quest', descKey: 'home.questManagement.desc' },
    ],
  },
  {
    titleKey: 'nav.map',
    cards: [
      { permission: 'map.view', href: '/map', icon: MapIcon, titleKey: 'nav.mapEditor', descKey: 'home.mapEditor.desc' },
      { permission: 'map.view', href: '/map/assets', icon: Building2, titleKey: 'nav.mapAssets', descKey: 'home.mapAssets.desc' },
    ],
  },
  {
    titleKey: 'nav.users',
    cards: [
      { permission: 'users.view', href: '/users', icon: UserCog, titleKey: 'nav.userAccounts', descKey: 'home.userAccounts.desc' },
      { permission: 'users.view', href: '/users/groups', icon: ShieldCheck, titleKey: 'nav.userGroups', descKey: 'home.userGroups.desc' },
    ],
  },
];

export default function DashboardHome() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  const sections = SECTIONS.map((s) => ({
    ...s,
    cards: s.cards.filter((c) => hasPermission(c.permission)),
  })).filter((s) => s.cards.length > 0);

  return (
    <div className="container-fixed">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          {t('home.title')}
        </h1>
        <p className="text-[var(--muted-foreground)]">{t('home.subtitle')}</p>
      </div>

      {sections.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12 text-[var(--muted-foreground)]">
            {t('home.noAccess')}
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.titleKey} className="mb-8">
            <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
              {t(section.titleKey)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.href} href={card.href} className="group">
                    <div className="card hover:shadow-lg transition-all duration-200 h-full">
                      <div className="card-body">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-primary-light rounded-lg">
                            <Icon className="w-8 h-8 text-primary" />
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                          {t(card.titleKey)}
                        </h3>
                        <p className="text-[var(--muted-foreground)] text-sm mb-4">
                          {t(card.descKey)}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-primary font-medium">
                          <span>{t('common.manage')}</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
