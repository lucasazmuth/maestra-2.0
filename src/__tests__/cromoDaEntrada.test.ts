import fs from 'fs';
import path from 'path';

import { COR_ENTRADA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para as telas de autenticação.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Login', 'AuthShell.module.scss'), 'utf8',
);

// O botão social do app nativo é desenhado pela Apple: contorno preto sobre branco, e a diretriz
// 4.8 exige que o do Google fique idêntico a ele. Na web os dois seguem o cromo do formulário
// (contorno #dce5f0 sobre #fff), que é o que o resto da tela usa. São dois cromos legítimos, então
// estes dois tokens não têm par na folha da web — o resto do objeto tem.
const SO_DO_APP_NATIVO = ['socialContorno', 'socialFundo'];

describe('cromo da entrada', () => {
  const daWeb = Object.entries(COR_ENTRADA).filter(([nome]) => !SO_DO_APP_NATIVO.includes(nome));
  it.each(daWeb)('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(scss.replace(/\s+/g, '')).toContain(valor.replace(/\s+/g, ''));
  });

  // Duas colunas iguais para os logins sociais é exigência da diretriz 4.8 da App Store: o
  // Sign in with Apple precisa da mesma proeminência. Empilhado, o de cima vira o principal.
  it('Google e Apple ficam lado a lado, em colunas iguais', () => {
    expect(scss.replace(/\s+/g, '')).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  });
});
