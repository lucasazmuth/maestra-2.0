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
