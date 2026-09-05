import fs from 'fs';
import path from 'path';

import { COR_ENTRADA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para as telas de autenticação.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Login', 'AuthShell.module.scss'), 'utf8',
);

describe('cromo da entrada', () => {
  it.each(Object.entries(COR_ENTRADA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(scss.replace(/\s+/g, '')).toContain(valor.replace(/\s+/g, ''));
  });

  // Duas colunas iguais para os logins sociais é exigência da diretriz 4.8 da App Store: o
  // Sign in with Apple precisa da mesma proeminência. Empilhado, o de cima vira o principal.
  it('Google e Apple ficam lado a lado, em colunas iguais', () => {
    expect(scss.replace(/\s+/g, '')).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  });
});
