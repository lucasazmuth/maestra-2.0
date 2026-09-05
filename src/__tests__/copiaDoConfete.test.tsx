import fs from 'fs';
import path from 'path';

import { render } from '@testing-library/react';

import { SuccessConfetti } from '../components/SuccessConfetti';

// A comemoração é a MESMA nas duas superfícies.
//
// O app roda o confete e o fundo dentro de um WebView, com o script e o SVG embutidos (a página
// não busca nada na rede). O embutido é gerado por `npm run confete:sync`; este teste compara o
// que está gerado com as origens da web. Sem ele, mexer no confete da web deixaria o app
// comemorando de outro jeito, calado.

const raiz = path.join(__dirname, '..', '..');
const ler = (...p: string[]) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

const gerado = ler('apps', 'mobile', 'src', 'casca', 'checkout', 'confete.gerado.ts');

/** O valor de uma constante do arquivo gerado (ele guarda strings JSON). */
const constante = (nome: string): string => {
  const achado = gerado.match(new RegExp(`export const ${nome} = ("(?:[^"\\\\]|\\\\.)*");`));
  if (!achado) throw new Error(`o arquivo gerado não tem ${nome}`);
  return JSON.parse(achado[1]);
};

describe('o confete do app é o da web', () => {
  it('o script embutido é o `confeteCanvas.js`, byte a byte', () => {
    expect(constante('CONFETE')).toEqual(ler('src', 'components', 'confeteCanvas.js'));
  });

  it('o fundo embutido é o mesmo SVG das auroras', () => {
    const svg = fs.readFileSync(path.join(raiz, 'src', 'assets', 'dark-gradient-bg.svg'));
    expect(constante('FUNDO_DA_COMEMORACAO'))
      .toEqual(`data:image/svg+xml;base64,${svg.toString('base64')}`);
  });

  // O import do .js pelo TSX é o ponto frágil: um arquivo em JavaScript puro importado por um
  // módulo ES já passou no `tsc` e sumiu no empacotamento antes (`audioMeta`, `RealBadge`).
  // Aqui ele é EXERCITADO — o canvas do jsdom não tem contexto 2D, então a função só devolve a
  // limpeza, mas ela precisa existir.
  it('a web consegue chamar o confete que importa do arquivo plano', () => {
    const { unmount } = render(<SuccessConfetti />);
    expect(() => unmount()).not.toThrow();
  });

  // O WebView chama a função pelo nome; renomeá-la na web deixaria a página com um script que
  // carrega e não faz nada — sem erro visível, sem confete.
  it('a página do app chama a função que o script define', () => {
    const tela = ler('apps', 'mobile', 'src', 'casca', 'checkout', 'Confete.tsx');
    expect(tela).toContain("desenharConfete(document.getElementById('confete'));");
    expect(constante('CONFETE')).toContain('function desenharConfete(canvas, opcoes)');
  });
});
