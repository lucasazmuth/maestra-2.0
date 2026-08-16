import { FC, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';
import { useAppSelector } from '../store/store';

// Estado de consentimento do usuário logado (LGPD).
//
// Fica num contexto porque duas partes precisam do MESMO dado: o gate (RequireConsent), que decide
// se libera o app, e a tela /consentimento, que coleta. Sem isso as duas chamariam a função
// separadamente e a tela poderia renderizar com um estado mais velho que o do gate.

export interface PendingDoc {
  slug: string;
  version: number;
  title: string;
}

export interface ConsentState {
  blocked: boolean;
  reviewStatus: 'ok' | 'menor_em_revisao';
  needsBirthDate: boolean;
  pendingDocs: PendingDoc[];
  satisfied: boolean;
  comunicacoes: boolean;
  pesquisa: string | null;
}

interface ConsentContextValue {
  state: ConsentState | null;
  loading: boolean;
  /** Erro de rede/servidor ao consultar. Diferente de "não consentiu". */
  unavailable: boolean;
  refresh: () => Promise<void>;
  apply: (next: ConsentState) => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export const ConsentProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const user = useAppSelector((s) => s.auth.user);
  const [state, setState] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('account-consent', {
        body: { action: 'state' },
      });
      if (error || !data || data.error) throw error || new Error(data?.error || 'Sem resposta');
      setState(data as ConsentState);
      setUnavailable(false);
    } catch (e) {
      // Não derruba o app. Ver o comentário do RequireConsent em App.tsx: trancar todo mundo do
      // lado de fora por causa de uma indisponibilidade transitória é pior que o risco que o gate
      // cobre — e a coleta volta a ser exigida na próxima verificação bem-sucedida.
      console.warn('[useConsent] estado indisponível:', e);
      setUnavailable(true);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Aplica a resposta que o próprio submit já devolveu, sem uma segunda ida ao servidor.
  const apply = useCallback((next: ConsentState) => {
    setState(next);
    setUnavailable(false);
  }, []);

  const value = useMemo(
    () => ({ state, loading, unavailable, refresh, apply }),
    [state, loading, unavailable, refresh, apply]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
};

export const useConsent = (): ConsentContextValue => {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent precisa estar dentro de <ConsentProvider>');
  return ctx;
};
