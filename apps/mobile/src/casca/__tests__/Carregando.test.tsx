import { render } from '@testing-library/react-native';

import { ESPERA_DA_MARCA } from '@maestra/core/constants/design';

import { Carregando } from '../Carregando';

// A ESPERA DE UMA TELA: a marca da Maestra a respirar.
//
// ⚠️ NÃO É UMA RODA. Uma roda a girar é o sinal de espera de toda a gente, e por isso não é de
// ninguém: a tela podia ser de qualquer aplicativo. A web já mostrava a marca; o aplicativo é que
// tinha ficado com o círculo do sistema.
//
// O que se pode provar aqui é o que a tela DESENHA e o que ela ANUNCIA. A respiração em si corre
// no `reanimated`, que os testes trocam por um duplo — os números dela estão presos no núcleo, e
// o cromo é quem obriga a web a usar os mesmos.

describe('Carregando', () => {
  it('anuncia que está a carregar, para quem não vê a marca', async () => {
    const tela = await render(<Carregando />);
    expect(tela.getByLabelText('Carregando')).toBeTruthy();
  });

  it('desenha a marca no tamanho que o núcleo manda', async () => {
    const tela = await render(<Carregando />);
    const marca = tela.getByLabelText('Carregando');

    // A caixa é maior do que o desenho: a respiração cresce até 1.0 e precisa de folga.
    expect(marca.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ width: ESPERA_DA_MARCA.caixa, height: ESPERA_DA_MARCA.caixa }),
    ]));
    expect(ESPERA_DA_MARCA.marca).toBeLessThan(ESPERA_DA_MARCA.caixa);

    // ⚠️ E O DESENHO É O `marca`, não a caixa. Sem esta linha, desenhá-lo do tamanho da caixa
    // passava: o de fora continuava com a medida certa e a folga desaparecia — a respiração
    // cresceria para fora do que lhe foi reservado.
    const desenho = tela.getByLabelText('Carregando').children[0] as unknown as
      { children: { props: Record<string, unknown> }[] };
    expect(desenho.children[0].props.width).toBe(ESPERA_DA_MARCA.marca);
  });

  // ⚠️ COMEÇA NO QUADRO DE REPOUSO, e não em cheio. A marca nasce a 55% de opacidade e 88% de
  // tamanho, que é o primeiro quadro da respiração — nascer opaca e inteira dava um solavanco
  // no instante em que a tela aparece, que é justamente quando se está a olhar para ela.
  it('nasce no primeiro quadro da respiração, o do núcleo', async () => {
    const tela = await render(<Carregando />);
    const repouso = ESPERA_DA_MARCA.quadros[0];

    // O filho do meio é o que respira; o de fora é a caixa, o de dentro é o desenho.
    const respirando = tela.getByLabelText('Carregando').children[0] as unknown as
      { props: { style: Record<string, unknown> } };
    expect(respirando.props.style).toEqual({
      opacity: repouso.opacidade,
      transform: [{ scale: repouso.escala }],
    });
  });

  // ⚠️ ESTE VEM POR ÚLTIMO, e não é arrumação: ele monta DUAS vezes para comparar as tintas, e
  // o caso montado a seguir ficava sem árvore nenhuma — `getByLabelText` não achava sequer a
  // caixa. É a mesma armadilha da folha de fechar o Espaço JAM; ver `FecharComGuia.test.tsx`.
  // ⚠️ O EDITOR É ESCURO, e a tinta de repouso da marca — um cinza-azulado pensado para fundo
  // claro — quase some nele. Quem sabe qual é o fundo é a tela que espera.
  it('aceita a tinta de quem a mostra, e tem a do núcleo por omissão', async () => {
    const semTinta = await render(<Carregando />);
    expect(JSON.stringify(semTinta.toJSON())).toContain(ESPERA_DA_MARCA.cor);
    semTinta.unmount();

    const comTinta = await render(<Carregando cor='#71717f' />);
    const desenhado = JSON.stringify(comTinta.toJSON());
    expect(desenhado).toContain('#71717f');
    expect(desenhado).not.toContain(ESPERA_DA_MARCA.cor);
    comTinta.unmount();
  });
});
