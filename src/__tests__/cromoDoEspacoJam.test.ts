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

const ler = (...partes: string[]) => fs.readFileSync(path.join(__dirname, '..', ...partes), 'utf8');

const css = ler('pages', 'Catalog', 'ProjectSpace.module.scss');
/** O editor de pistas tem folha própria: são ~300 linhas que não são do resto da tela. */
const cssDaMesa = ler('pages', 'Catalog', 'mesa', 'mesa.module.scss');
// O `cabecaDaVersao` é o fundo dos blocos DENTRO das folhas e dos modais. No app quem o usa é a
// `Folha`; na web, o `StandardModal`. Por isso ele entra na conta a partir daqui, e não da folha
// do Espaço JAM — que deixou de o ter quando os cartões de versão saíram.
const cssDosModais = ler('components', 'StandardModal.module.scss');

/** Só as regras: os comentários NOMEIAM o que saiu, e nomear não é declarar. */
const semComentarios = (valor: string) => valor.replace(/\/\/.*$/gm, '');

/** `rgba(47, 96, 246, .28)` e `rgba(47,96,246,.28)` são a mesma cor. */
const semEspacos = (valor: string) => valor.replace(/\s+/g, '');
const folha = semEspacos(css + cssDaMesa + cssDosModais);

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

  // A faixa de quatro campos (BPM, tom, gênero, lançamento) SAIU das duas superfícies. BPM e
  // tom subiram para o cabeçalho, com o rótulo a dizer de que gravação são; gênero e data
  // ficaram na ficha, que a linha-resumo abre — e agora essa linha aparece em toda largura,
  // porque não há mais nada a disputar com ela.
  it('a faixa de quatro campos não existe, e a linha-resumo vale em toda a largura', () => {
    expect(semComentarios(css)).not.toContain('.metaStrip');
    const resumo = css.slice(css.indexOf('.fichaResumo {'));
    expect(resumo).toMatch(/^\.fichaResumo \{\s*display: flex;/);
  });

  // Os campos do cabeçalho, e a linha que diz de quem são os números — que é o que resolve a
  // confusão pela qual eles tinham sido escondidos.
  it('o cabeçalho tem os campos da gravação e o rótulo do dono', () => {
    expect(css).toContain('.headerField {');
    expect(css).toContain('.fieldOwner {');
  });

  // A lista de cartões saiu: cada um com o seu play e a sua onda desenhava as gravações como
  // coisas que tocam ao mesmo tempo, e elas são alternativas.
  it('a lista de cartões de versão não está mais na folha', () => {
    expect(semComentarios(css))
      .not.toMatch(/\.versionList\b|\.versionPlayback\b|\.versionFooter\b|\.waveOpen\b/);
  });

  // ⚠️ Mutar e solar têm CORES DIFERENTES, e isso não é gosto: são as duas ações mais usadas de
  // uma mesa e são opostas. Pintadas iguais quando ativas, ninguém sabe qual carregou.
  it('mutar é cinza e solar é âmbar', () => {
    expect(semEspacos(cssDaMesa)).toContain('.chaveMuda{background:#b7c4da');
    expect(semEspacos(cssDaMesa)).toContain('.chaveSolo{background:#e0ad3c');
  });

  // 34px, e não os 20 da referência que inspirou a tela: 20 é menor que qualquer mínimo de
  // toque, e justamente nos dois botões que mais se usam.
  it('os alvos de mutar e solar têm 34px', () => {
    const chave = cssDaMesa.slice(cssDaMesa.indexOf('.chave {'));
    expect(chave).toMatch(/^\.chave \{\s*width: 34px;\s*height: 34px;/);
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
