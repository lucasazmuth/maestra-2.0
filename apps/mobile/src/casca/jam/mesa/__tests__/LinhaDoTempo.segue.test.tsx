import { ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EstadoDaMesa } from '@maestra/core/audio/mesa';

import { LinhaDoTempo } from '../LinhaDoTempo';

// O QUE A VISTA FAZ ENQUANTO A MÚSICA TOCA — e são dois modos, não um.
//
// Primeiro a agulha anda e a montagem está quieta, como sempre esteve: quem está a olhar para um
// compasso continua a olhar para ele. No instante em que ela ia desaparecer pela direita, trocam
// de papel — a linha trava no MEIO e passa a ser a música a deslizar por baixo, como num
// gravador de fita. Antes disto, carregar em tocar era ficar a rolar atrás da linha com a mão.
//
// A decisão é do núcleo (`passoDaVista`, com os seus próprios casos, incluindo o que guarda o
// modo). O que se prova aqui é a ligação: a tela mede-se, ouve a rolagem, e pede a certa.
//
// ⚠️ UM CASO SÓ, E É DE PROPÓSITO. Neste ficheiro a SEGUNDA montagem devolve uma árvore vazia —
// `getByTestId` não acha sequer a raiz —, que é a mesma armadilha do `Modal` a sobreviver à
// limpeza entre casos (ver `FecharComGuia.test.tsx` e `Carregando.test.tsx`). Partir isto em
// vários `it` dava testes a falhar por arrumação, e não por regra. Como percurso também se lê
// melhor: a agulha anda, chega à borda, e a partir dali é a música que se mexe.

const COLUNA = 132;
const VISTA = 400;
/** A 100 % são 60 pt por segundo. */
const PONTOS_POR_SEGUNDO = 60;

const estado = (posicao: number): EstadoDaMesa => ({
  tocando: true, posicao, duracao: 600, emLoop: false, pistas: [], carga: 'pronto',
} as unknown as EstadoDaMesa);

const montagem = (posicao: number) => (
  <LinhaDoTempo
    pistas={[]}
    estado={estado(posicao)}
    picos={() => []}
    duracaoDoClipe={() => 30}
    zoom={1}
    aoBuscar={() => {}}
  />
);

describe('a vista e a agulha', () => {
  it('a agulha anda até à borda, e a partir dali é a música que desliza', async () => {
    const rolou = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const { rerender, unmount } = await render(montagem(0));
    const ultimo = () => rolou.mock.calls[rolou.mock.calls.length - 1][0] as
      { x: number; animated: boolean };

    // Sem largura medida não há "à vista" nenhum para comparar.
    await fireEvent(screen.getByTestId('montagem'), 'layout', {
      nativeEvent: { layout: { width: VISTA + COLUNA, height: 600 } },
    });
    // E a tela só sabe onde a rolagem está porque o `onScroll` lho disse: num `ScrollView` não
    // há `scrollLeft` para ler.
    const ondas = screen.getByTestId('ondas');
    await fireEvent.scroll(ondas, { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    rolou.mockClear();

    // ⚠️ MODO 1, e é a metade que se perde primeiro: com a agulha à vista a montagem NÃO SE
    // MEXE. 0,25 s são 15 pt, dentro dos 400 visíveis.
    //
    // ⚠️ E OS PASSOS SÃO DO TAMANHO DA REPRODUÇÃO. Saltar de 3 para 10 de uma vez não é a música
    // a tocar, é alguém a LEVAR a agulha — e a regra trata as duas coisas de forma diferente, de
    // propósito. A primeira versão deste caso andava aos segundos e provava o modo errado.
    await rerender(montagem(0.25));
    expect(rolou).not.toHaveBeenCalled();

    // Um salto que aterra DENTRO do que se vê também não mexe na montagem: a pessoa tocou na
    // régua dentro do ecrã, e arrastar-lhe o desenho por baixo do dedo seria mexer no que ela
    // estava a apontar. 6,5 s são 390 pt, ainda dentro dos 400.
    await rerender(montagem(6.5));
    expect(rolou).not.toHaveBeenCalled();

    // Agora ela ia desaparecer pela direita (6,75 s = 405 pt): a linha trava no MEIO e a rolagem
    // salta uma vez, a animar, para a pôr lá.
    await rerender(montagem(6.75));
    expect(ultimo()).toEqual({ x: 6.75 * PONTOS_POR_SEGUNDO - VISTA / 2, animated: true });

    // ⚠️ E DAQUI PARA A FRENTE É A MÚSICA QUE SE MEXE. A agulha está à vista (é o meio do ecrã)
    // e mesmo assim a rolagem continua a andar com ela — uma regra que só perguntasse "está à
    // vista?" respondia que não havia nada a fazer, e a vista virava páginas em vez de deslizar.
    await fireEvent.scroll(ondas, {
      nativeEvent: { contentOffset: { x: ultimo().x, y: 0 } },
    });
    await rerender(montagem(7));
    // Sem animação: o deslize chega vinte vezes por segundo, e animar cada passo põe vinte
    // animações a disputar a mesma rolagem.
    expect(ultimo()).toEqual({ x: 7 * PONTOS_POR_SEGUNDO - VISTA / 2, animated: false });

    unmount();
    rolou.mockRestore();
  });
});
