import fs from 'fs';
import path from 'path';

// O @maestra/core PRECISA ser compilado como ESM. Com "module": "commonjs" ele emite
// `require("@supabase/supabase-js")`, e o webpack passa a resolver o pacote pela condicao `require`
// do exports, caindo no `dist/index.cjs`.
//
// E aqui mora o problema: o `oneOf` do webpack do CRA 5 termina num loader `asset/resource` que
// captura tudo que nao casou nas regras anteriores, excluindo apenas js|mjs|jsx|ts|tsx|html|json.
// `.cjs` NAO esta nessa lista. Entao todo arquivo .cjs vira ASSET ESTATICO: o require devolve uma
// URL, nao os exports. `createClient` fica undefined e o app morre no import do modulo, com tela
// branca e "(0 , r.createClient) is not a function".
//
// Nao e teorico: derrubou a producao. O build passava, "Compiled successfully", deploy completo, e
// o bundle saia sem supabase-js, axios e react-redux dentro — os tres tinham virado arquivos em
// build/static/media/*.cjs. Como o sintoma so aparece no navegador, nenhuma etapa da CI pegava.
//
// Em ESM o webpack usa a condicao `import`, cai no `.mjs`, que esta na lista de exclusao, e as
// bibliotecas voltam a ser empacotadas como codigo.
//
// Se algum dia for preciso voltar para CommonJS, o `.cjs` tem que ser tratado ANTES no webpack
// (via craco/react-app-rewired), senao isto se repete exatamente igual.

describe('formato de modulo do @maestra/core', () => {
  const tsconfig = fs.readFileSync(
    path.join(__dirname, '..', '..', 'packages', 'core', 'tsconfig.json'),
    'utf8'
  );

  /** O tsconfig do pacote tem comentarios, entao lemos o campo pelo texto mesmo. */
  const moduleField = (): string => {
    const m = tsconfig.match(/"module"\s*:\s*"([^"]+)"/);
    expect(m).not.toBeNull();
    return m![1];
  };

  it('nao compila para commonjs', () => {
    expect(moduleField()).not.toBe('commonjs');
  });

  it('compila para ESM, para o webpack resolver as dependencias pelo .mjs', () => {
    expect(moduleField()).toMatch(/^es(next|\d{4})$/i);
  });
});
