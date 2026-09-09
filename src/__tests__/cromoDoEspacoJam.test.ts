import fs from 'fs';
import path from 'path';

import { COR_JAM } from '@maestra/core/constants/design';

// O Espaço JAM do app nativo tem que ser o MESMO da web no celular.
//
// A web o desenha em `ProjectSpace.module.scss`; o app não lê CSS, então os valores estão
// duplicados em `COR_JAM`. Este teste é o que impede a duplicata de virar divergência.
//
// O que o teste NÃO consegue provar sozinho é o layout — esse veio do DOM computado a 375px,
// que é a única fonte que resolve `!important` disputando com `!important` e media query
// sobrescrevendo o desktop.
//
// O chat do projeto saiu das duas superfícies em 09/09/2026; este teste é também o que impede
// a sua casca (`.collabPanel`, `.chat*`) de voltar por acidente à folha.

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
  });

  // O chat saiu. A coluna de 330px que ele ocupava também: é uma coluna só, centrada.
  it('o chat do projeto não está na folha, nem a coluna dele', () => {
    expect(css).not.toMatch(/\.collabPanel\b|\.chatMessages\b|\.chatComposer\b/);
    expect(css).not.toContain('330px');
  });

  it.each(Object.entries(COR_JAM))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    // `#ffffff` a folha escreve `#fff` — é a mesma cor, e comparar a forma curta seria dar por
    // igual qualquer cor que comece com f.
    const naFolha = valor === '#ffffff' ? '#fff' : valor;
    expect(folha).toContain(semEspacos(naFolha));
  });

  // O painel SANGRA até as bordas: a margem negativa cancela o recuo da página. Sem isso a
  // tela ganha uma moldura que não separa nada — é o único bloco.
  it('o painel sangra até as bordas, e sem borda lateral', () => {
    expect(celular).toContain('margin-right: -18px');
    expect(celular).toContain('margin-left: -18px');
    expect(celular).toContain('border-right: 0');
    expect(celular).toContain('border-left: 0');
  });

  // No celular a faixa de quatro campos SOME e entra a linha-resumo. A faixa custava 153px e
  // quase sempre mostrava quatro traços — o bloco mais alto e mais vazio da tela. No desktop
  // ela fica: a 960px não é o problema, e a edição inline é boa lá.
  it('no celular a faixa some e a linha-resumo entra', () => {
    const faixa = celular.slice(celular.indexOf('.metaStrip {'));
    expect(faixa).toMatch(/^\.metaStrip \{\s*display: none;/);
    const resumo = celular.slice(celular.indexOf('.fichaResumo {'));
    expect(resumo).toMatch(/^\.fichaResumo \{\s*display: flex;/);
    // E fora do celular é o contrário: a linha começa escondida.
    const desktop = css.slice(css.indexOf('.fichaResumo {'), css.indexOf('@media'));
    expect(desktop).toMatch(/^\.fichaResumo \{\s*display: none;/);
  });

  // O kicker "Espaço JAM" saiu: a seta e a origem já dizem onde se está, e o título ganhou a
  // largura que a etiqueta central lhe roubava — em duas linhas, e não uma com reticências.
  it('sem kicker, e o título em duas linhas', () => {
    expect(css).not.toContain('.spaceLabel');
    expect(folha).toContain('-webkit-line-clamp:2');
    expect(folha).not.toContain('max-width:calc(50%-116px)');
  });

  // O status é um chip de 28px numa segunda linha, e não uma pílula de 188px na fila do título.
  it('o status é um chip, fora da fila do título', () => {
    expect(css).toContain('.secondLine {');
    expect(folha).not.toContain('min-width:188px');
    expect(folha).toContain('.statusPill{min-width:0;height:28px');
  });
});
