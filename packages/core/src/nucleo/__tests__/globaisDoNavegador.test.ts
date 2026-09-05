import fs from 'fs';
import path from 'path';

// O núcleo roda em DUAS superfícies, e a segunda não tem as APIs do navegador.
//
// `crypto` é o caso que já custou: `crypto.randomUUID?.()` parecia defensivo, mas o `?.` só
// protege a CHAMADA — no React Native o global `crypto` não existe, e só avaliar o nome estoura
// `ReferenceError`. Numa promessa, como estava, o erro não chega à tela: a mensagem enviada
// simplesmente sumia.
//
// A forma correta é `globalThis.crypto?.…`, que devolve `undefined` em vez de estourar. Este
// teste varre o núcleo atrás de globais de navegador usados sem essa proteção.
//
// Não substitui rodar no aparelho — mas o sintoma deste em particular é silencioso, e um teste
// que lê a fonte custa milissegundos.

const GLOBAIS_QUE_FALTAM = ['crypto', 'localStorage', 'sessionStorage', 'document', 'navigator'];

const fontes = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) return item.name === '__tests__' ? [] : fontes(caminho);
    return /\.tsx?$/.test(item.name) ? [caminho] : [];
  });

const raiz = path.join(__dirname, '..', '..');
// `ambiente.ts` é justamente quem tem o direito de tocar nesses globais: ele é a porta, e já os
// acessa por `globalThis` com try/catch em volta.
const arquivos = fontes(raiz).filter((f) => !f.endsWith(path.join('nucleo', 'ambiente.ts')));

describe('o núcleo não depende de globais que só o navegador tem', () => {
  it.each(GLOBAIS_QUE_FALTAM)('nenhuma fonte usa `%s` sem globalThis', (global) => {
    // Pega `crypto.x`, ignora `globalThis.crypto`, `window.crypto`, `.crypto` e strings.
    const nu = new RegExp(`(?<![.\\w'"\`])${global}\\s*[.[]`);
    const culpados = arquivos.filter((f) => {
      const fonte = fs.readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return nu.test(fonte);
    });

    expect(culpados.map((f) => path.relative(raiz, f))).toEqual([]);
  });
});
