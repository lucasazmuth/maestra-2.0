import fs from 'fs';
import path from 'path';

import { COR } from '@maestra/core/constants/design';

// O app tem que parecer o mesmo produto que a web.
//
// A ligação com a web é feita por `src/__tests__/designSystem.test.ts`, no app web: ele compara
// os tokens do núcleo com o que o `ConfigProvider` declara. O que ESTE teste garante é o elo
// seguinte — que as telas do app usem os tokens, e não cores próprias.
//
// Sem ele, a divergência volta pela porta dos fundos: basta alguém escrever `#6b7280` numa tela
// nova, e a partir daí o app tem duas paletas. Foi exatamente assim que as primeiras telas
// nasceram com o roxo institucional como cor de ação e com uma escala de cinzas que não existe
// em lugar nenhum do produto.

// O emblema da Nyta é a única exceção: o degradê roxo dele (#a143ff -> #7420f1) é a marca da
// Nyta, vem literal do SVG do design e não existe como token. Ele não fica solto por isso —
// `src/__tests__/emblemaNyta.test.ts`, no app web, compara os dois arquivos.
const LIBERADOS = ['EmblemaNyta.tsx'];

const telas = () => {
  // A casca entra junto: o cabeçalho e a barra de abas são onde as cores da navegação vivem
  // agora, e deixá-los de fora seria abrir a porta que este teste existe pra fechar.
  const raizes = [path.join(__dirname, '..'), path.join(__dirname, '..', '..', 'casca')];
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name !== '__tests__') andar(caminho);
      } else if (item.name.endsWith('.tsx') && !LIBERADOS.includes(item.name)) {
        achados.push(caminho);
      }
    }
  };
  raizes.forEach(andar);
  return achados;
};

describe('as telas usam o sistema visual, não cores próprias', () => {
  it.each(telas().map((t) => [path.basename(path.dirname(t)) + '/' + path.basename(t), t]))(
    '%s não declara cor literal',
    (_nome, caminho) => {
      const fonte = fs.readFileSync(caminho, 'utf8');
      // Ignora o que está em comentário: explicar de onde veio um valor é útil.
      const semComentarios = fonte
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const literais = semComentarios.match(/['"]#[0-9a-fA-F]{3,8}['"]/g) ?? [];
      expect(literais).toEqual([]);
    }
  );

  // A troca mais fácil de fazer sem perceber, e a que mais desfigura o produto.
  it('a cor de ação é o azul, e não o roxo institucional', () => {
    expect(COR.primaria).toBe('#3361ff');
    expect(COR.marca).toBe('#9A4FD1');
  });
});

// AS PÁGINAS DE APOIO TÊM UM CABEÇALHO SÓ.
//
// Notificações, Histórico de pagamentos, Suporte, Termos e Política são as telas FOLHA do
// usuário: entra-se por um caminho, lê-se, e volta-se. Todas mostram a mesma coisa no topo — o
// botão redondo de voltar, o sobretítulo, o título grande.
//
// ⚠️ ESCRITO À MÃO, ISSO VIRA CINCO DESENHOS COM O MESMO NOME. Já aconteceu neste app do lado dos
// módulos do artista, e o `CabecalhoDoModulo` existe por causa disso — o comentário dele conta:
// "título 27 num, 30 noutro; espaçamento de letra só num deles... todas juntas dão a impressão
// de telas escritas por gente diferente, que é exatamente o que eram".
//
// A divergência já tinha começado aqui antes de a regra existir: o sobretítulo do Histórico
// estava a 9 e o das Notificações a 10, com paletas diferentes para a mesma linha.
describe('as páginas de apoio compartilham o cabeçalho', () => {
  const AS_PAGINAS = [
    ['notificacoes.tsx', path.join('notificacoes.tsx')],
    ['pagamentos.tsx', path.join('pagamentos.tsx')],
    ['suporte.tsx', path.join('suporte.tsx')],
    ['legal/[slug].tsx', path.join('legal', '[slug].tsx')],
  ] as const;

  it.each(AS_PAGINAS)('%s usa o CabecalhoDaPagina', (_nome, relativo) => {
    const fonte = fs.readFileSync(path.join(__dirname, '..', relativo), 'utf8');

    expect(fonte).toContain('CabecalhoDaPagina');
    // E não desenha o seu: um título de 27 escrito na própria tela é como as cinco cópias
    // começam. O componente é o único lugar onde esse número existe.
    expect(fonte).not.toMatch(/fontSize: 27/);
    // Nem o botão de voltar em texto, que é o desenho anterior ("‹ Voltar", "‹ Conta").
    expect(fonte).not.toContain('‹');
  });

  it('o cabeçalho desenha o que as telas deixaram de desenhar', () => {
    const comum = fs.readFileSync(
      path.join(__dirname, '..', '..', 'casca', 'CabecalhoDaPagina.tsx'), 'utf8',
    );

    // ⚠️ O USO, E NÃO O IMPORT. A primeira versão disto procurava `CabecalhoDeVolta` solto —
    // e a linha do `import` já casava com isso, então apagar o botão do JSX deixava a regra
    // verde. A mutação que o apagou sobreviveu, que é como se descobre um caso destes.
    expect(comum).toContain('<CabecalhoDeVolta');
    expect(comum).toMatch(/fontSize: 27/);
    expect(comum).toContain('COR_CABECALHO_DE_APOIO');
  });
});
