import fs from 'fs';
import path from 'path';

import { COR_NOTIFICACOES } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para a caixa de notificações.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');
const inicio = css.indexOf('.notifications-list {');
const trecho = css.slice(inicio, inicio + 3000);

describe('cromo das notificações', () => {
  it('o trecho da lista foi localizado', () => {
    expect(inicio).toBeGreaterThan(0);
    expect(trecho).toContain('.notifications-list article');
  });

  it.each(Object.entries(COR_NOTIFICACOES))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(trecho).toContain(valor);
  });
});
