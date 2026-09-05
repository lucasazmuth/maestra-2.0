import fs from 'fs';
import path from 'path';

import { COR_PAINEL, CORES_DOS_LANCAMENTOS, CORES_DOS_NUMEROS } from '@maestra/core/constants/design';

// Mesmo papel dos testes de cromo da barra e do cabeçalho, para a home do artista.
//
// Aqui as cores vêm de DOIS lugares: o CSS de referência desenha os cartões, e o próprio
// Dashboard carrega as cores das bolinhas e das faixas em arrays inline. O app precisa bater com
// os dois, então o teste lê os dois.

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

  // A ORDEM importa tanto quanto os valores: a bolinha verde é a de ouvintes, a azul a de
  // seguidores, e assim por diante. Trocar a ordem não mudaria nenhuma cor e mudaria o sentido.
  it('as bolinhas dos números estão na mesma ordem da web', () => {
    expect(semEspacos(dashboard)).toContain(semEspacos(`[${CORES_DOS_NUMEROS.map((c) => `'${c}'`).join(', ')}]`));
  });

  // As duas primeiras faixas saem do array do Dashboard; a 3ª e a 4ª o CSS sobrescreve por
  // `nth-child`. É por isso que esta lista NÃO é igual à de lá — e é o tipo de detalhe que se
  // perde numa releitura.
  it('as faixas lançadas usam as cores que de fato aparecem', () => {
    expect(dashboard).toContain(`'${CORES_DOS_LANCAMENTOS[0]}'`);
    expect(dashboard).toContain(`'${CORES_DOS_LANCAMENTOS[1]}'`);
    expect(semEspacos(css)).toContain(semEspacos(`button:nth-child(3) { background: ${CORES_DOS_LANCAMENTOS[2]}; }`));
    expect(semEspacos(css)).toContain(semEspacos(`button:nth-child(4) { background: ${CORES_DOS_LANCAMENTOS[3]}; }`));
  });
});
