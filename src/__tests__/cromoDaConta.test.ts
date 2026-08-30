import fs from 'fs';
import path from 'path';

import { COR_CONTA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para Configurações.
//
// São DUAS folhas porque a tela leva a duas: as Configurações em si vivem no
// `gsap-reference.css`, e os quatro tons do status de um pagamento vivem no
// `Payments.module.scss` — o Histórico de pagamentos é uma página própria, alcançada por uma
// linha daqui. Conferir só a primeira deixaria os tons livres para divergir, que foi
// exatamente o que aconteceu: eu inventei os quatro.

const css = [
  fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '..', 'pages', 'Payments', 'Payments.module.scss'), 'utf8'),
].join('\n');

describe('cromo das configurações', () => {
  it.each(Object.entries(COR_CONTA))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(css).toContain(valor);
  });

  // "Pago", "Pendente" e "Vencido" precisam ser distinguíveis — os três num cinza só apagariam
  // a única informação que a linha do pagamento carrega além do valor.
  it('os quatro tons de status são quatro cores diferentes', () => {
    expect(new Set([
      COR_CONTA.pagoTom, COR_CONTA.atencaoTom, COR_CONTA.perigoTom, COR_CONTA.neutroTom,
    ]).size).toBe(4);
  });

  // O cartão de Configurações é do MESMO cinza do fundo, com contorno e sem sombra — o oposto
  // do cartão branco elevado que a mesma classe usa no desktop.
  it('o cartão é cinza com contorno, e não branco com sombra', () => {
    const semEspacos = css.replace(/\s+/g, '');
    expect(semEspacos).toContain('.settings-page.settings-gridarticle');
    expect(semEspacos).toContain('box-shadow:none');
  });
});
