import fs from 'fs';
import path from 'path';

import { COR_PAINEL } from '@maestra/core/constants/design';

// Mesmo papel dos testes de cromo da barra e do cabeçalho, para a home do artista.
//
// A Visão geral mantém a leitura operacional; os indicadores e a lista de lançamentos vivem
// nos módulos específicos para não duplicar a tela inicial.

const ler = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const css = ler('styles', 'gsap-reference.css');
const dashboard = ler('pages', 'Dashboard', 'index.tsx');
// O CSS de referência tem trechos minificados (`rgba(51,97,255,.32)`) e trechos formatados
// (`rgba(255, 255, 255, .13)`). Comparar sem os espaços evita um teste que falha por
// espaçamento em vez de por cor.
const semEspacos = (t: string) => t.replace(/\s+/g, '');
const fontes = semEspacos(css + dashboard);

describe('cromo do painel do artista', () => {
  it.each(Object.entries(COR_PAINEL))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(fontes).toContain(semEspacos(valor));
  });

  it('não duplica a lista de músicas lançadas na visão geral', () => {
    expect(dashboard).not.toContain('Músicas lançadas');
  });
});
