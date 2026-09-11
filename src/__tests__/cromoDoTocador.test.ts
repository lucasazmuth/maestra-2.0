import fs from 'fs';
import path from 'path';

// O tocador local: os ícones dele, e o que ele não pode tapar.
//
// Duas coisas que o olho apanha num instante e que nenhum teste de comportamento apanha nunca,
// porque as duas são geometria e pintura — a tela funciona igual com as duas erradas.

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

  // ⚠️ O "+" FICAVA POR BAIXO DO TOCADOR, cortado pelo canto redondo dele. A folha da referência
  // levanta-o para 152px quando há tocador, e esse número veio da BARRA colada ao rodapé; a ilha
  // do celular não está colada. Com `z-index` 119 contra os 90 dele, quem ficava por cima era
  // ela. Vale para todos os módulos: o botão é o mesmo em Músicas, Agenda e Equipe.
  it('o botão flutuante fica acima da ilha do tocador, e não atrás dela', () => {
    const ilha = regra(folha, '.local-player-bar--over-nav,');
    const base = Number(ilha.match(/bottom:\s*calc\((\d+)px/)?.[1]);
    const altura = Number(ilha.match(/min-height:\s*(\d+)px/)?.[1]);

    const botao = regra(folha, 'body:has(.local-player-bar--over-nav) .botao-flutuante');
    const subiu = Number(botao.match(/bottom:\s*calc\((\d+)px/)?.[1]);

    expect(base).toBe(106);
    expect(altura).toBe(64);
    // Derivado, e não um número escrito à mão: mexer na ilha sem mexer no botão volta a tapá-lo.
    expect(subiu).toBeGreaterThanOrEqual(base + altura);
    // E é a MESMA conta do aplicativo, onde ela já estava certa: `PLAYER_DEBAIXO` (106) mais
    // `ALTURA_DO_PLAYER` (64) mais a `FOLGA` (14) do `BotaoFlutuante`. A web é que tinha ficado
    // para trás, com um número herdado de um desenho que ela já não usa.
    expect(subiu).toBe(base + altura + 14);

    // ⚠️ E SOBE COM A MARGEM SEGURA. A ilha sobe com ela; um botão que não subisse junto traria
    // o defeito de volta, menor e só nos aparelhos com entalhe — que são todos os recentes.
    expect(botao).toContain('env(safe-area-inset-bottom, 0px)');
  });

  // ⚠️ O ALCANCE É O DA ILHA. A folha da referência muda o botão de sítio aos 900px e a ilha
  // nasce aos 960: entre uma medida e a outra a ilha já existia e o botão ainda estava na
  // posição de computador, que é mais baixa. Era a mesma sobreposição, numa faixa de sessenta
  // píxeis de largura de janela que ninguém repara em testar.
  it('a correção vale desde onde a ilha começa, e não sessenta píxeis depois', () => {
    // A largura do `@media` que ENVOLVE a regra — ancorado no fim do que vem antes dela, e não
    // "algum 960 mais acima": a primeira versão deste caso aceitava o `@media` da ilha como
    // prova do botão, e sobrevivia à troca que ele devia apanhar.
    const alcanceDe = (seletor: string): number => {
      const antes = folha.slice(0, folha.indexOf(seletor));
      const abre = antes.match(/@media \(max-width:\s*(\d+)px\)\s*\{\s*$/);
      if (!abre) throw new Error(`"${seletor}" não está dentro de um @media de largura.`);
      return Number(abre[1]);
    };

    // Derivado da ilha, e não escrito à mão: os dois têm de mudar de sítio ao mesmo tempo.
    expect(alcanceDe('body:has(.local-player-bar--over-nav) .botao-flutuante'))
      .toBe(alcanceDe('.local-player-bar--over-nav,'));

    // E a folha da referência continua a ser a referência: o que se corrige mora ao lado da
    // geometria que o obriga, e não reescrito lá dentro.
    expect(referencia).toContain('body:has(.local-player-bar) .botao-flutuante');
  });
});
