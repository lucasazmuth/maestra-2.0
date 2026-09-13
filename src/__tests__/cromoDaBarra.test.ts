import fs from 'fs';
import path from 'path';

import { COR_BARRA, SOMBRA } from '@maestra/core/constants/design';

// A ilha de navegação do app nativo tem que ser a MESMA da web no celular.
//
// A web a desenha em `gsap-reference.css`; o app não lê CSS, então os valores estão duplicados
// em `COR_BARRA`/`SOMBRA`. Este teste é o que impede a duplicata de virar divergência.
//
// O recorte importa: o `App.scss` ainda carrega uma versão ANTERIOR desta barra, escura e colada
// no rodapé, que o bloco daqui vence por vir depois. Conferir contra o arquivo errado daria um
// app preto onde a web é branca — e foi exatamente o caminho que eu tomei antes de checar.

const css = fs.readFileSync(
  path.join(__dirname, '..', 'styles', 'gsap-reference.css'),
  'utf8',
);

const inicio = css.indexOf('.task-app.has-mobile-nav .mobile-nav {');
const trecho = css.slice(inicio, css.indexOf('.task-app.has-mobile-nav .board-content', inicio));

/** A sombra vira objeto no React Native; na web é uma string. Recompõe pra comparar. */
const comoNaWeb = (s: typeof SOMBRA[keyof typeof SOMBRA]) =>
  `0 ${s.shadowOffset.height}px ${s.shadowRadius}px ${s.shadowColor.replace(
    'rgb(', 'rgba(',
  ).replace(')', `, ${String(s.shadowOpacity).replace(/^0/, '')})`)}`;

describe('cromo da ilha de navegação', () => {
  it('o trecho da barra foi localizado', () => {
    expect(inicio).toBeGreaterThan(0);
    expect(trecho).toContain('.mobile-more-item');
    expect(trecho).toContain('border-radius: 22px');
  });

  it.each(Object.entries(COR_BARRA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(trecho).toContain(valor);
  });

  it.each(Object.entries(SOMBRA))('a sombra "%s" é a mesma', (_nome, sombra) => {
    expect(trecho).toContain(comoNaWeb(sombra));
  });

  // A célula ativa é AZUL — o mesmo azul de ação do resto do produto (`var(--blue)`), e não uma
  // cor própria da navegação. É o detalhe que faz a barra pertencer ao mesmo app.
  it('a célula ativa usa o azul de ação', () => {
    expect(trecho).toContain('color: var(--blue)');
    expect(trecho).toContain('background: var(--blue)');
  });
});

// ⚠️ QUEM PÕE A ILHA NO AR TEM DE DESFAZER O DESENHO QUE ELA SUBSTITUI, e no mesmo fôlego.
//
// A folha esconde o rail e o painel aos 960px, mas o RECUO que eles deixam no quadro — 364px, ou
// 460 acima de 1300 — e a caixa `fixed` que os acompanha só se desfaziam num bloco que começa aos
// 900. Entre uma medida e a outra sobrava um VÃO VAZIO de 364px à esquerda de toda a tela, com o
// conteúdo espremido no que restava; e o cabeçalho, ainda a flutuar, comia o título.
//
// Aquele bloco não pode subir para 960 porque vale também para telas SEM navegação de baixo (a
// lista de perfis, a área admin), onde o rail continua lá. Por isso estas regras vivem presas ao
// `.has-mobile-nav`, que é exatamente a condição em que ele sai.
describe('a ilha desfaz o desenho de computador', () => {
  const bloco = css.slice(
    css.indexOf('.task-app.has-mobile-nav .app-rail'),
    css.indexOf('.task-app.has-mobile-nav .mobile-nav {'),
  );

  it('a mesma medida esconde o rail e apaga o recuo dele', () => {
    // Os dois lados da mesma decisão, no mesmo bloco: um sem o outro é o defeito.
    expect(bloco).toContain('.task-app.has-mobile-nav .app-rail');
    expect(bloco).toContain('.task-app.has-mobile-nav .profile-panel');
    expect(bloco).toContain('display: none');

    const quadro = bloco.slice(bloco.indexOf('.task-app.has-mobile-nav .board-shell'));
    expect(quadro).toContain('margin-left: 0');
    expect(quadro).toContain('margin-right: 0');
  });

  // A caixa do conteúdo é `fixed` no computador, encaixada abaixo de um cabeçalho que também
  // flutua. Solta uma sem a outra, o conteúdo nasce POR BAIXO do cabeçalho.
  it('a caixa e o cabeçalho deixam de flutuar juntos', () => {
    // ⚠️ O CORPO DA REGRA, e não "daqui até ao fim do bloco". A primeira versão disto lia do
    // seletor da caixa em diante e via o `position: static` do CABEÇALHO, que vem logo a seguir:
    // apagar o da caixa não fazia o teste mexer um músculo.
    const corpo = (seletor: string) => {
      const em = bloco.indexOf(seletor);
      if (em === -1) throw new Error(`Não achei "${seletor}".`);
      return bloco.slice(em, bloco.indexOf('}', em));
    };

    expect(corpo('.task-app.has-mobile-nav .app-layout')).toContain('position: static');
    expect(corpo('.task-app.has-mobile-nav > .top-navigation')).toContain('position: static');
  });

  // ⚠️ E NA MESMA CONSULTA QUE DESENHA A ILHA — a MESMA, e não uma de igual largura. Uma cópia
  // do número noutro `@media` é uma medida a mais para alguém mexer sozinha, e é dessa espécie
  // de par desemparelhado que este defeito nasceu: o rail escondido aos 960 e o recuo dele
  // desfeito aos 900.
  //
  // Qual é o número, quem prende é o `cromoDoTocador`, que o compara com a ilha do tocador e com
  // a altura do botão flutuante. Aqui prende-se que são A MESMA consulta.
  it('o desfazer mora na mesma consulta que desenha a ilha', () => {
    const daIlha = css.lastIndexOf('@media (max-width:', inicio);
    const doDesfazer = css.lastIndexOf(
      '@media (max-width:', css.indexOf('.task-app.has-mobile-nav .app-rail'),
    );

    expect(doDesfazer).toBe(daIlha);
  });
});
