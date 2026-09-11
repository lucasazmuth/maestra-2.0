import { FC, useEffect, useRef } from 'react';
import { FiScissors, FiTrash2 } from 'react-icons/fi';

import type { CatalogClip } from '@maestra/core/interfaces/maestra';
import { tituloDoArquivo } from '@maestra/core/services/armazenamento';

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
  /** Só para o rótulo de recurso: "Take N" quando o ficheiro não tem nome. */
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
  /**
   * Quem mexe aqui é um DEDO, e não um ponteiro. Muda o gesto, não o que se pode fazer.
   *
   * Com dedo, arrastar exige o clipe SELECIONADO primeiro. Não é cerimónia: no mesmo ecrã, o
   * arrasto horizontal já é o gesto de rolar a linha do tempo, e sem um sinal de intenção cada
   * tentativa de percorrer a música mexia no clipe por onde o dedo passasse. Um toque escolhe,
   * e a partir daí o clipe é a coisa que se está a mexer.
   *
   * ⚠️ ISTO JÁ TRAVOU O CLIPE INTEIRO, e era demais. Primeiro levou à frente a barra de ações
   * (dividir e remover, que são botões e não se carregam por acidente); depois ficou a travar
   * o arrasto mesmo depois de escolhido. O duplo-toque que apaga é o único gesto que continua
   * de fora, e por um motivo que não muda: dá-se sem querer.
   *
   * ⚠️ NÃO É O MESMO QUE `fixo`. Fixo é a pista da Mix — uma pista que não se mexe por natureza,
   * e que por isso se chama "Mix" em vez de "Take N". Essa não se edita de forma nenhuma.
   */
  noDedo?: boolean;
  aoSelecionar: () => void;
  aoArrastar: (evento: React.PointerEvent) => void;
  aoCortar: () => void;
  aoApagar: () => void;
}> = ({ clipe, indice, cor, picos, escala, agulha, altura, selecionado, fixo, noDedo, aoSelecionar, aoArrastar, aoCortar, aoApagar }) => {
  /**
   * Mexer o clipe no tempo. A Mix nunca; com dedo, só depois de escolhido.
   *
   * ⚠️ E É ISTO QUE DECIDE O `touchAction`: enquanto o clipe não pode ser arrastado, o dedo em
   * cima dele tem de continuar a rolar a linha do tempo. Trocar as voltas aqui tira à pessoa
   * ou o arrasto, ou a única forma de percorrer a música.
   */
  const podeArrastar = !fixo && (!noDedo || selecionado);
  /** O duplo-toque que apaga fica de fora do dedo: dá-se sem querer. */
  const semGesto = fixo || noDedo;
  const caixa = useRef<HTMLDivElement>(null);
  const partiuDe = useRef(0);
  const arrastou = useRef(false);

  // Clicar fora larga a seleção. Sem isto, a barra de ações de um clipe fica no ar enquanto se
  // trabalha noutro, e duas barras abertas ao mesmo tempo mentem sobre o que a tesoura corta.
  useEffect(() => {
    if (!selecionado) return undefined;
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target as HTMLElement | null;
      // ⚠️ MEXER NA AGULHA É PARTE DE DIVIDIR: é ela que diz onde o corte cai, e chegar lá
      // pede um toque na régua. Largar a seleção nesse toque fechava a barra exatamente no
      // gesto que a estava a preparar — escolhia-se o ponto e já não havia tesoura.
      if (alvo?.closest('[data-agulha]')) return;
      if (caixa.current && !caixa.current.contains(alvo as Node)) aoSelecionar();
    };
    // `pointerdown`, e não `mousedown`: ao toque o rato só é imitado depois do dedo levantar,
    // e até lá a barra de um clipe ficava aberta por cima do que se estava a fazer noutro.
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [selecionado, aoSelecionar]);

  // O dedo pede mais do que o ponteiro: 26 px acertam-se com o rato e falham-se com o polegar,
  // e estes dois botões decidem se um clipe fica ou desaparece.
  const alvo = noDedo ? { width: 34, height: 34 } : { width: 26, height: 26 };

  const inicio = Number(clipe.start_seconds) || 0;
  const duracao = Number(clipe.duration_seconds) || 0;
  const podeCortar = !fixo && agulha > inicio + 0.05 && agulha < inicio + duracao - 0.05;

  return (
    <div
      ref={caixa}
      // ⚠️ PONTEIRO, E NÃO RATO. `mousedown`/`mousemove` num ecrã de toque só são imitados
      // DEPOIS de o dedo levantar, e nunca em série: o arrasto do clipe não é que estivesse
      // travado por regra nenhuma no telemóvel — ele simplesmente nunca chegava a acontecer,
      // porque não havia um único `mousemove` entre pousar e levantar o dedo.
      onPointerDown={(evento) => {
        partiuDe.current = evento.clientX;
        arrastou.current = false;
        // Só arma o arrasto se ele for possível AGORA: armado à toa, o primeiro dedo que
        // passasse a rolar levava o clipe com ele.
        if (podeArrastar) aoArrastar(evento);
      }}
      onPointerMove={(evento) => { if (Math.abs(evento.clientX - partiuDe.current) > 4) arrastou.current = true; }}
      onDoubleClick={(evento) => { evento.stopPropagation(); if (!semGesto) aoApagar(); }}
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
        cursor: podeArrastar ? 'grab' : 'default',
        // Enquanto não se arrasta, o dedo em cima do clipe rola a linha do tempo; a arrastar,
        // o gesto é nosso e o navegador não o pode roubar para rolar.
        touchAction: podeArrastar ? 'none' : 'auto',
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
        // Um nome de ficheiro é tão comprido quanto quem o gravou quis; o clipe não é. Corta
        // com reticências em vez de transbordar por cima do clipe vizinho.
        maxWidth: 'calc(100% - 14px)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {/* ⚠️ O NOME DO FICHEIRO, e não o número do take. "Take 1/2/3" dizia só a ordem de
            entrada — e numa faixa com voz, dobra e ad-lib são três rótulos iguais por cima de
            três ondas parecidas. O número volta quando o clipe não tem ficheiro com nome. */}
        {fixo ? 'Mix' : (tituloDoArquivo(clipe.file_name || '') || `Take ${indice + 1}`)}
      </div>

      {/* ⚠️ SÓ OS ÍCONES, sem as palavras. "DIVIDIR" e "REMOVER" somavam 190 px de barra por
          cima de um clipe que muitas vezes mede menos do que isso — e num clipe estreito a
          barra saía pelos dois lados dele, a tapar os vizinhos. A tesoura e a lixeira dizem o
          mesmo; o nome continua no `title` e no `aria-label`. É como o app ficou. */}
      {selecionado && !fixo && (
        <div
          onPointerDown={(evento) => evento.stopPropagation()}
          style={{
            // ⚠️ NO TELEMÓVEL A BARRA VIVE DENTRO DO CLIPE. Por cima dele (que é onde ela fica
            // no desktop, e onde não tapa a onda) a primeira pista atirava-a para fora do topo
            // da área que rola: ficava cortada pela régua, ou invisível. Dentro cabe — uma
            // faixa de 96 px dá 80 de clipe — e nunca sai do ecrã.
            // ⚠️ SEMPRE DENTRO DO CLIPE, EM BAIXO À ESQUERDA. Por cima dele — que era onde ela
            // ficava com o rato — a barra da primeira pista saía pelo topo da área que rola e
            // ficava cortada pela régua. Dentro cabe (uma faixa de 96 dá 80 de clipe) e nunca
            // sai do ecrã. É onde o app a pôs, e ali ela funciona nos dois.
            position: 'absolute',
            bottom: 6, left: 6,
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...alvo,
              background: podeCortar ? `${DS.color.primaria}18` : 'transparent',
              border: `1px solid ${podeCortar ? `${DS.color.primaria}60` : DS.color.borda}`,
              borderRadius: 4,
              color: podeCortar ? DS.color.primaria : DS.color.textoInerte,
              cursor: podeCortar ? 'pointer' : 'default',
            }}
          >
            <FiScissors size={13} />
          </button>
          <button
            type='button'
            onClick={aoApagar}
            title='Remover o clipe'
            aria-label='Remover o clipe'
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...alvo,
              background: 'transparent',
              border: `1px solid ${DS.color.borda}`,
              borderRadius: 4,
              color: DS.color.agulha,
              cursor: 'pointer',
            }}
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
