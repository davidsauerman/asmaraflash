
"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import AddCardForm from '@/components/cards/AddCardForm';
import ImportExportCard from '@/components/cards/ImportExportCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Rows, Settings2, BookOpen, PlusCircle } from 'lucide-react';

export default function CardManagementPage() {
  const params = useParams();
  const deckId = typeof params.deckId === 'string' ? params.deckId : '';
  const router = useRouter();

  const [showAddCardForm, setShowAddCardForm] = useState(false);

  if (!deckId) {
    // This case should ideally be handled by the layout or redirect upstream
    return <div>ID do baralho inválido.</div>;
  }
  
  const handleCardAdded = () => {
     setShowAddCardForm(false); // Optionally hide form after adding
  };

  return (
    <div className="space-y-6">
      <Accordion type="single" collapsible className="w-full" defaultValue='item-1'>
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg font-medium hover:no-underline">
            <div className="flex items-center">
               <PlusCircle className="mr-2 h-5 w-5" /> Adicionar Novo Cartão
            </div>
          </AccordionTrigger>
          <AccordionContent>
             <AddCardForm deckId={deckId} onCardAdded={handleCardAdded}/>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
           <AccordionTrigger className="text-lg font-medium hover:no-underline">
            <div className="flex items-center">
               <FileText className="mr-2 h-5 w-5" /> Importar/Exportar Cartões
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ImportExportCard deckId={deckId} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <Settings2 className="mr-2 h-5 w-5" /> Ações do Baralho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={() => router.push(`/decks/${deckId}/browse`)} 
            className="w-full justify-start"
            variant="outline"
          >
            <Rows className="mr-2 h-4 w-4" /> Visualizar/Editar Cartões do Baralho
          </Button>
          <Button 
            onClick={() => router.push(`/decks/${deckId}/study`)} 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-start"
          >
             <BookOpen className="mr-2 h-4 w-4" /> Estudar este Baralho
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
