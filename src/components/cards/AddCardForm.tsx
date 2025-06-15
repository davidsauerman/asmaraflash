
"use client";

import React, { useState, ChangeEvent } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/providers/AppProvider';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DEFAULT_EASE_FACTOR } from '@/lib/constants';
import { suggestCardTags, SuggestCardTagsInput } from '@/ai/flows/suggest-card-tags';
import { Sparkles } from 'lucide-react';

const cardSchema = z.object({
  frontText: z.string().optional(),
  frontImageURL: z.string().url().optional().or(z.literal('')),
  backText: z.string().optional(),
  backImageURL: z.string().url().optional().or(z.literal('')),
  frontAudioURL: z.string().url().optional().or(z.literal('')),
  backAudioURL: z.string().url().optional().or(z.literal('')),
  tags: z.string().optional(),
}).refine(data => data.frontText?.trim() || data.frontImageURL?.trim() || data.backText?.trim() || data.backImageURL?.trim() || data.frontAudioURL?.trim() || data.backAudioURL?.trim(), {
  message: "Pelo menos um campo de conteúdo (texto, imagem ou áudio) deve ser preenchido.",
  path: ["frontText"], // arbitrary path for error display
});

type CardFormData = z.infer<typeof cardSchema>;

interface AddCardFormProps {
  deckId: string;
  onCardAdded?: () => void;
}

