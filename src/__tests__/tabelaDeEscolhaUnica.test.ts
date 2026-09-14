import fs from 'fs';
import path from 'path';

// ⚠️ A REGRA DESTE COMMIT, E A ÚNICA COISA QUE ELE ENTREGA: os dois renderizadores da tabela de
// escolha única deixam de saber o que é imprensa.
//
// Antes, `type: 'matrix'` não descrevia uma forma — nomeava UMA pergunta. Os dois ficheiros liam
// `IMPRENSA_TIPOS` e `IMPRENSA_PORTES` direto do módulo e ignoravam a definição. A segunda
// pergunta com a mesma forma obrigaria a copiar os dois renderizadores inteiros, e daí em diante
// as cópias divergiriam de um lado só, em silêncio — que é como a web e o app deixam de ter a
// mesma tela sem ninguém reparar.
//
// Este teste é de CROMO: lê os ficheiros. Um teste de comportamento não pega isto, porque um
// renderizador com a lista fixa dentro continua a renderizar a imprensa corretamente.
const raiz = path.join(__dirname, '..', '..');
const RENDERIZADORES: [string, string][] = [
  ['web', path.join(raiz, 'src', 'pages', 'ArtistCreate', 'index.tsx')],
  ['app', path.join(raiz, 'apps', 'mobile', 'src', 'app', 'criar-artista.tsx')],
];
const fontes = RENDERIZADORES.map(([nome, p]) => [nome, fs.readFileSync(p, 'utf8')] as const);

describe('a tabela de escolha única é guiada por dados', () => {
  it.each(fontes)('o renderizador da %s não conhece as listas da imprensa', (_nome, fonte) => {
    expect(fonte).not.toContain('IMPRENSA_TIPOS');
    expect(fonte).not.toContain('IMPRENSA_PORTES');
    expect(fonte).not.toContain('IMPRENSA_NUNCA');
  });

  // A web desestrutura (`const { linhas, colunas, vazio } = cur.tabela`) e o app acessa direto.
  // As duas formas valem; o que não vale é o renderizador não olhar para a definição.
  it.each(fontes)('o renderizador da %s lê as linhas e as colunas da pergunta', (_nome, fonte) => {
    expect(fonte).toMatch(/\.tabela\b/);
    expect(fonte).toMatch(/tabela[!?]?\.linhas|linhas,\s*colunas/);
    expect(fonte).toMatch(/tabela[!?]?\.colunas|linhas,\s*colunas/);
  });

  // A conversão para o valor gravado mora no núcleo, uma vez. Cada lado a reimplementar era como
  // a imprensa acabou com duas descrições da mesma coisa.
  it.each(fontes)('e o valor gravado sai do ajudante do núcleo, na %s', (_nome, fonte) => {
    // ⚠️ A CHAMADA, E NÃO A MENÇÃO. A primeira versão disto procurava o nome, e o nome fica na
    // linha do `import` mesmo depois de o renderizador voltar a decidir por conta própria: as
    // duas mutações que trocavam a chamada por lógica local passavam pelo teste.
    expect(fonte).toMatch(/respostaDaTabela\(/);
    expect(fonte).toMatch(/mapaDaTabela\(/);
    // A marca de cada coluna também: é a regra que se reescreve à mão sem pensar, e basta um dos
    // dois perder o `??` para a tabela abrir diferente na web e no app.
    expect(fonte).toMatch(/colunaMarcada\(/);
    // O formato do payload não é remontado à mão em lado nenhum.
    expect(fonte).not.toMatch(/\{\s*tipo,\s*porte\s*\}/);
  });
});
