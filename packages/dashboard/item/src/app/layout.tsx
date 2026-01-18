import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gangs Online - Item Management',
  description: 'Item management dashboard for Gangs Online',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
