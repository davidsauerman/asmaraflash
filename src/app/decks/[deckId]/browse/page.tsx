
"use client";
// This is a placeholder for the Card Browser page.
// Full implementation requires CardBrowserTable and EditCardModal components,
// along with Firestore logic for fetching, updating, and deleting cards.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAppContext } from '@/providers/AppProvider';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import GlobalLoadingSpinner from '@/components/core/GlobalLoadingSpinner';
import { Edit, Trash2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { suggestCardTags, SuggestCardTagsInput } from '@/ai/flows/suggest-card-tags';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';


interface CardInBrowser {
  id: string;
  frontText: string;
  backText: string;
  tags: string[];
  createdAt: Timestamp;
  // Add other fields as needed for display or editing
}

interface EditCardFormData {
  frontText: string;
  backText: string;
  tags: string;
  frontImageURL?: string;
  frontAudioURL?: string;
  backImageURL?: string;
  backAudioURL?: string;
}


export default function CardBrowserPage() {
  const params = useParams();
  const deckId = typeof params.deckId === 'string' ? params.deckId : '';
  const { firestoreDb, firebaseStorage, userId, appIdPathSegment, loadingAuth } = useAppContext();
  const { toast } = useToast();

  const [cards, setCards] = useState<CardInBrowser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CardInBrowser | null>(null);
  const [editFormData, setEditFormData] = useState<EditCardFormData>({ frontText: '', backText: '', tags: '' });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);

  const [editFrontImageFile, setEditFrontImageFile] = useState<File | null>(null);
  const [editFrontAudioFile, setEditFrontAudioFile] = useState<File | null>(null);
  const [editBackImageFile, setEditBackImageFile] = useState<File | null>(null);
  const [editBackAudioFile, setEditBackAudioFile] = useState<File | null>(null);


  const stripHtml = (html: string) => {
    if (typeof document !== 'undefined') {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }
    return html;
  };

  useEffect(() => {
    if (loadingAuth || !userId || !deckId) {
      if (!loadingAuth && !userId && !deckId) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
    const q = query(cardsColRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCards: CardInBrowser[] = [];
      snapshot.forEach((doc) => {
        fetchedCards.push({ id: doc.id, ...doc.data() } as CardInBrowser);
      });
      setCards(fetchedCards);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching cards for browser:", error);
      toast({ title: "Erro ao carregar cartões", description: error.message, variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestoreDb, userId, deckId, appIdPathSegment, loadingAuth, toast]);

  const handleDeleteCard = async (cardId: string) => {
    if (!userId || !deckId) return;
    try {
      const cardRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards", cardId);
      await deleteDoc(cardRef);
      toast({ title: "Sucesso", description: "Cartão excluído." });
    } catch (error: any) {
      console.error("Error deleting card:", error);
      toast({ title: "Erro ao excluir cartão", description: error.message, variant: "destructive" });
    }
  };

  const openEditModal = async (cardId: string) => {
    if (!userId || !deckId) return;
    try {
      const cardRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards", cardId);
      const cardSnap = await getDoc(cardRef);
      if (cardSnap.exists()) {
        const cardData = { id: cardSnap.id, ...cardSnap.data() } as CardInBrowser;
        setCardToEdit(cardData);
        setEditFormData({
          frontText: cardData.frontText || '',
          backText: cardData.backText || '',
          tags: (cardData.tags || []).join(', '),
          frontImageURL: '', // Will be extracted or uploaded
          frontAudioURL: '',
          backImageURL: '',
          backAudioURL: '',
        });
        setEditFrontImageFile(null); setEditFrontAudioFile(null);
        setEditBackImageFile(null); setEditBackAudioFile(null);
        setIsEditing(true);
      } else {
        toast({ title: "Erro", description: "Cartão não encontrado.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar cartão", description: error.message, variant: "destructive" });
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const uploadFile = async (file: File | null, type: 'image' | 'audio'): Promise<string | null> => {
    if (!file || !userId || !deckId) return null;
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
    const finalUrl = uploadedUrl || inputUrl; // Prioritize newly uploaded file
    if (finalUrl) {
      // Remove old media of the same type before adding new one
      // This is a simple removal; more robust would parse HTML and replace specific tags
      if (type === 'image') {
        content = content.replace(/<div class="my-2"><img src="[^"]+"[^>]*><\/div>/gi, ''); 
        content += `<div class="my-2"><img src="${finalUrl}" alt="Imagem" style="max-width:90%; max-height:200px; display:block; margin:auto; border-radius: 0.375rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);"></div>`;
      } else { // audio
        content = content.replace(/<div class="my-2"><audio controls src="[^"]+"><\/audio><\/div>/gi, '');
        content += `<div class="my-2"><audio controls src="${finalUrl}"></audio></div>`;
      }
    }
    return content;
  };


  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveChanges = async () => {
    if (!cardToEdit || !userId || !deckId) return;
    setIsSubmittingEdit(true);

    try {
      let finalFrontText = editFormData.frontText || '';
      let finalBackText = editFormData.backText || '';

      // Process front media
      const uploadedFrontImageUrl = await uploadFile(editFrontImageFile, 'image');
      finalFrontText = processMediaContent(finalFrontText, uploadedFrontImageUrl, editFormData.frontImageURL, 'image');
      
      const uploadedFrontAudioUrl = await uploadFile(editFrontAudioFile, 'audio');
      finalFrontText = processMediaContent(finalFrontText, uploadedFrontAudioUrl, editFormData.frontAudioURL, 'audio');

      // Process back media
      const uploadedBackImageUrl = await uploadFile(editBackImageFile, 'image');
      finalBackText = processMediaContent(finalBackText, uploadedBackImageUrl, editFormData.backImageURL, 'image');

      const uploadedBackAudioUrl = await uploadFile(editBackAudioFile, 'audio');
      finalBackText = processMediaContent(finalBackText, uploadedBackAudioUrl, editFormData.backAudioURL, 'audio');

      const updatedCardData = {
        frontText: finalFrontText.trim(),
        backText: finalBackText.trim(),
        tags: editFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      };

      const cardRef = doc(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards", cardToEdit.id);
      await updateDoc(cardRef, updatedCardData);
      toast({ title: "Sucesso", description: "Cartão atualizado." });
      setIsEditing(false);
      setCardToEdit(null);
    } catch (error: any) {
      console.error("Error updating card:", error);
      toast({ title: "Erro ao atualizar cartão", description: error.message, variant: "destructive" });
    }
    setIsSubmittingEdit(false);
  };

  const handleSuggestTagsForEdit = async () => {
    const { frontText, backText } = editFormData;
    if (!frontText?.trim() && !backText?.trim()) {
      toast({ title: "Conteúdo Insuficiente", variant: "default" });
      return;
    }
    setIsSuggestingTags(true);
    try {
      const input: SuggestCardTagsInput = { frontText: frontText || '', backText: backText || '' };
      const result = await suggestCardTags(input);
      if (result.tags && result.tags.length > 0) {
        setEditFormData(prev => ({ ...prev, tags: result.tags.join(', ') }));
        toast({ title: "Tags Sugeridas!", description: "Tags atualizadas no formulário." });
      } else {
        toast({ title: "Nenhuma Tag Sugerida" });
      }
    } catch (error: any) {
      toast({ title: "Erro ao Sugerir Tags", description: error.message, variant: "destructive" });
    }
    setIsSuggestingTags(false);
  };


  if (isLoading && loadingAuth) {
    return <GlobalLoadingSpinner />;
  }
  if (!deckId) {
     return <p className="text-center text-destructive">ID do baralho não fornecido.</p>
  }
  if (!userId && !loadingAuth) {
    return <p className="text-center">Usuário não autenticado.</p>
  }


  return (
    <div className="bg-card p-2 sm:p-6 rounded-xl shadow-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Frente (Início)</TableHead>
            <TableHead>Verso (Início)</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && cards.length === 0 ? (
             <TableRow><TableCell colSpan={4} className="text-center"><GlobalLoadingSpinner/></TableCell></TableRow>
          ) : cards.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nenhum cartão neste baralho.</TableCell></TableRow>
          ) : (
            cards.map((card) => (
              <TableRow key={card.id} className="hover:bg-muted">
                <TableCell className="max-w-xs truncate">{stripHtml(card.frontText).substring(0, 50) + (stripHtml(card.frontText).length > 50 ? '...' : '') || '(Vazio)'}</TableCell>
                <TableCell className="max-w-xs truncate">{stripHtml(card.backText).substring(0, 50) + (stripHtml(card.backText).length > 50 ? '...' : '') || '(Vazio)'}</TableCell>
                <TableCell>{card.tags.join(', ') || '-'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => openEditModal(card.id)} title="Editar Cartão">
                    <Edit className="h-4 w-4 text-blue-500" />
                  </Button>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Excluir Cartão">
                           <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir este cartão permanentemente?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCard(card.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {isEditing && cardToEdit && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Cartão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editFrontText">Frente (Texto/HTML)</Label>
                <Textarea id="editFrontText" name="frontText" value={editFormData.frontText} onChange={handleEditFormChange} rows={3} />
              </div>
              <div>
                <Label htmlFor="editFrontImageURL">Frente (URL Imagem Existente/Nova)</Label>
                <Input id="editFrontImageURL" name="frontImageURL" value={editFormData.frontImageURL || ''} onChange={handleEditFormChange} placeholder="https://exemplo.com/imagem.jpg"/>
              </div>
              <div>
                <Label htmlFor="editFrontImageFile">Frente (Substituir/Adicionar Imagem)</Label>
                <Input id="editFrontImageFile" type="file" accept="image/*" onChange={e => handleFileChange(e, setEditFrontImageFile)} />
              </div>
               <div>
                <Label htmlFor="editFrontAudioURL">Frente (URL Áudio Existente/Novo)</Label>
                <Input id="editFrontAudioURL" name="frontAudioURL" value={editFormData.frontAudioURL || ''} onChange={handleEditFormChange} placeholder="https://exemplo.com/audio.mp3"/>
              </div>
              <div>
                <Label htmlFor="editFrontAudioFile">Frente (Substituir/Adicionar Áudio)</Label>
                <Input id="editFrontAudioFile" type="file" accept="audio/*" onChange={e => handleFileChange(e, setEditFrontAudioFile)} />
              </div>

              <div>
                <Label htmlFor="editBackText">Verso (Texto/HTML)</Label>
                <Textarea id="editBackText" name="backText" value={editFormData.backText} onChange={handleEditFormChange} rows={3} />
              </div>
              <div>
                <Label htmlFor="editBackImageURL">Verso (URL Imagem Existente/Nova)</Label>
                <Input id="editBackImageURL" name="backImageURL" value={editFormData.backImageURL || ''} onChange={handleEditFormChange} placeholder="https://exemplo.com/imagem.jpg"/>
              </div>
              <div>
                <Label htmlFor="editBackImageFile">Verso (Substituir/Adicionar Imagem)</Label>
                <Input id="editBackImageFile" type="file" accept="image/*" onChange={e => handleFileChange(e, setEditBackImageFile)} />
              </div>
               <div>
                <Label htmlFor="editBackAudioURL">Verso (URL Áudio Existente/Novo)</Label>
                <Input id="editBackAudioURL" name="backAudioURL" value={editFormData.backAudioURL || ''} onChange={handleEditFormChange} placeholder="https://exemplo.com/audio.mp3"/>
              </div>
              <div>
                <Label htmlFor="editBackAudioFile">Verso (Substituir/Adicionar Áudio)</Label>
                <Input id="editBackAudioFile" type="file" accept="audio/*" onChange={e => handleFileChange(e, setEditBackAudioFile)} />
              </div>

              <div className="relative">
                <Label htmlFor="editTags">Tags (separadas por vírgula)</Label>
                <Input id="editTags" name="tags" value={editFormData.tags} onChange={handleEditFormChange} className="pr-28" />
                 <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSuggestTagsForEdit} 
                  disabled={isSuggestingTags || isSubmittingEdit}
                  className="absolute right-1 bottom-1"
                >
                  <Sparkles className="h-4 w-4 mr-1" /> {isSuggestingTags ? "Sugerindo..." : "Sugerir"}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmittingEdit}>Cancelar</Button>
              </DialogClose>
              <Button type="button" onClick={handleSaveChanges} disabled={isSubmittingEdit}>
                {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
