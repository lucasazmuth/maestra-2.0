import fs from 'fs';
import path from 'path';

import { COR_PERFIS, COR_PLANO_DA_CONTA } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para a lista de perfis.
//
// A folha da PÁGINA não basta: o topo (marca, selo do plano, os dois botões redondos e o painel
// do menu do sistema) é o `top-navigation` global, que vive no `gsap-reference.css`, e o painel
// tem folha própria. Conferir só a primeira deixava o cabeçalho inteiro fora do teste — e foi
// exatamente ali que o app divergiu: ícone de pessoa no lugar da grade, balão vermelho com
// número no lugar do ponto rosa, e a palavra "Maestra" escrita numa fonte em vez do lettering.
const scss = [
  fs.readFileSync(path.join(__dirname, '..', 'pages', 'Artists', 'Artists.module.scss'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8'),
  fs.readFileSync(
    path.join(__dirname, '..', 'components', 'Layout', 'components', 'SystemMenu', 'SystemMenu.module.scss'),
    'utf8',
  ),
  fs.readFileSync(path.join(__dirname, '..', 'components', 'PlanTag', 'PlanTag.module.scss'), 'utf8'),
].join('\n');

describe('cromo da lista de perfis', () => {
  it.each(Object.entries(COR_PERFIS))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    // `#ffffff` a folha escreve `#fff`.
    expect(scss.replace(/\s+/g, '')).toContain(
      (valor === '#ffffff' ? '#fff' : valor).replace(/\s+/g, ''),
    );
  });

  // Os dois erros do topo que o lado a lado mostrou, e que este teste passa a guardar.
  //
  // O segundo botão redondo é o gatilho do MENU DO SISTEMA (a grade), e não um atalho para a
  // conta: a conta é um item dentro dele. O app levava direto, com um ícone de pessoa.
  it('o segundo botão do topo é o gatilho do menu do sistema', () => {
    const menu = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'Layout', 'components', 'SystemMenu', 'index.tsx'),
      'utf8',
    );
    expect(menu).toContain('FiGrid');
    expect(menu).toContain("label: 'Configurações'");
    expect(menu).toContain("label: 'Sair da conta'");
  });

  it('o não-lidas do sino é um ponto ROSA sem número', () => {
    const semEspacos = scss.replace(/\s+/g, '');
    expect(semEspacos).toContain('.notification.has-unread::before');
    expect(semEspacos).toContain('background:#e62e7b');
    // Sem `content` de texto: o balão com número é invenção do app.
    expect(semEspacos).toContain('content:\'\';position:absolute');
  });

  it.each(Object.entries(COR_PLANO_DA_CONTA))('o selo do plano: %s (%s)', (_nome, valor) => {
    const selo = fs.readFileSync(
      path.join(__dirname, '..', 'components', 'PlanTag', 'PlanTag.module.scss'), 'utf8',
    );
    expect(selo.replace(/\s+/g, '')).toContain(valor.replace(/\s+/g, ''));
  });

  // O cartão é CENTRADO com a foto grande no meio — não uma linha com miniatura à esquerda.
  // É a diferença entre "escolher um perfil" e "percorrer uma lista".
  it('o cartão é centrado, com foto de 140px', () => {
    const semEspacos = scss.replace(/\s+/g, '');
    expect(semEspacos).toContain('width:140px');
    expect(semEspacos).toContain('text-align:center');
  });
});
