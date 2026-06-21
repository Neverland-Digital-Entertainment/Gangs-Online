'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package,
  Users,
  ScrollText,
  Settings,
  Home,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Store,
  ShoppingBag,
  FileText,
  UserCheck,
  Palette,
  Map as MapIcon,
  Building2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useI18n } from '@/contexts/i18n-context';

type MenuItem = {
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  exact?: boolean;
  disabled?: boolean;
  subItems?: {
    titleKey: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
    exact?: boolean;
  }[];
};

const menuItems: MenuItem[] = [
  {
    titleKey: 'nav.dashboard',
    icon: Home,
    href: '/',
    exact: true,
  },
  {
    titleKey: 'nav.shopAndItem',
    icon: ShoppingBag,
    href: '/shop-item',
    subItems: [
      {
        titleKey: 'nav.item',
        href: '/item',
        icon: Package,
      },
      {
        titleKey: 'nav.shop',
        href: '/shop',
        icon: Store,
      },
    ],
  },
  {
    titleKey: 'nav.npc',
    icon: Users,
    href: '/npc',
    subItems: [
      {
        titleKey: 'nav.npcTemplates',
        href: '/npc/templates',
        icon: FileText,
      },
      {
        titleKey: 'nav.npcInstances',
        href: '/npc/instances',
        icon: UserCheck,
      },
      {
        titleKey: 'nav.npcAppearances',
        href: '/npc/appearances',
        icon: Palette,
        disabled: true,
      },
    ],
  },
  {
    titleKey: 'nav.quest',
    icon: ScrollText,
    href: '/quest',
  },
  {
    titleKey: 'nav.map',
    icon: MapIcon,
    href: '/map',
    subItems: [
      {
        titleKey: 'nav.mapEditor',
        href: '/map',
        icon: MapIcon,
        exact: true,
      },
      {
        titleKey: 'nav.mapAssets',
        href: '/map/assets',
        icon: Building2,
      },
    ],
  },
  {
    titleKey: 'nav.settings',
    icon: Settings,
    href: '/settings',
    disabled: true,
  },
];

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Auto-expand menus based on current path
  useEffect(() => {
    // Expand Shop & Item menu if on item or shop pages
    if (pathname.startsWith('/item') || pathname.startsWith('/shop')) {
      setExpandedItems((prev) => prev.includes('/shop-item') ? prev : [...prev, '/shop-item']);
    }
    // Expand NPC menu if on NPC pages
    if (pathname.startsWith('/npc')) {
      setExpandedItems((prev) => prev.includes('/npc') ? prev : [...prev, '/npc']);
    }
    // Expand Map menu if on map pages
    if (pathname.startsWith('/map')) {
      setExpandedItems((prev) => prev.includes('/map') ? prev : [...prev, '/map']);
    }
  }, [pathname]);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  return (
    <>
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/images/logo-small.png"
            alt="Gangs Online"
            className="w-auto h-auto max-w-full"
          />
          <span className="text-xs text-[var(--muted)]">
            DASHBOARD
          </span>
        </div>
      </div>

      <nav className="py-4 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          const isExpanded = expandedItems.includes(item.href);
          const hasSubItems = item.subItems && item.subItems.length > 0;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="sidebar-item opacity-50 cursor-not-allowed"
              >
                <Icon className="w-5 h-5" />
                <span>{t(item.titleKey)}</span>
                <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                  {t('nav.comingSoon')}
                </span>
              </div>
            );
          }

          if (hasSubItems) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleExpand(item.href)}
                  className={`sidebar-item w-full ${active ? 'active' : ''}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{t(item.titleKey)}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>
                {isExpanded && item.subItems && (
                  <div className="ml-6 border-l border-[var(--border)]">
                    {item.subItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      if (subItem.disabled) {
                        return (
                          <div
                            key={subItem.href}
                            className="sidebar-item pl-6 opacity-50 cursor-not-allowed"
                          >
                            {SubIcon && <SubIcon className="w-4 h-4" />}
                            <span className="text-sm">{t(subItem.titleKey)}</span>
                            <span className="ml-auto text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                              {t('nav.comingSoon')}
                            </span>
                          </div>
                        );
                      }
                      const subActive = isActive(subItem.href, subItem.exact);
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={onItemClick}
                          className={`sidebar-item pl-6 ${subActive ? 'active' : ''}`}
                        >
                          {SubIcon && <SubIcon className="w-4 h-4" />}
                          <span className="text-sm">{t(subItem.titleKey)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span>{t(item.titleKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border)] bg-[var(--sidebar-bg)]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="text-xs text-[var(--muted)] text-center">
          v0.20.0
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--card)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-[var(--sidebar-hover)] rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="/images/logo-small.png"
            alt="Gangs Online"
            className="h-8 w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-[var(--sidebar-bg)] z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1 hover:bg-[var(--sidebar-hover)] rounded"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent onItemClick={() => setIsOpen(false)} />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="sidebar hidden lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Content Spacer */}
      <div className="lg:hidden h-14" />
    </>
  );
}
