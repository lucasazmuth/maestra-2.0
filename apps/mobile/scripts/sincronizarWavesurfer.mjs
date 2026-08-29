import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gera `src/casca/jam/wavesurfer.gerado.ts` a partir do wavesurfer.js que a WEB usa.
//
// A onda do app é desenhada pela MESMA biblioteca da web, dentro de um WebView — é a única
// forma de ela ser igual de verdade, e não parecida. Como a página do WebView não pode buscar
// nada na rede, o script precisa ir junto, embutido.
//
// O arquivo é gerado, e não escrito à mão: `src/__tests__/copiaDoWavesurfer.test.ts` compara o
// conteúdo com o do pacote instalado, então uma atualização do wavesurfer que não passe por
// aqui quebra o teste em vez de deixar as duas superfícies desenhando versões diferentes.

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..', '..', '..');

const origem = path.join(raiz, 'node_modules', 'wavesurfer.js', 'dist', 'wavesurfer.min.js');
const destino = path.join(aqui, '..', 'src', 'casca', 'jam', 'wavesurfer.gerado.ts');

const codigo = fs.readFileSync(origem, 'utf8');
const versao = JSON.parse(
  fs.readFileSync(path.join(raiz, 'node_modules', 'wavesurfer.js', 'package.json'), 'utf8'),
).version;

fs.writeFileSync(destino, [
  '// GERADO por `npm run wavesurfer:sync`. Não edite à mão.',
  '//',
  `// wavesurfer.js ${versao}, o mesmo que a web importa. O código vai embutido porque a página`,
  '// do WebView não busca nada na rede — e porque a onda só é IGUAL à da web se for a mesma',
  '// biblioteca desenhando.',
  '',
  `export const WAVESURFER = ${JSON.stringify(codigo)};`,
  '',
].join('\n'));

process.stdout.write(`wavesurfer.js ${versao} -> ${path.relative(raiz, destino)}\n`);
