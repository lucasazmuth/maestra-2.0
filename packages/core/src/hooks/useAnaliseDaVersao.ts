import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import {
  aindaAndando, analiseDaVersao, cancelavel, cancelarAnalise, pedirAnalise, trabalhosDaVersao,
  type AnaliseDaVersao, type TipoDeAnalise, type TrabalhoDeAudio,
} from '../services/db/audioJobs';

// A análise de uma versão, do ponto de vista da tela: o que já se sabe, o que está a andar, e
// como pedir mais.
//
// Vive no núcleo porque as duas superfícies precisam do mesmo: o app mostra isto na ficha
// técnica do Espaço JAM, a web no espaço do projeto. A regra de quando parar de esperar é a
// mesma nos dois, e escrita duas vezes divergiria no primeiro ajuste.

/**
 * ⚠️ POR QUE HÁ REALTIME *E* SONDAGEM.
 *
 * O realtime é o caminho normal: o worker termina, o Postgres emite, a tela atualiza. Mas no
 * aparelho o socket morre quando o app vai para segundo plano — e o caso de uso desta
 * funcionalidade é exatamente esse: a pessoa manda analisar e sai da tela, porque demora.
 * Voltando, o socket reconecta mas o evento perdido não volta.
 *
 * A sondagem é o resgate, e só existe ENQUANTO há trabalho aberto. Sem trabalho, zero pedidos.
 */
const INTERVALO_DA_SONDAGEM = 5000;

export interface AnaliseNaTela {
  analise: AnaliseDaVersao | null;
  trabalhos: TrabalhoDeAudio[];
  /** O trabalho em curso de um tipo, se houver. */
  emCurso: (tipo: TipoDeAnalise) => TrabalhoDeAudio | undefined;
  /** O último erro de um tipo, para a tela dizer o que houve. */
  ultimoErro: (tipo: TipoDeAnalise) => string | null;
  carregando: boolean;
  pedindo: TipoDeAnalise | null;
  erro: string | null;
  pedir: (tipo: TipoDeAnalise) => Promise<void>;
  /** Há um trabalho daquele tipo que ainda dá para cancelar? */
  podeCancelar: (tipo: TipoDeAnalise) => boolean;
  /** Desiste de um trabalho que ainda não começou. Ver `cancelar`. */
  cancelar: (tipo: TipoDeAnalise) => Promise<void>;
  recarregar: () => Promise<void>;
}

export function useAnaliseDaVersao(versionId?: string | null): AnaliseNaTela {
  const canal = useId();
  const [analise, setAnalise] = useState<AnaliseDaVersao | null>(null);
  const [trabalhos, setTrabalhos] = useState<TrabalhoDeAudio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pedindo, setPedindo] = useState<TipoDeAnalise | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Guarda se ainda há trabalho aberto sem entrar nas dependências do efeito da sondagem: se
  // entrasse, o intervalo seria derrubado e recriado a cada atualização de estado.
  const andando = useRef(false);
  andando.current = trabalhos.some(aindaAndando);

  const buscar = useCallback(async () => {
    if (!versionId) {
      setAnalise(null);
      setTrabalhos([]);
      setCarregando(false);
      return;
    }
    try {
      const [a, t] = await Promise.all([analiseDaVersao(versionId), trabalhosDaVersao(versionId)]);
      setAnalise(a);
      setTrabalhos(t);
    } catch {
      // Silêncio de propósito: não conseguir LER a análise não interrompe quem está a editar a
      // versão. O erro que interessa é o de PEDIR, e esse aparece.
    } finally {
      setCarregando(false);
    }
  }, [versionId]);

  useEffect(() => { void buscar(); }, [buscar]);

  useEffect(() => {
    if (!versionId) return undefined;
    // O sufixo do `useId` pela mesma razão do chat do JAM: canal com nome repetido recusa o
    // segundo `.on()`, e duas versões abertas ao mesmo tempo acontecem.
    const inscricao = supabase
      .channel(`analise-${versionId}-${canal}`)
      .on(
        'postgres_changes',
        {
          event: '*', schema: 'public', table: 'audio_jobs',
          filter: `version_id=eq.${versionId}`,
        },
        () => { void buscar(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(inscricao); };
  }, [versionId, canal, buscar]);

  useEffect(() => {
    if (!versionId) return undefined;
    const relogio = setInterval(() => { if (andando.current) void buscar(); }, INTERVALO_DA_SONDAGEM);
    return () => clearInterval(relogio);
  }, [versionId, buscar]);

  const emCurso = useCallback(
    (tipo: TipoDeAnalise) => trabalhos.find((t) => t.tipo === tipo && aindaAndando(t)),
    [trabalhos],
  );

  const ultimoErro = useCallback(
    (tipo: TipoDeAnalise) => {
      const ultimo = trabalhos.find((t) => t.tipo === tipo);
      return ultimo?.estado === 'erro' ? (ultimo.erro || 'A análise não terminou.') : null;
    },
    [trabalhos],
  );

  const pedir = useCallback(async (tipo: TipoDeAnalise) => {
    if (!versionId) return;
    setErro(null);
    setPedindo(tipo);
    try {
      const { trabalho } = await pedirAnalise(versionId, tipo);
      // Entra na lista já: o realtime confirma daqui a pouco, mas quem tocou no botão precisa
      // de ver que alguma coisa aconteceu agora.
      setTrabalhos((antes) => [trabalho, ...antes.filter((t) => t.id !== trabalho.id)]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui pedir a análise.');
    } finally {
      setPedindo(null);
    }
  }, [versionId]);

  /**
   * Desiste de um trabalho que ainda está NA FILA.
   *
   * ⚠️ Isto não é enfeite: sem ele, quem toca em "detectar" fica preso a um "ouvindo o áudio…"
   * que não tem fim se o worker estiver fora do ar. Foi o que aconteceu durante a construção —
   * o único jeito de sair era apagar a linha no banco, e quem usa o produto não faz isso.
   *
   * Só cancela o que não começou. Interromper a máquina a meio não é possível de um lado só, e
   * marcar como cancelado o que a CPU ainda gira produziria uma linha que mente.
   */
  const podeCancelar = useCallback(
    (tipo: TipoDeAnalise) => !!cancelavel(trabalhos, tipo),
    [trabalhos],
  );

  const cancelar = useCallback(async (tipo: TipoDeAnalise) => {
    const aberto = cancelavel(trabalhos, tipo);
    if (!aberto) return;
    setErro(null);
    try {
      await cancelarAnalise(aberto.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui cancelar.');
    } finally {
      // Recarrega mesmo se falhou: o estado real está no banco, e adivinhá-lo daqui é como o
      // pedido acaba a mostrar uma coisa enquanto o servidor pensa outra.
      await buscar();
    }
  }, [trabalhos, buscar]);

  return {
    analise, trabalhos, emCurso, ultimoErro, carregando, pedindo, erro, pedir,
    podeCancelar, cancelar,
    recarregar: buscar,
  };
}
