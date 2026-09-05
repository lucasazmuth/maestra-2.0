import fs from 'fs';
import path from 'path';

import { COR_EM_BREVE } from '@maestra/core/constants/design';

// O "em breve" do Marketing é uma tela de tipografia e fios, com uma escala de cinzas própria.
// Mesmo molde dos outros testes de cromo: o app duplica os valores porque não lê CSS, e este
// teste é o que impede a duplicata de derivar.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');
const inicio = css.indexOf('.marketing-empty {');
const trecho = css.slice(inicio, css.indexOf('@media', inicio));

describe('cromo do "em breve"', () => {
  it('o trecho foi localizado', () => {
    expect(inicio).toBeGreaterThan(0);
    expect(trecho).toContain('.marketing-coming-list');
  });

  it.each(Object.entries(COR_EM_BREVE))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(trecho).toContain(valor);
  });
});
