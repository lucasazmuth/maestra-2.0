import fs from 'fs';
import path from 'path';

import { COR_PERFIS } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para a lista de perfis.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Artists', 'Artists.module.scss'), 'utf8',
);

describe('cromo da lista de perfis', () => {
  it.each(Object.entries(COR_PERFIS))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(scss).toContain(valor);
  });

  // O cartão é CENTRADO com a foto grande no meio — não uma linha com miniatura à esquerda.
  // É a diferença entre "escolher um perfil" e "percorrer uma lista".
  it('o cartão é centrado, com foto de 140px', () => {
    const semEspacos = scss.replace(/\s+/g, '');
    expect(semEspacos).toContain('width:140px');
    expect(semEspacos).toContain('text-align:center');
  });
});
