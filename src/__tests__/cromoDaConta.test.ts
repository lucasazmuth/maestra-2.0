import fs from 'fs';
import path from 'path';

import { COR_CONTA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para Configurações.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');

describe('cromo das configurações', () => {
  it.each(Object.entries(COR_CONTA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(css).toContain(valor);
  });

  // O cartão de Configurações é do MESMO cinza do fundo, com contorno e sem sombra — o oposto
  // do cartão branco elevado que a mesma classe usa no desktop.
  it('o cartão é cinza com contorno, e não branco com sombra', () => {
    const semEspacos = css.replace(/\s+/g, '');
    expect(semEspacos).toContain('.settings-page.settings-gridarticle');
    expect(semEspacos).toContain('box-shadow:none');
  });
});
