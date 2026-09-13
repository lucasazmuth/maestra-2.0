import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import {
  criarEcoDasEscritas, decidirOEvento, pessoasPresentes,
  type DecisaoDoJam, type EcoDasEscritas, type EventoDoJam, type Presente,
} from '../audio/aoVivo';

// O CANAL DO ESPAÇO JAM: quem está aqui, e o que muda enquanto estamos.
//
// Um canal só para as duas coisas, e não dois: presença e mudanças da montagem chegam pelo
// MESMO `jam:<projeto>`. Dois canais seriam dois sockets, duas reconexões e duas contas de
// mensagens — e nada em troca, porque quem quer ver os avatares é exatamente quem quer ver a
// montagem mexer-se.
//
// Vive no núcleo porque as duas superfícies precisam do mesmo. O que muda entre elas é só o
// desenho dos avatares; a decisão sobre cada evento é a mesma, e está em `audio/aoVivo.ts`.

export interface JamAoVivo {
  /** Quem está com o projeto aberto agora, eu à frente. */
  presentes: Presente[];
  /**
   * Diz ao canal que ESTA escrita é minha.
   *
   * ⚠️ CHAMAR ANTES DE ESCREVER, sempre. É isto que impede o clipe de saltar para trás debaixo
   * do dedo: o Postgres devolve o meu próprio arrasto meio segundo depois, e sem esta marca a
   * tela aplicava-o por cima de onde a mão já está. Ver `criarEcoDasEscritas`.
   */
  minha: EcoDasEscritas['anotar'];
}

/**
 * @param projetoId  a música aberta — o canal é por MÚSICA, e não por gravação: quem está a ver
 *                   a V2 e quem está a ver a V1 estão na mesma sala.
 * @param eu         quem eu sou, para o avatar. Sem `id` não há presença nem canal.
 * @param versaoId   a gravação aberta: é por ela que se filtram as pistas.
 * @param conhecidos o que a tela já tem em mãos; uma linha que ela não conhece manda recarregar.
 * @param aoMudar    o que fazer com cada decisão. A tela é que sabe remendar-se.
 */
export function useJamAoVivo(
  projetoId: string | undefined,
  eu: Presente | null,
  versaoId: string | undefined,
  conhecidos: { pistas: string[]; clipes: string[] },
  aoMudar: (decisao: DecisaoDoJam) => void,
): JamAoVivo {
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const eco = useRef(criarEcoDasEscritas());

  // ⚠️ O QUE MUDA A CADA RENDER VAI NUMA GAVETA, e não nas dependências do efeito. `conhecidos`
  // é um array novo a cada render da tela e `aoMudar` uma função nova; como dependências, o
  // canal seria derrubado e reaberto vinte vezes por segundo enquanto a montagem toca — que é
  // pior do que não ter canal nenhum.
  const gaveta = useRef({ conhecidos, aoMudar, eu });
  gaveta.current = { conhecidos, aoMudar, eu };

  const meuId = eu?.id;
  const meuNome = eu?.nome;
  const minhaFoto = eu?.foto;

  useEffect(() => {
    if (!projetoId || !meuId) return undefined;

    const canal = supabase.channel(`jam:${projetoId}`, {
      config: { presence: { key: meuId } },
    });

    canal.on('presence', { event: 'sync' }, () => {
      const estado = canal.presenceState() as unknown as Record<string, Presente[]>;
      setPresentes(pessoasPresentes(estado, meuId));
    });

    const ouvir = (tabela: EventoDoJam['tabela'], filtro?: string) => {
      canal.on(
        // O tipo do cliente é estreito de mais para uma tabela passada em variável; o que corre
        // é o mesmo `postgres_changes` que a conversa usa desde sempre.
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: tabela, ...(filtro ? { filter: filtro } : {}) } as never,
        ((carga: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const linha = carga.new && Object.keys(carga.new).length ? carga.new : carga.old;
          if (!linha) return;
          const decisao = decidirOEvento(
            { tabela, tipo: carga.eventType as 'INSERT', linha } as EventoDoJam,
            eco.current,
            gaveta.current.conhecidos,
          );
          if (decisao.faca !== 'nada') gaveta.current.aoMudar(decisao);
        }) as never,
      );
    };

    // As pistas filtram-se pela gravação aberta. Os clipes NÃO TÊM por onde filtrar — a tabela
    // deles só conhece a pista a que pertencem —, por isso chegam todos os que a RLS deixa ver
    // e a decisão trata de largar os que não são desta montagem: uma linha que a tela não
    // conhece não é remendada, e um `INSERT` de outro projeto manda recarregar este. Trocar
    // isso por uma assinatura por pista seria refazê-la a cada faixa criada, no meio de uma
    // sessão de edição — mais caro, e mais frágil, do que um punhado de eventos ignorados.
    if (versaoId) ouvir('catalog_tracks', `version_id=eq.${versaoId}`);
    ouvir('catalog_clips');

    void canal.subscribe((estado) => {
      if (estado !== 'SUBSCRIBED') return;
      const dono = gaveta.current.eu;
      if (dono) void canal.track({ id: dono.id, nome: dono.nome, foto: dono.foto ?? null });
    });

    return () => {
      setPresentes([]);
      void supabase.removeChannel(canal);
    };
    // O nome e a foto entram: quem renomeia o perfil noutro separador deve aparecer certo aqui.
  }, [projetoId, versaoId, meuId, meuNome, minhaFoto]);

  const minha = useCallback<EcoDasEscritas['anotar']>(
    (id, assinatura) => eco.current.anotar(id, assinatura),
    [],
  );

  return { presentes, minha };
}
