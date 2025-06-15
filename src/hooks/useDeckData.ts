
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAppContext } from '@/providers/AppProvider';
import type { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  LEARNING_STEPS_MINUTES, RELEARNING_STEPS_MINUTES, 
  GRADUATING_INTERVAL_DAYS, EASY_INTERVAL_DAYS 
} from '@/lib/constants';

export interface DeckData {
  id: string;
  name: string;
  createdAt: Timestamp;
  learningStepsMinutes: number[];
  relearningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  // other fields as necessary
}

export function useDeckData(deckId: string | null) {
  const { firestoreDb, userId, appIdPathSegment, loadingAuth } = useAppContext();
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDeckData = useCallback(async () => {
    if (loadingAuth || !userId || !deckId) {
      if (!loadingAuth && !userId) setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const deckRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId);
      const docSnap = await getDoc(deckRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDeckData({
          id: docSnap.id,
          name: data.name,
          createdAt: data.createdAt,
          learningStepsMinutes: data.learningStepsMinutes || LEARNING_STEPS_MINUTES,
          relearningStepsMinutes: data.relearningStepsMinutes || RELEARNING_STEPS_MINUTES,
          graduatingIntervalDays: data.graduatingIntervalDays || GRADUATING_INTERVAL_DAYS,
          easyIntervalDays: data.easyIntervalDays || EASY_INTERVAL_DAYS,
        });
      } else {
        toast({ title: "Erro", description: "Baralho não encontrado.", variant: "destructive" });
        setDeckData(null);
      }
    } catch (error: any) {
      console.error("Error fetching deck data:", error);
      toast({ title: "Erro ao carregar dados do baralho", description: error.message, variant: "destructive" });
      setDeckData(null);
    }
    setIsLoading(false);
  }, [firestoreDb, userId, deckId, appIdPathSegment, loadingAuth, toast]);
  
  useEffect(() => {
    if (deckId && userId) {
      fetchDeckData(); // Initial fetch

      // Optional: Set up a listener for real-time updates if needed
      const deckRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId);
      const unsubscribe = onSnapshot(deckRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDeckData({
            id: docSnap.id,
            name: data.name,
            createdAt: data.createdAt,
            learningStepsMinutes: data.learningStepsMinutes || LEARNING_STEPS_MINUTES,
            relearningStepsMinutes: data.relearningStepsMinutes || RELEARNING_STEPS_MINUTES,
            graduatingIntervalDays: data.graduatingIntervalDays || GRADUATING_INTERVAL_DAYS,
            easyIntervalDays: data.easyIntervalDays || EASY_INTERVAL_DAYS,
          });
        } else {
          // Deck might have been deleted
          setDeckData(null);
        }
        setIsLoading(false); 
      }, (error) => {
        console.error("Error in deck data snapshot listener:", error);
        toast({ title: "Erro de Sincronização", description: "Não foi possível sincronizar dados do baralho.", variant: "destructive" });
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else {
      setDeckData(null);
      setIsLoading(!loadingAuth);
    }
  }, [deckId, userId, firestoreDb, appIdPathSegment, loadingAuth, toast, fetchDeckData]);

  return { deckData, isLoading, refetchDeckData: fetchDeckData };
}
