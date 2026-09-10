import { FC, useEffect, useRef } from 'react';
import { FiScissors, FiTrash2 } from 'react-icons/fi';

import type { CatalogClip } from '@maestra/core/interfaces/maestra';

import { Onda } from './Onda';
import { DS } from './tokens';

// Um CLIPE na linha do tempo.
//
// É o desenho da referência: um retângulo da cor da pista, com a onda dentro, o rótulo do take
// no canto e — quando selecionado — uma barra de ações a flutuar por cima e a linha da tesoura
// no ponto onde a agulha está.
//
// ⚠️ CORTAR É NA AGULHA, e não onde o rato clicou. Num editor, o corte acontece no ponto do
// tempo em que se está, e é por isso que a linha vermelha aparece dentro do clipe quando ele é
// selecionado: ela mostra ONDE o corte vai cair antes de a pessoa carregar na tesoura.

export const Clipe: FC<{
  clipe: CatalogClip;
  indice: number;
  cor: string;
  picos: number[];
  /** Pixels por segundo. É o zoom. */
  escala: number;
  agulha: number;
  selecionado: boolean;
  /** A altura da faixa: o clipe preenche-a, menos uma folga em cima e em baixo. */
  altura: number;
  /** A mix de uma gravação por montar: toca e desenha-se, mas não se edita. */
  fixo?: boolean;
  aoSelecionar: () => void;
  aoArrastar: (evento: React.MouseEvent) => void;
  aoCortar: () => void;
  aoApagar: () => void;
}> = ({ clipe, indice, cor, picos, escala, agulha, altura, selecionado, fixo, aoSelecionar, aoArrastar, aoCortar, aoApagar }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const partiuDe = useRef(0);
  const arrastou = useRef(false);

  // Clicar fora larga a seleção. Sem isto, a barra de ações de um clipe fica no ar enquanto se
  // trabalha noutro, e duas barras abertas ao mesmo tempo mentem sobre o que a tesoura corta.
  useEffect(() => {
    if (!selecionado) return undefined;
    const fora = (evento: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) aoSelecionar();
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [selecionado, aoSelecionar]);

  const inicio = Number(clipe.start_seconds) || 0;
  const duracao = Number(clipe.duration_seconds) || 0;
  const podeCortar = !fixo && agulha > inicio + 0.05 && agulha < inicio + duracao - 0.05;

  return (
    <div
      ref={caixa}
      onMouseDown={(evento) => { partiuDe.current = evento.clientX; arrastou.current = false; aoArrastar(evento); }}
      onMouseMove={(evento) => { if (Math.abs(evento.clientX - partiuDe.current) > 4) arrastou.current = true; }}
      onDoubleClick={(evento) => { evento.stopPropagation(); if (!fixo) aoApagar(); }}
      onClick={(evento) => {
        // Só alterna a seleção num clique LIMPO: sem isto, largar um arrasto selecionava ou
        // largava o clipe sem ninguém ter pedido.
        if (!arrastou.current) { evento.stopPropagation(); aoSelecionar(); }
        arrastou.current = false;
      }}
      style={{
        position: 'absolute',
        left: inicio * escala,
        top: 8,
        height: altura - 16,
        width: Math.max(duracao * escala, 8),
        background: `${cor}18`,
        border: `2px solid ${selecionado ? cor : `${cor}99`}`,
        borderRadius: 8,
        boxShadow: selecionado
          ? `0 0 0 2px ${cor}55, 0 4px 16px ${cor}44`
          : `0 4px 12px ${cor}22`,
        cursor: fixo ? 'default' : 'grab',
        overflow: 'visible',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    >
      {/* ⚠️ SEM FOLGA NOS LADOS, e isto não é só estética: o clipe começa exatamente em
          `inicio * escala` na linha do tempo, e cada pixel de recuo aqui dentro atrasa o
          desenho em relação ao instante que ele representa. Com 5 px de cada lado, o ataque de
          um bombo aparecia à direita da marca onde de facto soa — a 400 % de zoom, isso é
          visível a olho, e é justamente aí que alguém está a alinhar as coisas.
          Em cima e em baixo a folga fica: ali ela não mente sobre tempo nenhum, e é o que
          impede a onda de encostar na borda. */}
      <div style={{ position: 'absolute', inset: 0, padding: '6px 0', overflow: 'hidden', borderRadius: 6 }}>
        <Onda picos={picos} cor={cor} />
      </div>

      {/* A linha do corte: só quando o clipe está selecionado e a agulha está dentro dele. */}
      {selecionado && podeCortar && (
        <div
          style={{
            position: 'absolute',
            left: `${((agulha - inicio) / duracao) * 100}%`,
            top: 0, bottom: 0, width: 2,
            background: DS.color.primaria,
            zIndex: 3,
            pointerEvents: 'none',
            boxShadow: `0 0 6px ${DS.color.primaria}88`,
          }}
        >
          <div style={{
            position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
            background: DS.color.primaria, borderRadius: 3, padding: '1px 2px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FiScissors size={8} color='#fff' strokeWidth={2.5} />
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 4, left: 7,
        fontSize: 9, fontWeight: 700, color: cor, opacity: 0.95,
        pointerEvents: 'none', zIndex: 2,
        textShadow: `0 0 6px ${cor}88, 0 1px 2px rgba(0,0,0,0.7)`,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {fixo ? 'Mix' : `Take ${indice + 1}`}
      </div>

      {selecionado && !fixo && (
        <div
          onMouseDown={(evento) => evento.stopPropagation()}
          style={{
            position: 'absolute', top: -38, left: 0,
            display: 'flex', gap: 4,
            background: DS.color.bgPainel,
            border: `1px solid ${DS.color.bordaForte}`,
            borderRadius: DS.raio.medio,
            padding: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 20,
          }}
        >
          <button
            type='button'
            onClick={aoCortar}
            disabled={!podeCortar}
            title={podeCortar ? 'Dividir na agulha' : 'Leve a agulha para dentro do clipe'}
            aria-label='Dividir o clipe na agulha'
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 24, padding: '0 8px',
              background: podeCortar ? `${DS.color.primaria}18` : 'transparent',
              border: `1px solid ${podeCortar ? `${DS.color.primaria}60` : DS.color.borda}`,
              borderRadius: 4,
              color: podeCortar ? DS.color.primaria : DS.color.textoInerte,
              cursor: podeCortar ? 'pointer' : 'default',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            <FiScissors size={10} /> DIVIDIR
          </button>
          <button
            type='button'
            onClick={aoApagar}
            title='Remover o clipe'
            aria-label='Remover o clipe'
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 24, padding: '0 8px',
              background: 'transparent',
              border: `1px solid ${DS.color.borda}`,
              borderRadius: 4,
              color: DS.color.agulha,
              cursor: 'pointer',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            <FiTrash2 size={10} /> REMOVER
          </button>
        </div>
      )}
    </div>
  );
};
