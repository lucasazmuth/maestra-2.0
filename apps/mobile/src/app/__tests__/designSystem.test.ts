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
