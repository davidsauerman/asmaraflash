
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, Timestamp, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { useAppContext } from '@/providers/AppProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import GlobalLoadingSpinner from '@/components/core/GlobalLoadingSpinner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Deck {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export default function SearchPage() {
  const { firestoreDb, userId, appIdPathSegment, loadingAuth } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredDecks, setFilteredDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loadingAuth || !userId) {
      if (!loadingAuth && !userId) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const decksColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks");
    const q = query(decksColRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDecks: Deck[] = [];
      snapshot.forEach((doc) => {
        fetchedDecks.push({ id: doc.id, ...doc.data() } as Deck);
      });
      setAllDecks(fetchedDecks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching decks for search:", error);
      toast({ title: "Erro ao carregar baralhos", description: error.message, variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestoreDb, userId, appIdPathSegment, loadingAuth, toast]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredDecks(allDecks);
    } else {
      setFilteredDecks(
        allDecks.filter(deck =>
          deck.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, allDecks]);

  const handleDeleteDeck = async (deckId: string, deckName: string) => {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
      const cardsQuerySnapshot = await getDocs(cardsColRef);
      const batch = writeBatch(firestoreDb);
      cardsQuerySnapshot.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
      
      const deckRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId);
      await deleteDoc(deckRef);
      toast({ title: "Sucesso", description: `Baralho "${deckName}" excluído.` });
    } catch (error: any) {
      console.error("Error deleting deck:", error);
      toast({ title: "Erro ao excluir baralho", description: error.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };


  if (loadingAuth || isLoading) {
    return <GlobalLoadingSpinner />;
  }
  
  if (!userId && !loadingAuth) {
     return <div className="text-center py-10">Por favor, aguarde a autenticação ou tente recarregar a página.</div>;
  }


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Pesquisar Baralhos</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Digite o nome do baralho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </CardContent>
      </Card>

      <div id="searchResultsContainer" className="space-y-3">
        {filteredDecks.length === 0 && !isLoading ? (
          <p className="text-muted-foreground text-center py-4">
            {searchTerm ? "Nenhum baralho encontrado para sua busca." : "Nenhum baralho para exibir."}
          </p>
        ) : (
          filteredDecks.map((deck) => (
            <div key={deck.id} className="p-4 bg-card border rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <span className="text-lg font-medium text-card-foreground">{deck.name}</span>
              <div className="flex space-x-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => router.push(`/decks/${deck.id}`)} disabled={isSubmitting}>Gerenciar</Button>
                <Button variant="default" size="sm" onClick={() => router.push(`/decks/${deck.id}/study`)} disabled={isSubmitting}>Estudar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isSubmitting}>Excluir</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o baralho "{deck.name}" e todos os seus cartões? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteDeck(deck.id, deck.name)} disabled={isSubmitting}>
                        {isSubmitting ? 'Excluindo...' : 'Excluir'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
