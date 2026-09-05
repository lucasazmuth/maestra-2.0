import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gera `src/casca/checkout/confete.gerado.ts` a partir do confete que a WEB usa.
//
// A tela de sucesso do app é a mesma da web: o fundo com as auroras (o SVG) e o confete
// desenhado em canvas. Os dois rodam dentro de um WebView, porque é a única forma de serem
// IGUAIS — o canvas é o mesmo código, e o fundo é o mesmo arquivo.
//
// A página do WebView não busca nada na rede, então tudo vai embutido: o script e o SVG como
// data URI. `src/__tests__/copiaDoConfete.test.ts` compara o gerado com as origens, então uma
// mudança na web que não passe por aqui quebra o teste em vez de deixar as duas telas
// comemorando de jeitos diferentes.

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..', '..', '..');

const origemDoScript = path.join(raiz, 'src', 'components', 'confeteCanvas.js');
const origemDoFundo = path.join(raiz, 'src', 'assets', 'dark-gradient-bg.svg');
const destino = path.join(aqui, '..', 'src', 'casca', 'checkout', 'confete.gerado.ts');

// O arquivo vai INTEIRO, sem transformação nenhuma: ele termina num `module.exports` guardado
// por `typeof module`, que no WebView não faz nada. Assim o embutido é byte a byte o da web, e
// o teste que compara os dois é uma igualdade simples.
const script = fs.readFileSync(origemDoScript, 'utf8');
const fundo = fs.readFileSync(origemDoFundo);

fs.writeFileSync(destino, [
  '// GERADO por `npm run confete:sync`. Não edite à mão.',
  '//',
  '// O confete e o fundo da tela de sucesso, os MESMOS da web: `src/components/confeteCanvas.js`',
  '// e `src/assets/dark-gradient-bg.svg`. Vão embutidos porque a página do WebView não busca',
  '// nada na rede.',
  '',
  `export const CONFETE = ${JSON.stringify(script)};`,
  '',
  `export const FUNDO_DA_COMEMORACAO = ${JSON.stringify(`data:image/svg+xml;base64,${fundo.toString('base64')}`)};`,
  '',
].join('\n'));

process.stdout.write(
  `confete (${script.length} B) + fundo (${fundo.length} B) -> ${path.relative(raiz, destino)}\n`,
);
