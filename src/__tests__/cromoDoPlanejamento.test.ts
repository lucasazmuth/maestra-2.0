import fs from 'fs';
import path from 'path';

import { COR_MAPA, COR_PLANEJAMENTO, CORES_SWOT } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o Plano estratégico e o mapa de referências.

const ler = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const css = ler('styles', 'gsap-reference.css');
const pagina = ler('pages', 'Profile', 'index.tsx');

const cores = (o: object): string[] =>
  Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : cores(v)));

describe('cromo do plano estratégico', () => {
  it.each(cores(COR_PLANEJAMENTO).map((c) => [c]))('%s é um valor que a web usa', (valor) => {
    expect(css).toContain(valor);
  });

  it.each(cores(COR_MAPA).map((c) => [c]))('%s é uma cor do mapa na web', (valor) => {
    expect(css).toContain(valor);
  });

  // A ORDEM é o que dá sentido: azul = Forças, laranja = Fraquezas, verde = Oportunidades,
  // rosa = Ameaças. Trocar duas não mudaria nenhuma cor e inverteria a leitura do quadro.
  it('as cores do SWOT estão na mesma ordem da web', () => {
    expect(pagina).toContain(`[${CORES_SWOT.map((c) => `'${c}'`).join(', ')}]`);
  });
});
