import fs from 'fs';
import path from 'path';

import { COR_NYTA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o chat da Nyta.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');
const inicio = css.indexOf('.nyta-surface .nyta-chatArea');
const trecho = css.slice(inicio, css.indexOf('.nyta-surface .nyta-errorBanner', inicio) + 400);

describe('cromo do chat da Nyta', () => {
  it('o trecho foi localizado', () => {
    expect(inicio).toBeGreaterThan(0);
    expect(trecho).toContain('.nyta-bubble');
  });

  it.each(Object.entries(COR_NYTA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(trecho).toContain(valor);
  });

  // O rabinho da bolha é o que diz quem falou. Se os dois cantos virarem iguais, a conversa
  // continua legível mas perde a única pista visual de autoria que não é texto.
  it('as bolhas têm cantos assimétricos, e opostos entre si', () => {
    expect(trecho).toContain('border-radius: 14px 14px 14px 4px');
    expect(trecho).toContain('border-radius: 14px 14px 4px 14px');
  });
});
