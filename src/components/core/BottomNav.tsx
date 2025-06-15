
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Search, BarChartBig } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/decks', label: 'Baralhos', icon: Layers },
  { href: '/search', label: 'Pesquisar', icon: Search },
  { href: '/stats', label: 'Estatísticas', icon: BarChartBig },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav id="bottomNav" className="fixed inset-x-0 bottom-0 bg-card border-t p-1 flex justify-around items-center z-40">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href === '/decks' && pathname.startsWith('/decks'));
        return (
          <Link href={item.href} key={item.href} legacyBehavior>
            <a
              className={cn(
                'nav-button flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted w-1/3',
                isActive && 'active-nav-button'
              )}
            >
              <item.icon className="h-6 w-6 mb-1" />
              <span className="text-xs">{item.label}</span>
            </a>
          </Link>
        );
      })}
    </nav>
  );
}
