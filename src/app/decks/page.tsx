
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, onSnapshot, query, Timestamp, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
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
  // Add other deck properties from your SRS constants or defaults if needed
  learningStepsMinutes?: number[];
  relearningStepsMinutes?: number[];
  graduatingIntervalDays?: number;
  easyIntervalDays?: number;
}

export default function DeckManagementPage() {
  const { firestoreDb, userId, appIdPathSegment, loadingAuth } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const [newDeckName, setNewDeckName] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loadingAuth || !userId) {
      if (!loadingAuth && !userId) setIsLoading(false); // Not loading auth and no user, stop loading
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
      setDecks(fetchedDecks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching decks:", error);
      toast({ title: "Erro ao carregar baralhos", description: error.message, variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestoreDb, userId, appIdPathSegment, loadingAuth, toast]);

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      toast({ title: "Nome inválido", description: "O nome do baralho não pode estar vazio.", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({ title: "Não autenticado", description: "Usuário não autenticado. Não é possível criar baralho.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const deckRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks");
      await addDoc(deckRef, {
        name: newDeckName,
        createdAt: Timestamp.now(),
        // Default SRS settings from constants could be added here
      });
      toast({ title: "Sucesso", description: "Baralho criado com sucesso!" });
      setNewDeckName('');
    } catch (error: any) {
      console.error("Error creating deck:", error);
      toast({ title: "Erro ao criar baralho", description: error.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

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

  if (!userId) {
     return <div className="text-center py-10">Por favor, aguarde a autenticação ou tente recarregar a página.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Criar Novo Baralho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <Input
              type="text"
              id="newDeckName"
              placeholder="Nome do Baralho"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              className="flex-grow"
              disabled={isSubmitting}
            />
            <Button onClick={handleCreateDeck} disabled={isSubmitting || !newDeckName.trim()}>
              {isSubmitting ? 'Criando...' : 'Criar Baralho'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Meus Baralhos</CardTitle>
        </CardHeader>
        <CardContent>
          {decks.length === 0 ? (
            <p className="text-muted-foreground">Nenhum baralho encontrado. Crie um novo!</p>
          ) : (
            <div id="deckList" className="space-y-3">
              {decks.map((deck) => (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
