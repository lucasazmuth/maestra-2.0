import fs from 'fs';
import path from 'path';

const menuScss = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'dashboard', 'PillarCards.module.scss'),
  'utf8',
);
const menuTsx = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'dashboard', 'PillarCards.tsx'),
  'utf8',
);
const dashboardTsx = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Dashboard', 'index.tsx'),
  'utf8',
);
const dashboardCss = fs.readFileSync(
  path.join(__dirname, '..', 'styles', 'gsap-reference.css'),
  'utf8',
);

describe('menu do método no painel', () => {
  it.each(['Visão geral', 'Diagnóstico', 'Plano de Ação', 'Planejamento'])(
    'expõe a aba %s',
    (rotulo) => expect(menuTsx).toContain(rotulo),
  );

  it('usa navegação semântica e botões nativos', () => {
    expect(menuTsx).toContain("<nav className={styles.menu} aria-label='Áreas do método'>");
    expect(menuTsx).toContain("type='button'");
    expect(menuTsx).toContain("aria-current={ativa === item.chave ? 'page' : undefined}");
  });

  it('troca a seção dentro do dashboard sem navegar', () => {
    expect(menuTsx).toContain('onClick={() => onSelect(item.chave)}');
    expect(dashboardTsx).toContain("useState<SecaoDoPainel>('visao-geral')");
    expect(dashboardTsx).toContain('pilarAtivo ?');
  });

  it('mantém o menu rolável no celular e sinaliza a aba ativa', () => {
    expect(menuScss).toContain('overflow-x: auto');
    expect(menuScss).toContain('.menu button.ativo::after');
    expect(menuScss).toContain('@media (max-width: 700px)');
  });

  it.each(['Dark Gradient 04', 'Dark Gradient 12', 'Dark Gradient 05'])(
    'preserva o background aprovado no painel %s',
    (nome) => expect(dashboardCss).toContain(nome),
  );

  it('tem painéis internos para diagnóstico, execução e planejamento', () => {
    expect(dashboardTsx).toContain("pilar.chave === 'diagnostico'");
    expect(dashboardTsx).toContain("pilar.chave === 'execucao'");
    expect(dashboardTsx).toContain("pilar.chave === 'planejamento'");
  });
});
