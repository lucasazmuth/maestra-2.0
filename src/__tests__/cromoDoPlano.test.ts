import fs from 'fs';
import path from 'path';

import { COR_PLANO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o Plano de Ação.
//
// A folha aqui é a do MÓDULO (`actionPlan.scss`), e não a de referência: o `gsap-reference.css`
// tem um desenho antigo do plano (`.action-strategy-card`, `.action-task-line`, uma linha do
// tempo roxa) que o componente não usa. Cheguei a extrair aquele por engano — o que vale é o
// que a página de fato renderiza.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'ActionPlan', 'actionPlan.scss'), 'utf8',
);

describe('cromo do plano de ação', () => {
  it('a folha é a do módulo, e é ela que desenha o acordeão', () => {
    expect(scss).toContain('.ap-plan-row');
    expect(scss).toContain('.ap-plan-task');
  });

  it.each(Object.entries(COR_PLANO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(scss.replace(/\s+/g, '')).toContain(valor.replace(/\s+/g, ''));
  });
});
