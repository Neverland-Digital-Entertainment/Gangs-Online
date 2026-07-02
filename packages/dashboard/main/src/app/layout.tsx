import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { I18nProvider } from '@/contexts/i18n-context';
import { AuthProvider } from '@/contexts/auth-context';
import { AuthGate } from '@/components/auth/AuthGate';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'Gangs Online - 管理後台',
  description: 'Gangs Online 遊戲管理後台系統',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <AuthGate>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
                    {children}
                  </main>
                </div>
              </AuthGate>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
