'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  ScrollText,
  Settings,
  Home
} from 'lucide-react';

const menuItems = [
  {
    title: '主頁',
    icon: Home,
    href: '/',
    exact: true,
  },
  {
    title: '道具管理',
    icon: Package,
    href: '/item',
  },
  {
    title: 'NPC 管理',
    icon: Users,
    href: '/npc',
    disabled: true,
  },
  {
    title: '任務管理',
    icon: ScrollText,
    href: '/quest',
    disabled: true,
  },
  {
    title: '設定',
    icon: Settings,
    href: '/settings',
    disabled: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar">
      <div className="p-6 border-b border-gray-200 flex justify-center">
        <img
          src="/images/logo-small.png"
          alt="Gangs Online"
          className="w-12 h-12"
        />
      </div>

      <nav className="py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="sidebar-item opacity-50 cursor-not-allowed"
              >
                <Icon className="w-5 h-5" />
                <span>{item.title}</span>
                <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                  即將推出
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="text-xs text-gray-500 text-center">
          v0.16.1
        </div>
      </div>
    </aside>
  );
}
