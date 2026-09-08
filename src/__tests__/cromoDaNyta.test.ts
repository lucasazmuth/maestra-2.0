import fs from 'fs';
import path from 'path';

import { COR_NYTA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o chat da Nyta: o app pinta por `COR_NYTA` e a
// web por CSS, e este arquivo é o que impede as duas de divergirem em silêncio.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');
const inicio = css.indexOf('.nyta-surface .nyta-message-list {');
const trecho = css.slice(inicio, css.indexOf('.nyta-surface .nyta-errorBanner', inicio) + 400);

describe('cromo do chat da Nyta', () => {
  it('o trecho foi localizado', () => {
    expect(inicio).toBeGreaterThan(0);
    expect(trecho).toContain('.nyta-fala');
  });

  it.each(Object.entries(COR_NYTA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(trecho).toContain(valor);
  });

  // A DECISÃO DE DESENHO, presa em três asserções.
  //
  // A conversa tinha um balão por turno, com contorno, avatar e cantos assimétricos dos dois
  // lados. Ela passou a ter um recipiente só. É uma regra fácil de desfazer sem querer — basta
  // alguém "consertar" a resposta da Nyta dando um fundo a ela para a tela voltar a ter cara de
  // chatbot —, e nenhuma das três se vê num teste de cor.
  describe('a assimetria entre as duas pontas', () => {
    // Só o bloco da PRÓPRIA fala, e não tudo até a regra seguinte. A fatia larga varria junto as
    // regras dos filhos (`code`, `pre`, `table`), que têm fundo por direito — e um `background`
    // ali dentro fazia este teste acusar recipiente onde não há.
    const abre = trecho.indexOf('.nyta-surface .nyta-fala--nyta {');
    const daNyta = trecho.slice(abre, trecho.indexOf('}', abre));

    it('a resposta da Nyta não tem recipiente: nem fundo, nem contorno', () => {
      expect(daNyta).not.toContain('background');
      expect(daNyta).not.toContain('border');
    });

    it('a resposta ocupa a coluna inteira, e não uma fração dela', () => {
      expect(daNyta).toContain('max-width: 100%');
    });

    // O balão a 13px era para conferir de relance; a resposta da Nyta é para LER.
    it('a resposta é lida em corpo de leitura', () => {
      expect(daNyta).toContain('font-size: 15px');
    });

    it('a pergunta de quem escreve é o único recipiente, e é cinza', () => {
      const abre = trecho.indexOf('.nyta-surface .nyta-fala--voce {');
      const daPessoa = trecho.slice(abre, trecho.indexOf('}', abre));
      expect(daPessoa).toContain(`background: ${COR_NYTA.pergunta}`);
      // Cinza, e não o azul de ação: em azul ela parecia um botão.
      expect(daPessoa).not.toContain('#4267b9');
    });
  });

  // Nenhuma fala leva avatar. Quem falou já está dito pela posição e pelo recipiente, e um
  // retrato repetido a cada turno é a marca registrada de interface de chatbot. O do usuário,
  // ainda por cima, vinha de `user_metadata` de QUEM ESTÁ VENDO — `NytaChatMessage` não tem
  // autor —, então mostrava a mesma cara em toda mensagem, inclusive nas de outra pessoa.
  it('não há avatar no fio da conversa', () => {
    const lista = fs.readFileSync(
      path.join(__dirname, '..', 'pages', 'NytaChat', 'components', 'MessageList.tsx'),
      'utf8',
    );
    expect(lista).not.toContain('Avatar');
  });
});
