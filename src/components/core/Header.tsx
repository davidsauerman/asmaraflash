
"use client";

import Image from 'next/image';
import { useAppContext } from '@/providers/AppProvider';

export default function Header() {
  const { userId, loadingAuth } = useAppContext();

  return (
    <header className="py-4 px-4 md:px-8 text-center flex flex-col items-center border-b">
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/asmara-cards.firebasestorage.app/o/logo%2FGemini_Generated_Image_u8bp12u8bp12u8bp.png?alt=media&token=bc332a65-62b1-460b-967f-df1f02f8ea50"
        alt="Asmara Flash Logo"
        width={160} 
        height={64}
        className="h-16 w-auto mb-2 object-contain"
        priority
        data-ai-hint="abstract geometric"
      />
      <p className="text-xs text-muted-foreground mt-1" id="userIdDisplay">
        {loadingAuth ? 'Usuário: Carregando...' : userId ? `ID do Usuário: ${userId.substring(0,12)}...` : 'Usuário: Não autenticado'}
      </p>
    </header>
  );
}
