import fs from 'fs';
import path from 'path';

import { COR_CABECALHO, SOMBRA_DO_BOTAO } from '@maestra/core/constants/design';

// Mesmo papel do `cromoDaBarra.test.ts`, para o cabeçalho: o app nativo não lê CSS, então os
// valores estão duplicados no núcleo, e este teste é o que impede a duplicata de virar
// divergência silenciosa.

const css = fs.readFileSync(
  path.join(__dirname, '..', 'styles', 'gsap-reference.css'),
  'utf8',
);

describe('cromo do cabeçalho', () => {
  it.each(Object.entries(COR_CABECALHO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(css).toContain(valor);
  });

  // A sombra vira objeto no React Native; na web ela é uma string só. Recompõe pra comparar.
  it('a sombra do botão redondo é a mesma', () => {
    const { shadowRadius, shadowOffset, shadowOpacity } = SOMBRA_DO_BOTAO;
    expect(css).toContain(
      `0 ${shadowOffset.height}px ${shadowRadius}px rgba(98, 112, 143, ${String(shadowOpacity).replace(/^0/, '')})`,
    );
  });
});
