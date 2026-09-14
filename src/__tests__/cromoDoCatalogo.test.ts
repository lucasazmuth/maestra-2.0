import fs from 'fs';
import path from 'path';

import { COR_CATALOGO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o módulo Músicas.

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'gsap-reference.css'), 'utf8');

describe('cromo do catálogo', () => {
  it.each(Object.entries(COR_CATALOGO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    // Havia aqui um caso à parte para `#ffffff`, que a folha escreve `#fff`. Ele saiu com o
    // `jamFundo`, que era o único token branco — e mantido, o TypeScript queixa-se de comparar
    // com um valor que nenhum token tem. Se um branco voltar, volta com ele.
    expect(css).toContain(valor);
  });

  // ⚠️ A PÍLULA DO ESPAÇO JAM SAIU DA LINHA, nas duas superfícies, e com ela as três cores que
  // só ela usava. O que este teste prendia — qual das duas regras da folha vencia — deixou de
  // ser uma pergunta: a linha inteira já abre o Espaço Jam, e o nome do destino mudou-se para o
  // "⋮". A regra continua na folha, que é a REFERÊNCIA do design e não a nossa folha de estilo;
  // apagá-la de lá seria reescrever o desenho de onde ele vem.

  // ⚠️ A LEGENDA DA LINHA VEM DO NÚCLEO, NAS DUAS SUPERFÍCIES.
  //
  // Ela dizia "V1 · versão principal": a mesma frase em todas as linhas, que por isso não
  // distinguia nenhuma, e que falava de um modelo — versões alternativas, uma eleita — que o
  // produto deixou de ter. O `legendaDaMusica` do núcleo passou a dizer o que muda de linha
  // para linha e ajuda a retomar o trabalho: quem mexeu por último, e há quanto tempo.
  //
  // A web trocou; o app continuou a montar a frase à mão e ficou meses a mostrar o texto
  // aposentado. Ninguém reparou porque não havia regra nenhuma a prender as duas. Esta é ela,
  // e lê os ficheiros de propósito: uma legenda escrita à mão não falha teste de render, falha
  // só quando alguém olha para a tela.
  it.each([
    ['web', path.join(__dirname, '..', 'pages', 'Catalog', 'index.tsx')],
    ['app', path.join(__dirname, '..', '..', 'apps', 'mobile', 'src', 'app', 'artista', '[id]', 'catalogo.tsx')],
  ])('a legenda da linha, no %s, sai do núcleo', (_onde, caminho) => {
    const fonte = fs.readFileSync(caminho, 'utf8');

    expect(fonte).toMatch(/import\s*\{[^}]*legendaDaMusica[^}]*\}\s*from\s*'@maestra\/core\/utils\/legendaDaMusica'/);
    expect(fonte).toMatch(/legendaDaMusica\(/);

    // ⚠️ A REGRA NÃO PROÍBE A FRASE NO FICHEIRO, e a tentação de o fazer é um erro que já
    // cometi aqui: "versão principal" continua VIVA noutros sítios do mesmo ecrã. Ela é a
    // legenda da fila do player, onde dizer qual versão toca evita a dúvida de se estar a ouvir
    // uma gravação antiga, e é o rótulo da estrela que promove uma versão. O que foi aposentado
    // é a legenda da LINHA DA LISTA, e é isso que as duas asserções acima prendem.
  });

  // No celular a lista perde o contorno e o canto: o que separa uma faixa da outra é um fio,
  // não um cartão. É a diferença entre uma lista e uma pilha de caixas.
  it('a lista no celular é contínua, sem contorno e sem canto', () => {
    const semEspacos = css.replace(/\s+/g, '');
    expect(semEspacos).toContain('border-radius:0!important');
    expect(semEspacos).toContain(`border-bottom:1pxsolid${COR_CATALOGO.fio}`);
  });
});
