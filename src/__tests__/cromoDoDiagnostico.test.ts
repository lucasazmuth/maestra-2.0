import fs from 'fs';
import path from 'path';

import { COR_DIAGNOSTICO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o Diagnóstico REAL.
//
// A folha é a do `DiagnosticReport` (dentro de `ArtistCreate`), e não a da pasta
// `DiagnosticoReal` — esta última é a página PÚBLICA, com outra paleta. Quem renderiza a rota
// `/artists/:id/diagnostico` é o `DiagnosticView`, que reaproveita o relatório.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'ArtistCreate', 'ArtistCreate.module.scss'), 'utf8',
);

describe('cromo do diagnóstico', () => {
  it('a folha é a do relatório que a rota renderiza', () => {
    expect(scss).toContain('.dimCard');
    expect(scss).toContain('.realProfileCard');
  });

  it.each(Object.entries(COR_DIAGNOSTICO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(scss).toContain(valor);
  });
});
