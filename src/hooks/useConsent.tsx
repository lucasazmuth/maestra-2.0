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

// ─── Consentimento coletado no cadastro, à espera de sessão ──────────────────────────────────
//
// O cadastro por e-mail já pergunta idade e aceite, mas só existe sessão DEPOIS do código — e
// nesse instante o PublicOnly redireciona e desmonta a tela. Enviar dali era uma corrida: a
// chamada saía no meio do desmonte e falhava calada, e a pessoa reencontrava o mesmo formulário
// no gate, já tendo preenchido tudo.
//
// Guardar e deixar o envio para o provider elimina a corrida: ele está montado, estável, e é
// exatamente quem precisa do resultado.
const CHAVE_PENDENTE = 'maestra_consentimento_pendente';

export interface ConsentimentoPendente {
  email: string;
  birthDate: string;
  aceita: boolean;
  comunicacoes: boolean;
}

export const guardarConsentimentoPendente = (p: ConsentimentoPendente): void => {
  try { sessionStorage.setItem(CHAVE_PENDENTE, JSON.stringify(p)); } catch { /* aba sem storage */ }
};

const lerConsentimentoPendente = (): ConsentimentoPendente | null => {
  try {
    const cru = sessionStorage.getItem(CHAVE_PENDENTE);
    return cru ? (JSON.parse(cru) as ConsentimentoPendente) : null;
  } catch {
    return null;
  }
};

const limparConsentimentoPendente = (): void => {
  try { sessionStorage.removeItem(CHAVE_PENDENTE); } catch { /* idem */ }
};

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

      let estado = data as ConsentState;

      // Acabou de se cadastrar e já respondeu tudo no formulário: envia agora, e a pessoa nunca vê
      // a tela de consentimento. O e-mail precisa bater — uma aba reaproveitada por outra conta
      // não pode herdar a declaração de idade de ninguém.
      const pendente = lerConsentimentoPendente();
      if (
        pendente && pendente.aceita && !estado.satisfied && !estado.blocked &&
        user.email && pendente.email.toLowerCase() === user.email.toLowerCase()
      ) {
        limparConsentimentoPendente();
        const { data: enviado } = await supabase.functions.invoke('account-consent', {
          body: {
            action: 'submit',
            birthDate: pendente.birthDate,
            aceitaTermos: true,
            aceitaPolitica: true,
            aceitaComunicacoes: pendente.comunicacoes,
          },
        });
        // Se o envio falhar, fica o estado original e o gate mostra a tela — o pior caso volta a
        // ser o de hoje, nunca deixar passar sem registro.
        if (enviado && !enviado.error) estado = enviado as ConsentState;
      }

      setState(estado);
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
