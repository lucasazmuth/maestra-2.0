import fs from 'fs';
import path from 'path';

// O tocador local e o que ele não pode tapar.
//
// Coisas que o olho apanha num instante e que nenhum teste de comportamento apanha nunca, porque
// são geometria e pintura — a tela funciona igual com todas erradas.

const ler = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const folha = ler('styles', 'local-player-unified.scss');
const referencia = ler('styles', 'gsap-reference.css');

/** O corpo de uma regra, a partir do seletor que a abre. */
const regra = (css: string, seletor: string): string => {
  const em = css.indexOf(seletor);
  if (em === -1) throw new Error(`Não achei a regra "${seletor}".`);
  const abre = css.indexOf('{', em);
  return css.slice(abre, css.indexOf('}', abre));
};

/**
 * A largura do `@media` que envolve uma regra.
 *
 * ⚠️ O ÚLTIMO ANTES DELA, e não "algum mais acima". A primeira versão disto aceitava o `@media`
 * de uma ilha como prova do da regra do botão, e sobrevivia à troca que devia apanhar. Estas
 * folhas não aninham consultas, então a que abre por último é a que manda.
 */
const alcanceDe = (css: string, seletor: string): number => {
  const onde = css.indexOf(seletor);
  if (onde === -1) throw new Error(`Não achei "${seletor}".`);
  const abre = css.lastIndexOf('@media (max-width:', onde);
  if (abre === -1) throw new Error(`"${seletor}" não está dentro de um @media de largura.`);
  return Number(css.slice(abre).match(/@media \(max-width:\s*(\d+)px\)/)![1]);
};

/** A folga que o botão guarda de quem estiver por baixo. É a `FOLGA` do `BotaoFlutuante`. */
const FOLGA = 14;

describe('cromo do tocador', () => {
  // ⚠️ ELES SÃO DESENHOS CHEIOS, e um desenho cheio pinta-se pelo `fill`. Os ícones trazem um
  // `fill: #bababa` no atributo `style` do próprio elemento, que nenhuma folha vence sem
  // `!important` — e daí saiu a tentativa de os recolorir pelo `stroke`. O que ela desenhava era
  // um CONTORNO azul-marinho de 1 px à volta de uma silhueta que continuava cinza: cada seta com
  // dois tons e uma borda que o desenho nunca teve.
  it('os ícones do tocador pintam-se pelo preenchimento, e não por um contorno', () => {
    const quietos = regra(folha, '.local-player-bar .lpb-volume button svg');
    const tocar = regra(folha, '.local-player-bar .lpb-play svg');

    expect(quietos).toContain('fill: #49638f !important');
    expect(tocar).toContain('fill: #ffffff !important');

    // E nenhum deles volta a traçar por cima do que já está pintado.
    [quietos, tocar].forEach((corpo) => expect(corpo).not.toMatch(/stroke\s*:/));
  });

  // A cor do repouso e a do toque são a mesma decisão: se uma se pinta pelo `fill` e a outra
  // pelo `color`, passar o rato por cima apagava o ícone de volta para o cinza do atributo.
  it('o realce do rato também muda o preenchimento', () => {
    expect(regra(folha, '.local-player-bar .lpb-volume button:focus-visible svg'))
      .toContain('fill: #294c83 !important');
  });
});

// ⚠️ O "+" FICAVA POR CIMA DAS DUAS ILHAS DO CELULAR — e, como as duas têm `z-index` acima do 90
// dele (120 a navegação, 119 o tocador), na prática ficava por BAIXO: cortado pelo canto redondo
// de uma ou da outra. Os números de antes vinham de um desenho em que a navegação era uma barra
// colada ao rodapé, que já não é o que se desenha.
//
// Vale para todos os módulos: o botão é o mesmo em Músicas, Agenda e Equipe.
describe('o botão flutuante e as ilhas do celular', () => {
  const daSuaVez = 'body:has(.local-player-bar--over-nav) .botao-flutuante';
  const DA_NAVEGACAO = '.task-app.has-mobile-nav .mobile-nav {';
  const DO_TOCADOR = '.local-player-bar--over-nav,';

  // O bloco do celular, achado pela regra do tocador (que só existe lá dentro) e lido de trás
  // para a frente até à consulta que o abre.
  const bloco = referencia.slice(
    referencia.lastIndexOf('@media (max-width:', referencia.indexOf(daSuaVez)),
  );

  const alturaDe = (corpo: string) => Number(corpo.match(/bottom:\s*(?:calc\()?(\d+)px/)![1]);

  it('sem tocador, ele fica acima da ilha da navegação', () => {
    const ilha = regra(referencia, DA_NAVEGACAO);
    const base = Number(ilha.match(/bottom:\s*(\d+)px/)![1]);
    const altura = Number(ilha.match(/min-height:\s*(\d+)px/)![1]);

    expect(base).toBe(18);
    expect(altura).toBe(78);
    // Derivado, e não um número escrito à mão: mexer na ilha sem mexer no botão volta a tapá-lo.
    // É a mesma conta do aplicativo — `rodapeDaIlha` e `ALTURA_DA_ILHA`, na `BarraDeAbas`.
    expect(alturaDe(regra(bloco, '.botao-flutuante {'))).toBe(base + altura + FOLGA);
  });

  it('com o tocador, ele fica acima da ilha DELE, que nasce mais alta', () => {
    const ilha = regra(folha, DO_TOCADOR);
    const base = Number(ilha.match(/bottom:\s*calc\((\d+)px/)![1]);
    const altura = Number(ilha.match(/min-height:\s*(\d+)px/)![1]);

    expect(base).toBe(106);
    expect(altura).toBe(64);

    const comTocador = regra(bloco, daSuaVez);
    expect(alturaDe(comTocador)).toBe(base + altura + FOLGA);

    // ⚠️ E SOBE COM A MARGEM SEGURA, que a ilha do tocador declara e a da navegação não. Um botão
    // que não subisse junto traria o defeito de volta, menor e só nos aparelhos com entalhe —
    // que são todos os recentes.
    expect(comTocador).toContain('env(safe-area-inset-bottom, 0px)');
  });

  // ⚠️ O ALCANCE É O DAS ILHAS. Este bloco começava aos 900px e as ilhas nascem aos 960: entre
  // uma medida e a outra elas já existiam e o botão ainda estava na posição de computador, que é
  // mais baixa. Era a mesma sobreposição, numa faixa de sessenta píxeis de largura de janela que
  // ninguém repara em testar.
  it('a correção vale desde onde as ilhas começam, e não sessenta píxeis depois', () => {
    const doBotao = alcanceDe(referencia, daSuaVez);

    expect(doBotao).toBe(alcanceDe(referencia, DA_NAVEGACAO));
    expect(doBotao).toBe(alcanceDe(folha, DO_TOCADOR));
  });
});
