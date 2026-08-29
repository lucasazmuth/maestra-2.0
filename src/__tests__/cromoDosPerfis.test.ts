import fs from 'fs';
import path from 'path';

import { COR_PERFIS, COR_PLANO_DA_CONTA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para a lista de perfis.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Artists', 'Artists.module.scss'), 'utf8',
);

describe('cromo da lista de perfis', () => {
  it.each(Object.entries(COR_PERFIS))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(scss).toContain(valor);
  });

  it.each(Object.entries(COR_PLANO_DA_CONTA))('o selo do plano: %s (%s)', (_nome, valor) => {
    const selo = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'PlanTag', 'PlanTag.module.scss'), 'utf8',
    );
    expect(selo.replace(/\s+/g, '')).toContain(valor.replace(/\s+/g, ''));
  });

  // O cartão é CENTRADO com a foto grande no meio — não uma linha com miniatura à esquerda.
  // É a diferença entre "escolher um perfil" e "percorrer uma lista".
  it('o cartão é centrado, com foto de 140px', () => {
    const semEspacos = scss.replace(/\s+/g, '');
    expect(semEspacos).toContain('width:140px');
    expect(semEspacos).toContain('text-align:center');
  });
});
