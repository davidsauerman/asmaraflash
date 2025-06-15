
"use client";

import React, { useRef, ChangeEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle }  from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/providers/AppProvider';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

import { DEFAULT_EASE_FACTOR, PDF_WORKER_SRC } from '@/lib/constants';
import { useDeckData } from '@/hooks/useDeckData'; // To get deck name for export

if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
}

interface ImportExportCardProps {
  deckId: string;
}

interface CardData {
  frontText: string;
  backText: string;
  tags: string[];
  status: string;
  interval: number;
  easeFactor: number;
  dueDate: Timestamp;
  currentStep: number;
  lapses: number;
  createdAt: Timestamp;
  lastReviewed: Timestamp | null;
  frontImage?: string;
  backImage?: string;
  frontAudio?: string;
  backAudio?: string;
}


export default function ImportExportCard({ deckId }: ImportExportCardProps) {
  const { firestoreDb, userId, appIdPathSegment } = useAppContext();
  const { deckData } = useDeckData(deckId);
  const { toast } = useToast();
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const stripHtml = (html: string) => {
    if (typeof document !== 'undefined') {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }
    return html; // Fallback for non-browser environments (though this is client-side)
  };

  const extractMediaUrls = (htmlContent: string): { images: string[], audios: string[] } => {
    const images: string[] = [];
    const audios: string[] = [];
    if (!htmlContent) return { images, audios };

    const imgRegex = /<img\s[^>]*src="([^"]+)"[^>]*>/gi;
    const audioRegex = /<audio\s[^>]*src="([^"]+)"[^>]*>/gi;
    let match;

    while((match = imgRegex.exec(htmlContent)) !== null) {
        if (match[1] && !match[1].startsWith('data:')) { 
            images.push(match[1]);
        }
    }
    while((match = audioRegex.exec(htmlContent)) !== null) {
         if (match[1] && !match[1].startsWith('data:')) {
            audios.push(match[1]);
        }
    }
    return { images, audios };
  };

  const handleImportCSV = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !deckData) {
      toast({ title: "Erro", description: "Arquivo ou dados do baralho ausentes.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      const lines = csvContent.split(/\r\n|\n/);
      const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
      let importedCount = 0, errorCount = 0;

      // Basic delimiter detection (can be improved)
      let detectedDelimiter = ',';
      if (lines.length > 0) {
        const header = lines[0];
        if (header.includes(';')) detectedDelimiter = ';';
        else if (header.includes('\t')) detectedDelimiter = '\t';
      }
      
      function parseCsvLine(line: string, delimiter: string): string[] {
          const result: string[] = [];
          let currentField = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                  if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
                      currentField += '"';
                      i++; 
                  } else {
                      inQuotes = !inQuotes;
                  }
              } else if (char === delimiter && !inQuotes) {
                  result.push(currentField);
                  currentField = '';
              } else {
                  currentField += char;
              }
          }
          result.push(currentField);
          return result.map(field => field.trim());
      }


      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const fields = parseCsvLine(lines[i], detectedDelimiter);
        let newCardData: Partial<CardData> = {
          status: 'new', interval: 0, easeFactor: DEFAULT_EASE_FACTOR, dueDate: Timestamp.now(),
          currentStep: 0, lapses: 0, createdAt: Timestamp.now(), lastReviewed: null,
        };
        if (fields.length >= 2) {
          newCardData.frontText = fields[0] || '';
          newCardData.backText = fields[1] || '';
        }
        if (fields.length >= 7) { // Full format
           newCardData.frontImage = fields[2] || '';
           newCardData.backImage = fields[3] || '';
           newCardData.frontAudio = fields[4] || '';
           newCardData.backAudio = fields[5] || '';
           newCardData.tags = (fields[6] || '').split(/[\s,]+/).map(tag => tag.trim()).filter(tag => tag);
        } else {
          newCardData.tags = [];
        }

        // Construct HTML content from text and media URLs
        let finalFrontText = newCardData.frontText || '';
        if (newCardData.frontImage) finalFrontText += `<div class="my-2"><img src="${newCardData.frontImage}" alt="Imagem" style="max-width:90%;max-height:200px;"></div>`;
        if (newCardData.frontAudio) finalFrontText += `<div class="my-2"><audio controls src="${newCardData.frontAudio}"></audio></div>`;
        newCardData.frontText = finalFrontText;

        let finalBackText = newCardData.backText || '';
        if (newCardData.backImage) finalBackText += `<div class="my-2"><img src="${newCardData.backImage}" alt="Imagem" style="max-width:90%;max-height:200px;"></div>`;
        if (newCardData.backAudio) finalBackText += `<div class="my-2"><audio controls src="${newCardData.backAudio}"></audio></div>`;
        newCardData.backText = finalBackText;


        if (!newCardData.frontText?.trim() && !newCardData.backText?.trim()) {
            errorCount++;
            continue;
        }

        try {
          await addDoc(cardsColRef, newCardData as CardData);
          importedCount++;
        } catch (dbError: any) {
          console.error("Error importing CSV line:", lines[i], dbError);
          errorCount++;
        }
      }
      let importMessage = `${importedCount} cartões importados para "${deckData.name}".`;
      if (errorCount > 0) importMessage += ` ${errorCount} linhas não puderam ser importadas.`;
      toast({ title: "Importação CSV Concluída", description: importMessage, variant: errorCount > 0 ? "default" : "default" });
      setIsProcessing(false);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    };
    reader.onerror = () => {
      toast({ title: "Erro", description: "Erro ao ler arquivo CSV.", variant: "destructive" });
      setIsProcessing(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleExportCSV = async () => {
    if (!userId || !deckData) {
      toast({ title: "Erro", description: "Selecione um baralho válido para exportar.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
      const q = query(cardsColRef, orderBy("createdAt"));
      const querySnapshot = await getDocs(q);
      
      let csvHeader = "FrontText;BackText;FrontImageURL;BackImageURL;FrontAudioURL;BackAudioURL;Tags\n";
      let csvRows = "";

      querySnapshot.forEach(docSnap => {
        const card = docSnap.data() as CardData;
        const frontMedia = extractMediaUrls(card.frontText || '');
        const backMedia = extractMediaUrls(card.backText || '');

        const escapeCsvField = (field: string | undefined) => {
            const stringField = String(field || '');
            if (stringField.includes('"') || stringField.includes(';') || stringField.includes('\n') || stringField.includes('\r')) {
                return `"${stringField.replace(/"/g, '""')}"`; 
            }
            return stringField;
        };
        const row = [
          escapeCsvField(stripHtml(card.frontText)),
          escapeCsvField(stripHtml(card.backText)),
          escapeCsvField(frontMedia.images[0]), // Assuming one image/audio per side for simple CSV
          escapeCsvField(backMedia.images[0]),
          escapeCsvField(frontMedia.audios[0]),
          escapeCsvField(backMedia.audios[0]),
          escapeCsvField((card.tags || []).join(','))
        ].join(';');
        csvRows += row + "\n";
      });

      const csvContent = csvHeader + csvRows;
      // BOM for UTF-8
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${deckData.name.replace(/[^a-z0-9]/gi, '_') || 'deck'}_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Sucesso", description: "Baralho exportado como CSV." });
    } catch (error: any) {
      console.error("Error exporting to CSV:", error);
      toast({ title: "Erro ao exportar para CSV", description: error.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  const handleImportPDF = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !deckData) {
      toast({ title: "Erro", description: "Arquivo PDF ou dados do baralho ausentes.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf: PDFDocumentProxy = await getDocument(typedarray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => (item as TextItem).str).join(' ') + '\n';
            }

            const cardsData: Partial<CardData>[] = [];
            const cardBlocks = fullText.split("---CARD---").map(b => b.trim()).filter(Boolean);

            cardBlocks.forEach(block => {
                const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
                let frontTextAccumulator = '';
                let backTextAccumulator = '';
                let currentField: 'front' | 'back' | null = null;

                lines.forEach(line => {
                    const lineLower = line.toLowerCase();
                    if (lineLower.startsWith("frente:")) {
                        currentField = 'front';
                        frontTextAccumulator += line.substring("frente:".length).trim() + "\n";
                    } else if (lineLower.startsWith("verso:")) {
                        currentField = 'back';
                        backTextAccumulator += line.substring("verso:".length).trim() + "\n";
                    } else if (lineLower.startsWith("imagem frente:")) {
                         const url = line.substring("imagem frente:".length).trim();
                         if (url) frontTextAccumulator += `<img src="${url}" alt="Imagem da Frente" style="max-width:90%; max-height:200px; display:block; margin:auto;">\n`;
                    } else if (lineLower.startsWith("audio frente:")) {
                         const url = line.substring("audio frente:".length).trim();
                         if (url) frontTextAccumulator += `<audio controls src="${url}"></audio>\n`;
                    } else if (lineLower.startsWith("imagem verso:") || (currentField === 'back' && lineLower.startsWith("imagem:"))) {
                         const url = line.substring(lineLower.startsWith("imagem verso:") ? "imagem verso:".length : "imagem:".length).trim();
                         if (url) backTextAccumulator += `<img src="${url}" alt="Imagem do Verso" style="max-width:90%; max-height:200px; display:block; margin:auto;">\n`;
                    } else if (lineLower.startsWith("audio verso:") || (currentField === 'back' && lineLower.startsWith("audio:"))) {
                         const url = line.substring(lineLower.startsWith("audio verso:") ? "audio verso:".length : "audio:".length).trim();
                         if (url) backTextAccumulator += `<audio controls src="${url}"></audio>\n`;
                    } else if (currentField === 'front') {
                        frontTextAccumulator += line + "\n";
                    } else if (currentField === 'back') {
                        backTextAccumulator += line + "\n";
                    }
                });
                 if (frontTextAccumulator.trim() || backTextAccumulator.trim()) {
                    cardsData.push({
                        frontText: frontTextAccumulator.trim(),
                        backText: backTextAccumulator.trim(),
                        tags: [], status: 'new', interval: 0, easeFactor: DEFAULT_EASE_FACTOR,
                        dueDate: Timestamp.now(), currentStep: 0, lapses: 0,
                        createdAt: Timestamp.now(), lastReviewed: null,
                    });
                }
            });
            
            let importedCount = 0;
            const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
            for (const card of cardsData) {
                try { await addDoc(cardsColRef, card as CardData); importedCount++; }
                catch (dbError: any) { console.error("Error adding card from PDF:", dbError, card); }
            }
            toast({ title: "Importação PDF Concluída", description: `${importedCount} cartões importados para "${deckData.name}".` });
        } catch (pdfError: any) {
            console.error("Error processing PDF:", pdfError);
            toast({ title: "Erro ao Processar PDF", description: pdfError.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
            if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportPDF = async () => {
     if (!userId || !deckData) {
      toast({ title: "Erro", description: "Selecione um baralho válido para exportar.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
        const pdfDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        let yPos = 15; const pageHeight = pdfDoc.internal.pageSize.height;
        const lineHeight = 7; const margin = 10;
        const usableWidth = pdfDoc.internal.pageSize.width - margin * 2;

        const cardsColRef = collection(firestoreDb, "artifacts", appIdPathSegment, "users", userId, "flashcardDecks", deckId, "cards");
        const q = query(cardsColRef, orderBy("createdAt"));
        const querySnapshot = await getDocs(q);

        pdfDoc.setFontSize(18);
        pdfDoc.text(`Baralho: ${deckData.name}`, margin, yPos);
        yPos += lineHeight * 2;
        pdfDoc.setFontSize(10);

        querySnapshot.forEach(docSnap => {
            const card = docSnap.data() as CardData;
            let cardContent = ["---CARD---"];
            
            const frontTextClean = stripHtml(card.frontText || '');
            cardContent.push(`Frente: ${frontTextClean}`);
            const frontMediaUrls = extractMediaUrls(card.frontText || '');
            frontMediaUrls.images.forEach(url => cardContent.push(`Imagem Frente: ${url}`));
            frontMediaUrls.audios.forEach(url => cardContent.push(`Audio Frente: ${url}`));

            cardContent.push(`Verso: ${stripHtml(card.backText || '')}`);
            const backMediaUrls = extractMediaUrls(card.backText || '');
            backMediaUrls.images.forEach(url => cardContent.push(`Imagem Verso: ${url}`));
            backMediaUrls.audios.forEach(url => cardContent.push(`Audio Verso: ${url}`));

            cardContent.forEach(line => {
                const splitLines = pdfDoc.splitTextToSize(line, usableWidth);
                splitLines.forEach(textLine => {
                     if (yPos + lineHeight > pageHeight - margin) { pdfDoc.addPage(); yPos = margin; }
                    pdfDoc.text(textLine, margin, yPos);
                    yPos += lineHeight;
                });
            });
            yPos += lineHeight / 2;
            if (yPos + lineHeight * 2 > pageHeight - margin) { pdfDoc.addPage(); yPos = margin; }
        });
        pdfDoc.save(`${deckData.name.replace(/[^a-z0-9]/gi, '_') || 'deck'}_export.pdf`);
        toast({ title: "Sucesso", description: "Baralho exportado como PDF." });
    } catch (error: any) {
        console.error("Error exporting to PDF:", error);
        toast({ title: "Erro ao Exportar PDF", description: error.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar/Exportar Cartões</CardTitle>
        <CardDescription>
          CSV: Formato simples (Frente;Verso) ou completo (Frente;Verso;ImgFrenteURL;ImgVersoURL;AudioFrenteURL;AudioVersoURL;Tags). Use ; como delimitador.
          <br />
          PDF: Importa texto e URLs de mídia se formatado com "---CARD---", "Frente:", "Verso:", "Imagem ...:", "Audio ...:". Exporta texto e URLs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={() => csvFileInputRef.current?.click()} disabled={isProcessing} variant="outline">
            {isProcessing ? 'Processando...' : 'Importar CSV'}
          </Button>
          <input type="file" ref={csvFileInputRef} className="hidden" accept=".csv" onChange={handleImportCSV} />
          <Button onClick={handleExportCSV} disabled={isProcessing} variant="outline">
             {isProcessing ? 'Processando...' : 'Exportar CSV'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={() => pdfFileInputRef.current?.click()} disabled={isProcessing} variant="outline">
            {isProcessing ? 'Processando...' : 'Importar PDF'}
          </Button>
          <input type="file" ref={pdfFileInputRef} className="hidden" accept=".pdf" onChange={handleImportPDF} />
          <Button onClick={handleExportPDF} disabled={isProcessing} variant="outline">
             {isProcessing ? 'Processando...' : 'Exportar para PDF'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
