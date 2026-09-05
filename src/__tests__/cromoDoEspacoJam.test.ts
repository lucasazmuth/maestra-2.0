import fs from 'fs';
import path from 'path';

import { COR_JAM } from '@maestra/core/constants/design';

// O Espaço JAM do app nativo tem que ser o MESMO da web no celular.
//
// A web o desenha em `ProjectSpace.module.scss`; o app não lê CSS, então os valores estão
// duplicados em `COR_JAM`. Este teste é o que impede a duplicata de virar divergência.
//
// O recorte da folha inteira é de propósito: a tela empilha painel + chat, e as cores se
// espalham pelas duas metades. O que o teste NÃO consegue provar sozinho é o layout — esse veio
// do DOM computado a 375px, que é a única fonte que resolve `!important` disputando com
// `!important` e media query sobrescrevendo o desktop.

const css = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Catalog', 'ProjectSpace.module.scss'),
  'utf8',
);

/** `rgba(47, 96, 246, .28)` e `rgba(47,96,246,.28)` são a mesma cor. */
const semEspacos = (valor: string) => valor.replace(/\s+/g, '');
const folha = semEspacos(css);

const celular = css.slice(css.indexOf('@media (max-width: 760px)'));

describe('cromo do Espaço JAM', () => {
  it('a folha e o bloco do celular foram localizados', () => {
    expect(css).toContain('.page {');
    expect(celular).toContain('.workspace {');
    expect(celular).toContain('.collabPanel {');
  });

  it.each(Object.entries(COR_JAM))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    // `#ffffff` a folha escreve `#fff` — é a mesma cor, e comparar a forma curta seria dar por
    // igual qualquer cor que comece com f.
    const naFolha = valor === '#ffffff' ? '#fff' : valor;
    expect(folha).toContain(semEspacos(naFolha));
  });

  // Os dois painéis SANGRAM até as bordas: a margem negativa cancela o recuo da página. Sem
  // isso a tela ganha duas molduras que não separam nada — e foi o que o desktop desenhou.
  it('painel e chat sangram até as bordas, e sem borda lateral', () => {
    expect(celular).toContain('margin-right: -18px');
    expect(celular).toContain('margin-left: -18px');
    expect(celular).toContain('border-right: 0');
    expect(celular).toContain('border-left: 0');
  });

  // A ficha técnica é 2×2, não uma coluna: os quatro campos quase sempre estão vazios, e
  // empilhados viravam uma faixa morta antes de chegar nas versões, que são o assunto da tela.
  it('a ficha técnica é de duas colunas no celular', () => {
    expect(celular).toContain('grid-template-columns: 1fr 1fr');
    expect(celular).toContain('.metaStrip label:nth-child(2n)');
    expect(celular).toContain('.metaStrip label:nth-child(n + 3)');
  });

  // A etiqueta "ESPAÇO JAM" sai do centro absoluto e vira um kicker no topo — no desktop ela é
  // posicionada em absoluto e cairia EM CIMA da pílula de status quando o cabeçalho quebra.
  it('a etiqueta vira kicker acima do cabeçalho', () => {
    expect(celular).toContain('position: static');
    expect(celular).toContain('order: 0');
    expect(celular).toContain('width: 100%');
  });

  // A ordem da linha é a de leitura: [voltar] título [status] [editar].
  it('a linha do cabeçalho segue a ordem de leitura', () => {
    expect(celular).toContain('.back { order: 1; }');
    expect(celular).toContain('.titleBlock { order: 2;');
    expect(celular).toContain('.editProject { order: 4; }');
  });
});
