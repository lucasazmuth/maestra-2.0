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

  // No celular a lista perde o contorno e o canto: o que separa uma faixa da outra é um fio,
  // não um cartão. É a diferença entre uma lista e uma pilha de caixas.
  it('a lista no celular é contínua, sem contorno e sem canto', () => {
    const semEspacos = css.replace(/\s+/g, '');
    expect(semEspacos).toContain('border-radius:0!important');
    expect(semEspacos).toContain(`border-bottom:1pxsolid${COR_CATALOGO.fio}`);
  });
});