export default function AddCardForm({ deckId, onCardAdded }: AddCardFormProps) {
  const { firestoreDb, firebaseStorage, userId, appIdPathSegment } = useAppContext();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);

  const [frontImageFile, setFrontImageFile] = useState<File | null>(null);
  const [frontAudioFile, setFrontAudioFile] = useState<File | null>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [backAudioFile, setBackAudioFile] = useState<File | null>(null);

  const { register, handleSubmit, control, reset, setValue, getValues, formState: { errors } } = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      frontText: '', frontImageURL: '', backText: '', backImageURL: '',
      frontAudioURL: '', backAudioURL: '', tags: ''
    }
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const uploadFile = async (file: File | null, type: 'image' | 'audio'): Promise<string | null> => {
    if (!file || !userId) return null;
    const filePath = `artifacts/${appIdPathSegment}/users/${userId}/flashcardDecks/${deckId}/media/${Date.now()}_${file.name}`;
    const storageRef = ref(firebaseStorage, filePath);
    try {
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error: any) {
      toast({ title: `Erro no Upload de ${type === 'image' ? 'Imagem' : 'Áudio'}`, description: error.message, variant: "destructive" });
      return null;
    }
  };
  
  const processMediaContent = (text: string, uploadedUrl?: string | null, inputUrl?: string | null, type: 'image' | 'audio'): string => {
    let content = text;
    const finalUrl = uploadedUrl || inputUrl;
    if (finalUrl) {
      if (type === 'image') {
        content += `<div class="my-2"><img src="${finalUrl}" alt="Imagem" style="max-width:90%; max-height:200px; display:block; margin:auto; border-radius: 0.375rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);"></div>`;
      } else { // audio
        content += `<div class="my-2"><audio controls src="${finalUrl}"></audio></div>`;
      }
    }
    return content;
  };


  const onSubmit: SubmitHandler<CardFormData> = async (data) => {
    if (!userId) {
      toast({ title: "Não autenticado", description: "Faça login para adicionar cartões.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      let finalFrontText = data.frontText || '';
      let finalBackText = data.backText || '';

      const uploadedFrontImageUrl = await uploadFile(frontImageFile, 'image');
      finalFrontText = processMediaContent(finalFrontText, uploadedFrontImageUrl, data.frontImageURL, 'image');
      
      const uploadedFrontAudioUrl = await uploadFile(frontAudioFile, 'audio');
      finalFrontText = processMediaContent(finalFrontText, uploadedFrontAudioUrl, data.frontAudioURL, 'audio');

      const uploadedBackImageUrl = await uploadFile(backImageFile, 'image');
      finalBackText = processMediaContent(finalBackText, uploadedBackImageUrl, data.backImageURL, 'image');

      const uploadedBackAudioUrl = await uploadFile(backAudioFile, 'audio');
      finalBackText = processMediaContent(finalBackText, uploadedBackAudioUrl, data.backAudioURL, 'audio');
      
      if (!finalFrontText.trim() && !finalBackText.trim()) {
        toast({ title: "Conteúdo faltando", description: "A frente ou o verso do cartão deve ter algum conteúdo.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const newCard = {
        frontText: finalFrontText.trim(),
        backText: finalBackText.trim(),
        tags: data.tags?.split(',').map(tag => tag.trim()).filter(tag => tag) || [],
        status: 'new',
        interval: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        dueDate: Timestamp.now(),
        currentStep: 0,
        lapses: 0,
        createdAt: Timestamp.now(),
        lastReviewed: null,
      };

      const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
      await addDoc(cardsColRef, newCard);

      toast({ title: "Sucesso!", description: "Cartão adicionado com sucesso." });
      reset();
      setFrontImageFile(null); setFrontAudioFile(null);
      setBackImageFile(null); setBackAudioFile(null);
      if (onCardAdded) onCardAdded();
    } catch (error: any) {
      console.error("Error adding card:", error);
      toast({ title: "Erro ao adicionar cartão", description: error.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleSuggestTags = async () => {
    const { frontText, backText } = getValues();
    if (!frontText?.trim() && !backText?.trim()) {
      toast({ title: "Conteúdo Insuficiente", description: "Por favor, adicione texto na frente ou no verso para sugerir tags.", variant: "default" });
      return;
    }
    setIsSuggestingTags(true);
    try {
      const input: SuggestCardTagsInput = {
        frontText: frontText || '',
        backText: backText || '',
      };
      const result = await suggestCardTags(input);
      if (result.tags && result.tags.length > 0) {
        setValue('tags', result.tags.join(', '));
        toast({ title: "Tags Sugeridas!", description: "Tags foram preenchidas." });
      } else {
        toast({ title: "Nenhuma Tag Sugerida", description: "Não foi possível sugerir tags para este conteúdo." });
      }
    } catch (error: any) {
      console.error("Error suggesting tags:", error);
      toast({ title: "Erro ao Sugerir Tags", description: error.message, variant: "destructive" });
    }
    setIsSuggestingTags(false);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo Cartão</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="frontText">Frente (Texto/HTML)</Label>
            <Textarea id="frontText" {...register("frontText")} rows={3} />
          </div>
          <div>
            <Label htmlFor="frontImageURL">Frente (URL da Imagem)</Label>
            <Input id="frontImageURL" {...register("frontImageURL")} placeholder="https://exemplo.com/imagem.jpg" />
            {errors.frontImageURL && <p className="text-sm text-destructive mt-1">{errors.frontImageURL.message}</p>}
          </div>
          <div>
            <Label htmlFor="frontImageFile">Frente (Upload Imagem)</Label>
            <Input id="frontImageFile" type="file" accept="image/*" onChange={e => handleFileChange(e, setFrontImageFile)} />
          </div>
          <div>
            <Label htmlFor="frontAudioURL">Frente (URL do Áudio)</Label>
            <Input id="frontAudioURL" {...register("frontAudioURL")} placeholder="https://exemplo.com/audio.mp3" />
             {errors.frontAudioURL && <p className="text-sm text-destructive mt-1">{errors.frontAudioURL.message}</p>}
          </div>
          <div>
            <Label htmlFor="frontAudioFile">Frente (Upload Áudio)</Label>
            <Input id="frontAudioFile" type="file" accept="audio/*" onChange={e => handleFileChange(e, setFrontAudioFile)} />
          </div>

          <div>
            <Label htmlFor="backText">Verso (Texto/HTML)</Label>
            <Textarea id="backText" {...register("backText")} rows={3} />
          </div>
           <div>
            <Label htmlFor="backImageURL">Verso (URL da Imagem)</Label>
            <Input id="backImageURL" {...register("backImageURL")} placeholder="https://exemplo.com/imagem.jpg" />
            {errors.backImageURL && <p className="text-sm text-destructive mt-1">{errors.backImageURL.message}</p>}
          </div>
          <div>
            <Label htmlFor="backImageFile">Verso (Upload Imagem)</Label>
            <Input id="backImageFile" type="file" accept="image/*" onChange={e => handleFileChange(e, setBackImageFile)} />
          </div>
          <div>
            <Label htmlFor="backAudioURL">Verso (URL do Áudio)</Label>
            <Input id="backAudioURL" {...register("backAudioURL")} placeholder="https://exemplo.com/audio.mp3" />
            {errors.backAudioURL && <p className="text-sm text-destructive mt-1">{errors.backAudioURL.message}</p>}
          </div>
          <div>
            <Label htmlFor="backAudioFile">Verso (Upload Áudio)</Label>
            <Input id="backAudioFile" type="file" accept="audio/*" onChange={e => handleFileChange(e, setBackAudioFile)} />
          </div>
          
          <div className="relative">
            <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <Input 
                  id="tags" 
                  {...field} 
                  placeholder="ex: biologia, capitais" 
                  className="pr-28" 
                />
              )}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleSuggestTags} 
              disabled={isSuggestingTags || isSubmitting}
              className="absolute right-1 bottom-1"
            >
              <Sparkles className="h-4 w-4 mr-1" /> {isSuggestingTags ? "Sugerindo..." : "Sugerir"}
            </Button>
          </div>
          {errors.frontText && <p className="text-sm text-destructive mt-1">{errors.frontText.message}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando Cartão...' : 'Salvar Cartão'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
