import fs from 'fs';
import path from 'path';

import { ESPERA_DA_MARCA } from '@maestra/core/constants/design';

// A ESPERA: a marca da Maestra a respirar, e a mesma respiração nas duas superfícies.
//
// ⚠️ NÃO É UMA RODA. Uma roda a girar é o sinal de espera de toda a gente, e por isso não é de
// ninguém — a tela podia ser de qualquer aplicativo. A web já fazia isto; o aplicativo é que
// tinha ficado com o círculo do sistema, nos mesmos sítios em que se espera mais tempo.
//
// ⚠️ A CURVA NÃO PODE VIVER EM DOIS SÍTIOS. A web escreve-a em `@keyframes` e o aplicativo em
// `reanimated`: linguagens diferentes, e por isso os NÚMEROS moram no núcleo e cada uma os lê.
// Uma respiração meio segundo mais lenta de um dos lados não quebra nada — só faz os dois
// parecerem dois produtos, que é o defeito mais caro de encontrar.

const folha = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'spinner', 'spinner.scss'), 'utf8',
);
const marca = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'maestra-manager-mark.svg'), 'utf8',
);
const oApp = fs.readFileSync(
  path.join(__dirname, '..', '..', 'apps', 'mobile', 'src', 'casca', 'Carregando.tsx'), 'utf8',
);

describe('cromo da espera', () => {
  it('a web respira com a duração e os tamanhos do núcleo', () => {
    const semEspacos = folha.replace(/\s+/g, '');

    expect(semEspacos).toContain(`${ESPERA_DA_MARCA.ciclo / 1000}s`);
    expect(semEspacos).toContain(`width:${ESPERA_DA_MARCA.marca}px`);
    expect(semEspacos).toContain(`width:${ESPERA_DA_MARCA.caixa}px`);
  });

  // ⚠️ A TINTA DA WEB MORA DENTRO DO SVG, e não na folha: é um `fill` no próprio desenho. Sem
  // este caso, trocar a cor no núcleo deixava o aplicativo de um tom e a web de outro, e nada
  // se queixava — o desenho é o mesmo, a diferença é de três dígitos hexadecimais.
  it('a marca da web é pintada com a tinta do núcleo', () => {
    expect(marca.toLowerCase()).toContain(ESPERA_DA_MARCA.cor.toLowerCase());
  });

  // Cada quadro da folha, conferido contra o do núcleo: a percentagem onde ele cai, a opacidade
  // e o tamanho. Mexer num sem mexer no outro é o começo da divergência.
  it('os quadros da web são os do núcleo, um a um', () => {
    const animacao = folha.slice(folha.indexOf('@keyframes maestra-loader-breathe'));
    const corpo = animacao.slice(0, animacao.indexOf('\n}')).replace(/\s+/g, '');

    ESPERA_DA_MARCA.quadros.forEach(({ em, opacidade, escala }) => {
      // O 0 e o 100 partilham uma linha (`0%,100%`), como em qualquer respiração que fecha.
      expect(corpo).toContain(`${Math.round(em * 100)}%`);
      expect(corpo).toContain(`opacity:${String(opacidade).replace(/^0/, '')}`);
      expect(corpo).toContain(`scale(${String(escala).replace(/^0/, '')})`);
    });
  });

  // ⚠️ E O APLICATIVO LÊ OS MESMOS NÚMEROS, em vez de os repetir. Um `1550` escrito à mão lá
  // dentro passaria neste teste hoje e divergiria no primeiro ajuste de cá.
  it('o aplicativo lê a curva do núcleo, e não a copia', () => {
    expect(oApp).toContain("ESPERA_DA_MARCA } from '@maestra/core/constants/design'");
    expect(oApp).toContain('= ESPERA_DA_MARCA;');

    const semComentarios = oApp.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(semComentarios).not.toContain(String(ESPERA_DA_MARCA.ciclo));
    expect(semComentarios).not.toContain(ESPERA_DA_MARCA.cor);
  });

  // ⚠️ QUEM PEDIU MENOS MOVIMENTO NÃO LEVA UMA MARCA A PULSAR. É uma preferência do sistema, e
  // para parte das pessoas é o que separa usar o produto de não conseguir olhar para ele.
  //
  // E nas duas a marca fica INTEIRA, não no quadro de repouso: ele é apagado de propósito para a
  // respiração ter para onde crescer, e imóvel meio apagado lê-se como tela quebrada.
  it('as duas param a respiração para quem pediu menos movimento', () => {
    const daWeb = folha.slice(folha.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(daWeb).toContain('animation: none');
    expect(daWeb).toContain('opacity: 1');

    expect(oApp).toContain('useReducedMotion');
    expect(oApp).toContain('opacity: 1, transform: [{ scale: 1 }]');
  });

  // Quem não vê a marca precisa de saber que a tela está a carregar, e não parada.
  it('as duas anunciam a espera a quem usa leitor de tela', () => {
    const tela = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'spinner', 'spinner.tsx'), 'utf8',
    );
    expect(tela).toContain("role='status'");
    expect(tela).toContain("aria-label='Carregando'");
    expect(oApp).toContain('accessibilityLabel="Carregando"');
  });
});
