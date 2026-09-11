import { FC, useEffect, useRef } from 'react';
import { type AnimationItem } from 'lottie-web';

import { ANIMACAO_DA_GUIA } from '@maestra/core/audio/animacaoDaGuia';
import {
  CORES_DA_ANIMACAO, PERGUNTA_DA_GUIA, pintarALottie, rotuloDaGuia,
} from '@maestra/core/audio/exportar';

import { DS } from './tokens';

// FECHAR O ESPAÇO JAM: a pergunta, e a espera.
//
// ⚠️ A GUIA DEIXOU DE SER OBRIGATÓRIA NA SAÍDA. Esperar por ela é o certo quando se acabou de
// montar — é o que faz a lista de Músicas tocar o que se fez — e é um roubo quando se entrou só
// para ouvir, mexeu num fader e quer sair. Quem sabe qual dos dois é, é quem está lá.
//
// São duas telas no mesmo componente porque são dois momentos do MESMO gesto, e separá-las faria
// a tela de espera ter de saber sozinha por que é que apareceu.

const veu = {
  position: 'fixed' as const, inset: 0, zIndex: 60,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10, 10, 12, .72)', padding: 20,
};

/**
 * A mão a tocar, enquanto a conta corre.
 *
 * ⚠️ A BIBLIOTECA É PEDIDA AQUI DENTRO, e não no topo do ficheiro. O `lottie-web` desenha num
 * canvas logo ao ser carregado — debaixo do jsdom isso rebenta, e QUALQUER teste que importasse o
 * editor morria sem chegar a correr. Import tardio também a tira do pacote inicial da aplicação:
 * são 250 kB que só fazem falta a quem está a fechar o Espaço JAM.
 *
 * ⚠️ A ANIMAÇÃO É REPINTADA UMA VEZ, e guardada: o `pintarALottie` percorre o desenho inteiro, e
 * refazê-lo a cada render — que aqui acontece a cada ponto de percentagem — seria varrer um
 * ficheiro de cinquenta mil caracteres vinte vezes por segundo para desenhar o mesmo.
 */
const MaoQueToca: FC<{ tamanho: number }> = ({ tamanho }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const animacao = useRef<AnimationItem | null>(null);

  useEffect(() => {
    let vivo = true;
    void import('lottie-web').then(({ default: lottie }) => {
      if (!vivo || !caixa.current) return;
      animacao.current = lottie.loadAnimation({
        container: caixa.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: pintarALottie(ANIMACAO_DA_GUIA, CORES_DA_ANIMACAO),
      });
    });
    return () => { vivo = false; animacao.current?.destroy(); animacao.current = null; };
  }, []);

  // A proporção é a da composição (684 × 760): esticá-la para um quadrado entorta a mão.
  return <div ref={caixa} style={{ width: tamanho, height: Math.round(tamanho * (760 / 684)) }} />;
};

export const FecharComGuia: FC<{
  /** `null` fora da saída; 0..1 (ou `NaN`, sem conta ainda) enquanto a guia corre. */
  gerando: number | null;
  perguntando: boolean;
  aoGerar: () => void;
  aoSair: () => void;
  aoFicar: () => void;
}> = ({ gerando, perguntando, aoGerar, aoSair, aoFicar }) => {
  if (gerando != null) {
    return (
      <div style={veu} role='status' aria-live='polite'>
        <div style={{ textAlign: 'center' }}>
          <MaoQueToca tamanho={168} />
          <div style={{
            marginTop: 18, fontSize: 15, fontWeight: 700,
            color: DS.color.texto, fontFamily: DS.font.display,
          }}>
            {rotuloDaGuia(gerando)}
          </div>
          {/* ⚠️ DIZ POR QUE É QUE DEMORA. Sem esta linha, um minuto e meio de espera numa tela
              que a pessoa pediu para fechar parece a aplicação pendurada — e quem acha que
              pendurou, fecha à força, que é exatamente o gesto que perde o trabalho. */}
          <div style={{ marginTop: 6, fontSize: 12, color: DS.color.textoApoio, maxWidth: 280 }}>
            Somando as faixas numa gravação só. Pode demorar um bocado.
          </div>
        </div>
      </div>
    );
  }

  if (!perguntando) return null;

  const botao = {
    width: '100%', height: 44, borderRadius: DS.raio.medio,
    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: DS.font.display,
  };

  return (
    <div style={veu} onClick={aoFicar} role='dialog' aria-modal='true' aria-label={PERGUNTA_DA_GUIA.titulo}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, padding: 22,
          background: DS.color.bgPainel, border: `1px solid ${DS.color.borda}`,
          borderRadius: DS.raio.grande,
        }}
      >
        <h2 style={{
          margin: 0, fontSize: 17, fontWeight: 700, color: DS.color.texto,
          fontFamily: DS.font.display,
        }}>
          {PERGUNTA_DA_GUIA.titulo}
        </h2>
        <p style={{ margin: '10px 0 20px', fontSize: 13, lineHeight: 1.5, color: DS.color.textoApoio }}>
          {PERGUNTA_DA_GUIA.texto}
        </p>

        <div style={{ display: 'grid', gap: 8 }}>
          <button
            type='button'
            onClick={aoGerar}
            style={{ ...botao, background: DS.color.primaria, border: 'none', color: '#fff' }}
          >
            {PERGUNTA_DA_GUIA.gerar}
          </button>
          <button
            type='button'
            onClick={aoSair}
            style={{
              ...botao, background: 'transparent',
              border: `1px solid ${DS.color.borda}`, color: DS.color.texto,
            }}
          >
            {PERGUNTA_DA_GUIA.sair}
          </button>
          <button
            type='button'
            onClick={aoFicar}
            style={{ ...botao, background: 'transparent', border: 'none', color: DS.color.textoApoio }}
          >
            {PERGUNTA_DA_GUIA.ficar}
          </button>
        </div>
      </div>
    </div>
  );
};
