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

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/images/logo-small.png"
            alt="Gangs Online"
            className="w-auto h-auto max-w-full"
          />
          <span className="text-xs text-gray-500">
            DASHBOARD
          </span>
        </div>
      </div>

      <nav className="py-4 flex-1">
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
              onClick={onItemClick}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="text-xs text-gray-500 text-center">
          v0.16.1
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img
          src="/images/logo-small.png"
          alt="Gangs Online"
          className="h-8 w-auto"
        />
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
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-white z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
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
