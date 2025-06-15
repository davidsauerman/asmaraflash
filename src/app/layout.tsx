
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/providers/AppProvider';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/core/Header';
import BottomNav from '@/components/core/BottomNav';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Asmara Flash',
  description: 'Your personal flashcard companion for effective learning.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
       {/* Google Fonts link for Inter is handled by next/font */}
      </head>
      <body className={cn('font-body antialiased min-h-screen flex flex-col', inter.variable)}>
        <AppProvider>
          <Header />
          <main id="mainContentContainer" className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <BottomNav />
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}
