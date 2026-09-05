import fs from 'fs';
import path from 'path';

// Uma chave de ambiente lida com o prefixo de UMA superfície é inerte na outra, e o sintoma é
// mudo: a chave simplesmente nunca liga, e quem a define acha que ligou.
//
// Foi o que aconteceu com o núcleo inteiro. Todas as leituras eram `REACT_APP_*`, que só o CRA
// substitui — no app nativo `PAYWALL_DISABLED` nunca ligava, e a URL do Supabase caía sempre no
// valor embutido, sem meio de apontar o app para outro projeto.
//
// Este teste varre o núcleo atrás de leituras de ambiente fora de `nucleo/env.ts`, que é o
// único lugar autorizado a fazê-las — e o único que escreve os dois prefixos.

const raiz = path.join(__dirname, '..', '..');

const fontes = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) return item.name === '__tests__' ? [] : fontes(caminho);
    return /\.tsx?$/.test(item.name) ? [caminho] : [];
  });

// `nucleo/env.ts` é o único lugar autorizado.
//
// (O `PUBLIC_URL` de `constants/spotify.ts` não entra nesta varredura, e não é descuido: ele
// monta o caminho de imagens ESTÁTICAS servidas pela web, que no app não existem. Lá as
// constantes que o usam produzem uma URL quebrada, e por isso o app não as usa — desenha a
// inicial do nome no lugar.)
const PERMITIDOS = [
  path.join('nucleo', 'env.ts'),
];

const arquivos = fontes(raiz)
  .filter((f) => !PERMITIDOS.some((p) => f.endsWith(p)));

describe('leitura de ambiente', () => {
  it.each(['REACT_APP_', 'EXPO_PUBLIC_'])(
    'nenhuma fonte lê `%s` por conta própria',
    (prefixo) => {
      const culpados = arquivos.filter((f) => fs.readFileSync(f, 'utf8').includes(`process.env.${prefixo}`));
      expect(culpados.map((f) => path.relative(raiz, f))).toEqual([]);
    },
  );

  // O outro lado do mesmo compromisso: `env.ts` precisa escrever os DOIS prefixos para cada
  // chave. Um deles sozinho é a mesma armadilha, só que escondida num arquivo com nome bonito.
  it('cada chave em env.ts é lida nos dois prefixos', () => {
    const env = fs.readFileSync(path.join(raiz, 'nucleo', 'env.ts'), 'utf8');
    const nomes = (prefixo: string) =>
      [...env.matchAll(new RegExp(`process\\.env\\.${prefixo}(\\w+)`, 'g'))].map((m) => m[1]).sort();

    expect(nomes('REACT_APP_')).toEqual(nomes('EXPO_PUBLIC_'));
    expect(nomes('REACT_APP_').length).toBeGreaterThan(0);
  });
});
