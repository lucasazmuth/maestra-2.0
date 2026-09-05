import fs from 'fs';
import path from 'path';

import { COR_CATALOGO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o módulo Músicas.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');

describe('cromo do catálogo', () => {
  it.each(Object.entries(COR_CATALOGO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    // `#ffffff` a folha escreve `#fff`.
    expect(css).toContain(valor === '#ffffff' ? '#fff' : valor);
  });

  // O atalho do Espaço Jam na linha da música. A folha declara essa pílula DUAS vezes: a regra
  // base, branca com contorno, e uma variante azul-clara dentro de `.catalog-reference-page
  // .catalog-track-table article`, que é OUTRA lista. Quem vence na lista de Músicas é a base —
  // conferido no DOM a 375px, que é a única fonte que resolve duas regras concorrentes.
  it('a pílula do Espaço Jam é branca com contorno, e não a variante azul', () => {
    // `\n.` ancora no início da linha: sem isso o primeiro `.catalog-track-jam {` encontrado é
    // justamente o da variante, que vem prefixado por seletores dentro de uma media query.
    const regra = css.slice(css.indexOf('\n.catalog-track-jam {'));
    const base = regra.slice(0, regra.indexOf('\n}'));
    expect(base).toContain(`border: 1px solid ${COR_CATALOGO.jamContorno}`);
    expect(base).toContain('background: #fff');
    expect(base).toContain(`color: ${COR_CATALOGO.jam}`);
    expect(base).toContain('border-radius: 20px');
  });

  // No celular a lista perde o contorno e o canto: o que separa uma faixa da outra é um fio,
  // não um cartão. É a diferença entre uma lista e uma pilha de caixas.
  it('a lista no celular é contínua, sem contorno e sem canto', () => {
    const semEspacos = css.replace(/\s+/g, '');
    expect(semEspacos).toContain('border-radius:0!important');
    expect(semEspacos).toContain(`border-bottom:1pxsolid${COR_CATALOGO.fio}`);
  });
});
