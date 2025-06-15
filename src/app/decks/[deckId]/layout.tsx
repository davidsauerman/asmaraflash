
"use client";

import React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useDeckData } from '@/hooks/useDeckData';
import GlobalLoadingSpinner from '@/components/core/GlobalLoadingSpinner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const deckId = typeof params.deckId === 'string' ? params.deckId : null;
  const { deckData, isLoading } = useDeckData(deckId);
  const pathname = usePathname();
  
  const getPageTitle = () => {
    if (!deckData) return "Carregando Baralho...";
    if (pathname.endsWith('/study')) return `Estudando: ${deckData.name}`;
    if (pathname.endsWith('/browse')) return `Cartões em: ${deckData.name}`;
    return `Gerenciar Baralho: ${deckData.name}`;
  };

  if (isLoading) {
    return <GlobalLoadingSpinner />;
  }

  if (!deckData && !isLoading) {
    return (
      <div className="text-center py-10">
        <p className="text-xl text-destructive mb-4">Baralho não encontrado ou acesso negado.</p>
        <Button asChild variant="outline">
          <Link href="/decks">Voltar aos Baralhos</Link>
        </Button>
      </div>
    );
  }
  
  const isCardManagementPage = pathname === `/decks/${deckId}`;


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-2 sm:space-y-0">
        <h2 id="currentDeckNameHeader" className="text-2xl md:text-3xl font-semibold text-foreground break-all">
          {getPageTitle()}
        </h2>
        {/* Show "Back to Decks" only on the main deck management page */}
        {isCardManagementPage && (
          <Button asChild variant="outline" size="sm">
            <Link href="/decks"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos Baralhos</Link>
          </Button>
        )}
         {/* Show "Back to Deck Management" for study and browse pages */}
        {(pathname.endsWith('/study') || pathname.endsWith('/browse')) && deckId && (
           <Button asChild variant="outline" size="sm">
            <Link href={`/decks/${deckId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Gerenciar Baralho</Link>
          </Button>
        )}
      </div>
      {/* Pass deckData to children if needed, or they can use useDeckData themselves if simpler */}
      {/* For now, children will fetch their own specific data or use useDeckData */}
      {children}
    </div>
  );
}
