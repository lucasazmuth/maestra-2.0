import { FC, ReactNode, useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';
import { TCLE_ENABLED } from '../../constants/featureFlags';
import { useConsent } from '../../hooks/useConsent';
import styles from './Consent.module.scss';

// Termo de Consentimento Livre e Esclarecido (TCLE) — uso dos dados na pesquisa de doutorado.
//
// NASCE DESLIGADO. Com TCLE_ENABLED=false este componente é transparente: devolve os filhos e não
// faz uma única consulta. Nada de pesquisa pode operar antes do parecer do Comitê de Ética.
//
// Regra de ouro do produto: a escolha NÃO altera a experiência. Quem recusa recebe exatamente o
// mesmo diagnóstico, na mesma hora — por isso os dois botões têm o mesmo peso visual e nenhum vem
// pré-selecionado. Qualquer desenho que empurre para o "autorizo" invalida o consentimento.

export const TcleGate: FC<{ children: ReactNode }> = ({ children }) => {
  const { state, refresh } = useConsent();
  const [texto, setTexto] = useState<{ content: string; version: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Já respondeu (autorizando ou não) → nunca mais perguntamos.
  const jaRespondeu = state?.pesquisa != null;
  const precisaPerguntar = TCLE_ENABLED && state != null && !jaRespondeu;

  useEffect(() => {
    if (!precisaPerguntar) return;
    supabase
      .from('legal_documents')
      .select('content, version')
      .eq('slug', 'tcle')
      .eq('is_current', true)
      .maybeSingle()
      .then(({ data }) => setTexto(data));
  }, [precisaPerguntar]);

  if (!precisaPerguntar) return <>{children}</>;
  // Sem o texto do termo não há consentimento esclarecido: em vez de perguntar no vazio, deixa
  // passar. O diagnóstico é do produto e não pode ficar refém de um documento de pesquisa.
  if (!texto) return <>{children}</>;

  const responder = async (autoriza: boolean) => {
    setEnviando(true);
    setErro(null);
    try {
      const { error } = await supabase.functions.invoke('account-consent', {
        body: { action: 'research', autoriza, version: texto.version },
      });
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível registrar sua resposta. Tente novamente.');
      setEnviando(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Convite para participar de uma pesquisa</p>
        <h1 className={styles.title}>Podemos usar seus dados de forma anônima em um estudo?</h1>

        <div className={styles.tcleText}>{texto.content}</div>

        <p className={styles.lead}>
          Sua resposta não muda nada no seu diagnóstico nem no seu acesso à Maestra. Você pode
          mudar de ideia depois, em Configurações.
        </p>

        {erro && <p className={styles.error}>{erro}</p>}

        {/* Mesmo peso visual nos dois: qualquer destaque em um deles enviesaria a escolha. */}
        <div className={styles.tcleActions}>
          <button type='button' className={styles.tcleChoice} disabled={enviando} onClick={() => responder(false)}>
            Não autorizo
          </button>
          <button type='button' className={styles.tcleChoice} disabled={enviando} onClick={() => responder(true)}>
            Autorizo
          </button>
        </div>
      </div>
    </div>
  );
};
