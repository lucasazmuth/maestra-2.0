import { render } from '@testing-library/react-native';

import { Carregando } from '../Carregando';

// ⚠️ QUEM PEDIU MENOS MOVIMENTO NÃO LEVA UMA MARCA A PULSAR.
//
// É uma preferência do sistema, e para parte das pessoas é o que separa usar o aplicativo de não
// conseguir olhar para ele. A web já a respeita (`prefers-reduced-motion`, no `spinner.scss`), e
// ali a marca fica parada e INTEIRA — não no quadro de repouso, que é apagado de propósito para
// a respiração ter para onde crescer. Uma marca meio apagada e meio pequena, imóvel, lê-se como
// tela quebrada.
//
// ⚠️ FICHEIRO PRÓPRIO, e não um caso no do lado: o gancho vem do duplo do `reanimated`, montado
// uma vez para o ficheiro inteiro. Trocá-lo a meio faria o duplo valer para uns casos e não para
// outros, conforme a ordem — que é a espécie de teste que passa a mentir sem ninguém reparar.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

// ⚠️ O QUE ESTE FICHEIRO NÃO CONSEGUE PROVAR: que a animação nem CHEGA A ARRANCAR. São duas
// decisões, e só uma se vê — o estilo estático é o que desenha, e o `if (semMovimento) return`
// do efeito é o que impede um laço infinito de correr para sempre na linha do tempo de quem
// pediu para não haver movimento. Tirá-lo não muda um píxel, porque o estilo já está parado; o
// que ele poupa é trabalho, e trabalho não aparece numa árvore renderizada. Fica escrito aqui
// para quem vier não o tomar por esquecimento.
describe('Carregando, com menos movimento', () => {
  it('a marca fica parada, inteira e opaca', async () => {
    const tela = await render(<Carregando />);
    const marca = tela.getByLabelText('Carregando').children[0] as unknown as
      { props: { style: Record<string, unknown> } };

    expect(marca.props.style).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
  });
});
