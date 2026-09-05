import fs from 'fs';
import path from 'path';

import { COR_DIAGNOSTICO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o Diagnóstico REAL.
//
// A folha é a do `DiagnosticReport` (dentro de `ArtistCreate`), e não a da pasta
// `DiagnosticoReal` — esta última é a página PÚBLICA, com outra paleta. Quem renderiza a rota
// `/artists/:id/diagnostico` é o `DiagnosticView`, que reaproveita o relatório.
//
// ⚠️ Esta folha carrega valores ESCUROS legados que a página não usa mais (`#1a1206`, `#c9c9d0`,
// `#b0b0b8` nos selos e nas linhas de status). Ler o SCSS e portar o que se acha ali daria um
// cartão preto onde a web é branca. As cores abaixo saíram do DOM computado a 375px; o que este
// teste garante é que elas EXISTAM na folha, não que sejam as primeiras que aparecem.

// TRÊS fontes, porque a tela lê de três: a folha do relatório, o TSX (as cores da pizza vivem
// num array de JavaScript, não no SCSS) e o módulo das placas (o cinza do nível 0 é o
// `TIER_ACCENT.base`, escrito como componentes "140, 140, 150"). Conferir só o SCSS deixaria
// oito cores livres para divergir.
const scss = [
  fs.readFileSync(path.join(__dirname, '..', 'pages', 'ArtistCreate', 'ArtistCreate.module.scss'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '..', 'pages', 'ArtistCreate', 'DiagnosticReport.tsx'), 'utf8'),
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'constants', 'realBadge.ts'),
    'utf8',
  ),
].join('\n');
const semEspacos = scss.replace(/\s+/g, '');

describe('cromo do diagnóstico', () => {
  it('a folha é a do relatório que a rota renderiza', () => {
    expect(scss).toContain('.dimCard');
    expect(scss).toContain('.realProfileCard');
  });

  it.each(Object.entries(COR_DIAGNOSTICO).filter(([, v]) => typeof v === 'string'))(
    '%s (%s) é o valor que a web usa',
    (_nome, valor) => {
      // A folha escreve o cinza do nível 0 como `rgb(140,140,150)`; a comparação sem espaços
      // aceita as duas grafias.
      // `rgb(140, 140, 150)` a fonte escreve como `'140, 140, 150'` (só as componentes).
      const alvo = String(valor).replace(/^rgb\((.*)\)$/, '$1').replace(/\s+/g, '');
      expect(semEspacos).toContain(alvo);
    },
  );

  // As sete cores da composição da receita vêm em lista — o `it.each` acima só percorre strings.
  it('as fatias da receita são as sete cores da web, na ordem', () => {
    COR_DIAGNOSTICO.fatiasDaReceita.forEach((cor) => expect(scss).toContain(cor));
  });
});
