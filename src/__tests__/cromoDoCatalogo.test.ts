import fs from 'fs';
import path from 'path';

import { COR_CATALOGO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o módulo Músicas.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');

describe('cromo do catálogo', () => {
  it.each(Object.entries(COR_CATALOGO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(css).toContain(valor);
  });

  // No celular a lista perde o contorno e o canto: o que separa uma faixa da outra é um fio,
  // não um cartão. É a diferença entre uma lista e uma pilha de caixas.
  it('a lista no celular é contínua, sem contorno e sem canto', () => {
    const semEspacos = css.replace(/\s+/g, '');
    expect(semEspacos).toContain('border-radius:0!important');
    expect(semEspacos).toContain(`border-bottom:1pxsolid${COR_CATALOGO.fio}`);
  });
});
