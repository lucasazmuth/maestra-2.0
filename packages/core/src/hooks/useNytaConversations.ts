import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

// Lista de conversas da Nyta de um artista — o histórico da barra lateral.
//
// Fala direto com o Postgres, sem passar pela edge function: são operações de dono sobre as
// próprias linhas, e a RLS de nyta_conversations já cobre exatamente isso (select/update/delete
// com user_id = auth.uid()). A edge function existe pra conversar com o modelo; não precisa
// intermediar um rename.
//
// Até a migration de múltiplas conversas havia uma UNIQUE(user_id, artist_id) no banco, então a
// lista da tela era fachada: sempre a mesma conversa.

export interface NytaConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  // Quem abriu a conversa. Hoje é sempre quem está vendo — a RLS de nyta_conversations filtra
  // por auth.uid(), então cada pessoa só enxerga as próprias. Fica no modelo porque é o dado
  // que a lista precisa pra atribuir autoria no dia em que a equipe compartilhar o histórico.
  userId: string;
}

export interface UseNytaConversationsReturn {
  conversations: NytaConversationSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<boolean>;
}

export function useNytaConversations(artistId?: string): UseNytaConversationsReturn {
  const [conversations, setConversations] = useState<NytaConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!artistId) {
      setConversations([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('nyta_conversations')
        .select('id, title, updated_at, user_id')
        .eq('artist_id', artistId)
        .order('updated_at', { ascending: false });
      setConversations(
        (data ?? []).map((row) => ({
          id: row.id, title: row.title, updatedAt: row.updated_at, userId: row.user_id,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => { refresh(); }, [refresh]);

  const rename = useCallback(async (id: string, title: string) => {
    const clean = title.trim().slice(0, 80);
    if (!clean) return;
    // Otimista: renomear é barato e reversível, e esperar o banco pra ver o novo nome faz a
    // lista parecer travada.
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)));
    await supabase.from('nyta_conversations').update({ title: clean }).eq('id', id);
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('nyta_conversations').delete().eq('id', id);
    if (error) return false;
    // As mensagens somem junto pelo ON DELETE CASCADE de nyta_messages.
    setConversations((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, []);

  return { conversations, loading, refresh, rename, remove };
}
