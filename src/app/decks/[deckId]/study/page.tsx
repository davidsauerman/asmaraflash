
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppContext } from '@/providers/AppProvider';
import { useDeckData, type DeckData } from '@/hooks/useDeckData';
import { collection, query, where, getDocs, Timestamp, doc, setDoc, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import GlobalLoadingSpinner from '@/components/core/GlobalLoadingSpinner';
import { DEFAULT_EASE_FACTOR, MIN_EASE_FACTOR, REINSERT_AFTER_X_CARDS_AGAIN, REINSERT_AFTER_X_CARDS_HARD_LEARNING, LEARNING_STEPS_MINUTES, RELEARNING_STEPS_MINUTES, GRADUATING_INTERVAL_DAYS, EASY_INTERVAL_DAYS, EASY_BONUS, HARD_INTERVAL_MULTIPLIER } from '@/lib/constants'; // Added missing constants

interface StudyCard {
  id: string;
  frontText: string;
  backText: string;
  tags: string[];
  status: 'new' | 'learning' | 'review' | 'relearning';
  interval: number; // in days
  easeFactor: number;
  dueDate: Timestamp;
  currentStep: number;
  lapses: number;
  lastReviewed: Timestamp | null;
}

export default function StudyPage() {
  const params = useParams();
  const deckId = typeof params.deckId === 'string' ? params.deckId : null;
  
  const { firestoreDb, userId, appIdPathSegment, loadingAuth } = useAppContext();
  const { deckData, isLoading: isLoadingDeck } = useDeckData(deckId);
  const { toast } = useToast();

  const [cardsToReview, setCardsToReview] = useState<StudyCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentCard, setCurrentCard] = useState<StudyCard | null>(null);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isProcessingGrade, setIsProcessingGrade] = useState(false);

  const loadCardsForStudy = useCallback(async () => {
    if (!userId || !deckId || !deckData) {
      setIsLoadingCards(false);
      return;
    }
    setIsLoadingCards(true);
    try {
      const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
      const now = Timestamp.now();
      const q = query(cardsColRef, where("dueDate", "<=", now));
      const querySnapshot = await getDocs(q);
      
      const dueCardsFetched: StudyCard[] = [];
      querySnapshot.forEach(docSnap => {
        dueCardsFetched.push({ id: docSnap.id, ...docSnap.data() } as StudyCard);
      });

      dueCardsFetched.sort((a, b) => {
        const statusPriority = { 'new': 0, 'learning': 1, 'relearning': 1, 'review': 2 };
        const priorityA = statusPriority[a.status] ?? 3;
        const priorityB = statusPriority[b.status] ?? 3;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.dueDate.toMillis() - b.dueDate.toMillis();
      });
      
      setCardsToReview(dueCardsFetched);
      setCurrentCardIndex(0);
      if (dueCardsFetched.length > 0) {
        setCurrentCard(dueCardsFetched[0]);
      } else {
        setCurrentCard(null);
      }
    } catch (error: any) {
      console.error("Error loading cards for study:", error);
      toast({ title: "Erro ao carregar cartões", description: error.message, variant: "destructive" });
    }
    setIsLoadingCards(false);
  }, [firestoreDb, userId, deckId, appIdPathSegment, toast, deckData]);

  useEffect(() => {
    if (!loadingAuth && userId && deckId && deckData) {
      loadCardsForStudy();
    } else if (!loadingAuth && (!userId || !deckId || !deckData)) {
      setIsLoadingCards(false); // Stop loading if prerequisites aren't met after auth check
    }
  }, [loadingAuth, userId, deckId, deckData, loadCardsForStudy]);


  const displayNextCard = () => {
    setShowingAnswer(false);
    const nextIndex = currentCardIndex + 1;
    if (nextIndex < cardsToReview.length) {
      setCurrentCardIndex(nextIndex);
      setCurrentCard(cardsToReview[nextIndex]);
    } else {
      setCurrentCard(null); // No more cards
    }
  };

  const gradeCard = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard || !userId || !deckId || !deckData) return;

    setIsProcessingGrade(true);
    let { interval, easeFactor, status, currentStep, lapses } = currentCard;
    let newDueDate: Date;
    const nowMs = Date.now();

    const learningStepsConfig = (deckData.learningStepsMinutes || LEARNING_STEPS_MINUTES).map(m => m * 60 * 1000);
    const relearningStepsConfig = (deckData.relearningStepsMinutes || RELEARNING_STEPS_MINUTES).map(m => m * 60 * 1000);
    const graduatingIntervalConfigMs = (deckData.graduatingIntervalDays || GRADUATING_INTERVAL_DAYS) * 24 * 60 * 60 * 1000;
    const easyIntervalConfigMs = (deckData.easyIntervalDays || EASY_INTERVAL_DAYS) * 24 * 60 * 60 * 1000;
    
    easeFactor = easeFactor || DEFAULT_EASE_FACTOR;
    interval = interval || 0;
    lapses = lapses || 0;
    currentStep = currentStep || 0;
    let reinsertCardInSession = false;
    let reinsertPosition = 0;

    if (status === 'learning' || status === 'relearning') {
      const steps = status === 'learning' ? learningStepsConfig : relearningStepsConfig;
      if (rating === 1) { // Again
        currentStep = 0;
        newDueDate = new Date(nowMs + steps[currentStep]);
        reinsertCardInSession = true;
        reinsertPosition = Math.min(currentCardIndex + REINSERT_AFTER_X_CARDS_AGAIN + 1, cardsToReview.length);
      } else if (rating === 2) { // Hard
        newDueDate = new Date(nowMs + steps[currentStep]); // Stay on current step, show again soon
        reinsertCardInSession = true;
        reinsertPosition = Math.min(currentCardIndex + REINSERT_AFTER_X_CARDS_HARD_LEARNING + 1, cardsToReview.length);
      } else { // Good or Easy
        currentStep++;
        if (currentStep >= steps.length) {
          status = 'review';
          interval = (status !== 'relearning' && rating === 4) ? easyIntervalConfigMs / (24*60*60*1000) : graduatingIntervalConfigMs / (24*60*60*1000);
          newDueDate = new Date(nowMs + interval * 24*60*60*1000);
          currentStep = 0;
        } else {
          newDueDate = new Date(nowMs + steps[currentStep]);
        }
      }
    } else { // Review or New
      if (rating === 1) { // Again
        lapses++;
        easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.20);
        status = 'relearning';
        currentStep = 0;
        newDueDate = new Date(nowMs + relearningStepsConfig[0]);
        interval = 0; // Reset interval for relearning
        reinsertCardInSession = true;
        reinsertPosition = Math.min(currentCardIndex + REINSERT_AFTER_X_CARDS_AGAIN + 1, cardsToReview.length);
      } else { // Hard, Good, Easy
        if (status === 'new' || interval === 0) { // First time graduating
           if (rating === 4) interval = easyIntervalConfigMs / (24*60*60*1000); // Easy
           else interval = graduatingIntervalConfigMs / (24*60*60*1000); // Hard or Good
        } else { // Subsequent reviews
          if (rating === 2) { // Hard
            easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
            interval = Math.max(1, interval * HARD_INTERVAL_MULTIPLIER);
          } else if (rating === 3) { // Good
             interval = Math.max(1, interval * easeFactor);
          } else { // Easy (rating === 4)
            easeFactor = easeFactor + 0.15;
            interval = Math.max(1, interval * easeFactor * EASY_BONUS);
          }
        }
        status = 'review';
        newDueDate = new Date(nowMs + interval * 24*60*60*1000);
      }
    }

    const updatedCardData = {
      ...currentCard,
      interval: parseFloat(interval.toFixed(2)),
      easeFactor: parseFloat(easeFactor.toFixed(2)),
      status,
      currentStep,
      lapses,
      dueDate: Timestamp.fromDate(newDueDate),
      lastReviewed: Timestamp.now(),
    };
    // Firestore does not like 'id' field when setting doc
    const { id: cardId, ...dataToSave } = updatedCardData;

    try {
      const cardRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards", cardId);
      await setDoc(cardRef, dataToSave);

      const reviewLogRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "reviewLog");
      await addDoc(reviewLogRef, {
          cardId: cardId,
          deckId: deckId,
          rating: rating,
          reviewedAt: Timestamp.now() 
      });
      
      if (reinsertCardInSession) {
        const cardToReinsert = { ...updatedCardData }; 
        const newCardsToReview = [...cardsToReview];
        newCardsToReview.splice(reinsertPosition, 0, cardToReinsert);
        setCardsToReview(newCardsToReview);
      }

      displayNextCard();
    } catch (error: any) {
      console.error("Error grading card:", error);
      toast({ title: "Erro ao avaliar cartão", description: error.message, variant: "destructive" });
    }
    setIsProcessingGrade(false);
  };

  const renderCardContent = (htmlContent: string) => {
    if (!htmlContent) return <p className="text-muted-foreground italic">(Esta parte do cartão está vazia)</p>;
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} className="prose dark:prose-invert max-w-none" />;
  };

  if (loadingAuth || isLoadingDeck || isLoadingCards) {
    return <GlobalLoadingSpinner />;
  }
  if (!deckData) {
    return <div className="text-center py-10">Baralho não encontrado ou não pôde ser carregado.</div>;
  }


  return (
    <div className="space-y-6">
      {currentCard ? (
        <>
          <Card className="flashcard">
            <CardContent className="p-6 text-center w-full">
              <div id="cardFront" className="mb-4">
                {renderCardContent(currentCard.frontText)}
              </div>
              {showingAnswer && (
                <div id="cardBack" className="mt-4 pt-4 border-t">
                  {renderCardContent(currentCard.backText)}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="text-center">
            {!showingAnswer ? (
              <Button onClick={() => setShowingAnswer(true)} className="w-full sm:w-auto" size="lg" disabled={isProcessingGrade}>
                Mostrar Resposta
              </Button>
            ) : (
              <div id="ratingButtons" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <Button onClick={() => gradeCard(1)} variant="destructive" disabled={isProcessingGrade}>Errei</Button>
                <Button onClick={() => gradeCard(2)} style={{backgroundColor: 'hsl(var(--custom-orange))', color: 'hsl(var(--custom-orange-foreground))'}} className="bg-orange-500 hover:bg-orange-600 text-white" disabled={isProcessingGrade}>Difícil</Button>
                <Button onClick={() => gradeCard(3)} style={{backgroundColor: 'hsl(var(--custom-yellow))', color: 'hsl(var(--custom-yellow-foreground))'}} className="bg-yellow-400 hover:bg-yellow-500 text-gray-800" disabled={isProcessingGrade}>Bom</Button>
                <Button onClick={() => gradeCard(4)} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isProcessingGrade}>Fácil</Button>
              </div>
            )}
          </div>
           <p className="text-center text-sm text-muted-foreground">
            Cartões restantes na sessão: {Math.max(0, cardsToReview.length - currentCardIndex)}
          </p>
        </>
      ) : (
        <div className="text-center py-10">
          <h3 className="text-2xl font-semibold text-foreground mb-4">
            🎉 Parabéns! 🎉
          </h3>
          <p className="text-muted-foreground">
            Você revisou todos os cartões devidos em "{deckData.name}" por hoje.
          </p>
        </div>
      )}
    </div>
  );
}
