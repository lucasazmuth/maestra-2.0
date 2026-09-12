import { ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EstadoDaMesa } from '@maestra/core/audio/mesa';

import { LinhaDoTempo } from '../LinhaDoTempo';

// A VISTA QUE SEGUE A AGULHA — mas só quando ela foge.
//
// Carregar em tocar era ficar a rolar atrás da linha vermelha com a mão: ela atravessava o ecrã,
// saía pela direita e continuava a andar sozinha, e ver o que estava a soar passava a ser um
// trabalho de scroll.
//
// ⚠️ E A CORREÇÃO FÁCIL É PIOR DO QUE O DEFEITO. Uma vista que centra a agulha a cada décimo de
// segundo faz a onda deslizar sem parar debaixo do olho: fica impossível ler o que quer que seja
// ou apontar para uma coisa parada. Por isso as DUAS metades são a regra, e a segunda — a
// montagem quieta enquanto a agulha está à vista — é a que se perde primeiro.
//
// A conta é do núcleo (`rolagemQueSegue`, com os seus próprios casos); o que se prova aqui é a
// ligação: a tela mede-se, ouve a rolagem e pede a certa.
//
// ⚠️ UM CASO SÓ, E É DE PROPÓSITO. Neste ficheiro a SEGUNDA montagem devolve uma árvore vazia —
// `getByTestId` não acha sequer a raiz —, que é a mesma armadilha do `Modal` a sobreviver à
// limpeza entre casos (ver `FecharComGuia.test.tsx` e `Carregando.test.tsx`). Partir isto em
// três `it` dava dois testes a falhar por arrumação, e não por regra. Como percurso também se lê
// melhor: a agulha anda, foge, e é ela que manda a vista atrás dela.

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
  it('fica quieta enquanto a agulha se vê, e vai buscá-la quando ela foge', async () => {
    const rolou = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const { rerender, unmount } = await render(montagem(0));
    const xPedido = () => (
      rolou.mock.calls[rolou.mock.calls.length - 1][0] as { x: number }
    ).x;

    // Sem largura medida não há "à vista" nenhum para comparar.
    await fireEvent(screen.getByTestId('montagem'), 'layout', {
      nativeEvent: { layout: { width: VISTA + COLUNA, height: 600 } },
    });
    // E a tela só sabe onde a rolagem está porque o `onScroll` lho disse: num `ScrollView` não
    // há `scrollLeft` para ler.
    const ondas = screen.getByTestId('ondas');
    await fireEvent.scroll(ondas, { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    rolou.mockClear();

    // ⚠️ A METADE QUE SE PERDE PRIMEIRO: com a agulha à vista a montagem NÃO SE MEXE. O segundo
    // 3 está a 180 pt, dentro dos 400 visíveis — ela atravessa o ecrã como sempre atravessou, e
    // quem está a olhar para um compasso continua a olhar para ele.
    await rerender(montagem(3));
    expect(rolou).not.toHaveBeenCalled();

    // Passou a borda direita (10 s × 60 = 600 pt): a página vira, e à frente dela fica uma tela
    // inteira por tocar. Com um respiro de 10 % atrás — colada à borda, não se veria nada do que
    // acabou de passar, no instante exato em que a vista saltou.
    await rerender(montagem(10));
    expect(rolou).toHaveBeenCalled();
    expect(xPedido()).toBe(10 * PONTOS_POR_SEGUNDO - VISTA * 0.1);

    // ⚠️ E NOS DOIS SENTIDOS. Voltar ao início e o fim de um ciclo do loop deixam a agulha ATRÁS
    // do que se vê, e o problema é o mesmo: sem isto, repetir do início deixava a tela parada no
    // fim da música. A rolagem está agora onde o salto anterior a pôs.
    await fireEvent.scroll(ondas, { nativeEvent: { contentOffset: { x: xPedido(), y: 0 } } });
    await rerender(montagem(0));
    expect(xPedido()).toBe(0);

    unmount();
    rolou.mockRestore();
  });
});
