import fs from 'fs';
import path from 'path';

import { COR_PILARES } from '@maestra/core/constants/design';

// Os três pilares da home têm que ser os MESMOS nas duas superfícies: a web pinta por SCSS, o app
// por `COR_PILARES`, e este arquivo é o que impede a duplicata de virar divergência.
//
// Aqui há duas famílias de cor, e é de propósito: o FUNDO é o gradiente escuro escolhido para
// cada cartão, e o acento do pilar (`COR_PILARES`) aparece no ícone. Se alguém reintroduzir o
// fundo navy antigo por cima dos gradientes, este teste cai junto.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'dashboard', 'PillarCards.module.scss'),
  'utf8',
);
const tsx = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'dashboard', 'PillarCards.tsx'),
  'utf8',
);
const semEspacos = (valor: string) => valor.replace(/\s+/g, '');

describe('cromo dos pilares do painel', () => {
  it.each(Object.entries(COR_PILARES))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(semEspacos(scss)).toContain(semEspacos(valor));
  });

  it.each(['Dark Gradient 04', 'Dark Gradient 12', 'Dark Gradient 05'])(
    'usa o background enviado (%s)',
    (nome) => {
      expect(scss).toContain(nome);
    },
  );

  it('não reintroduz o background navy anterior no campo do cartão', () => {
    expect(semEspacos(scss)).not.toContain('linear-gradient(135deg,#121c38,#18254d)');
    expect(semEspacos(scss)).not.toContain('radial-gradient(circleat76%-66%,#315de8');
  });

  // O roxo da marca só pode entrar como acento do ícone. Se ele aparecer num `background`, alguém
  // misturou o token institucional com o gradiente importado.
  it('o roxo institucional é acento, nunca background', () => {
    const linhasComRoxo = scss.split('\n').filter((l) => l.includes(COR_PILARES.anelPlanejamento));
    expect(linhasComRoxo.length).toBeGreaterThan(0);
    linhasComRoxo.forEach((linha) => {
      expect(linha).not.toMatch(/background/);
    });
  });

  // O cartão inteiro é o alvo do clique. Um cartão desta altura cujo único alvo fosse o texto da
  // ação seria caça ao botão no celular, e estes três são o único caminho para os módulos.
  it('o cartão inteiro é clicável e alcançável pelo teclado', () => {
    expect(tsx).toContain("role='button'");
    expect(tsx).toContain('tabIndex={0}');
    expect(tsx).toContain('onKeyDown');
  });
});
