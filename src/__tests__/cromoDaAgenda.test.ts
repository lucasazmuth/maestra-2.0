import fs from 'fs';
import path from 'path';

import { COR_AGENDA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para a Agenda — a única tela escura do produto no
// celular. Se algum dia ela clarear na web, este teste falha antes de o app ficar sozinho no
// escuro.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');
const inicio = css.indexOf('.task-app:not(.public-app) .agenda-reference-page');
const trecho = css.slice(inicio);

describe('cromo da agenda', () => {
  it('o trecho da agenda no celular foi localizado', () => {
    expect(inicio).toBeGreaterThan(0);
    expect(trecho).toContain('.agenda-day');
  });

  it.each(Object.entries(COR_AGENDA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(trecho.replace(/\s+/g, '')).toContain(valor.replace(/\s+/g, ''));
  });

  it('a agenda no celular é escura', () => {
    expect(trecho.replace(/\s+/g, '')).toContain(`background:${COR_AGENDA.fundo}!important`);
  });
});
