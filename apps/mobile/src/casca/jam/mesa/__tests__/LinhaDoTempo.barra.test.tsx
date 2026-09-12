import { fireEvent, render, screen } from '@testing-library/react-native';
import * as reanimated from 'react-native-reanimated';

import type { EstadoDaMesa, Pista } from '@maestra/core/audio/mesa';

import { LinhaDoTempo } from '../LinhaDoTempo';

// A BARRA DE AÇÕES DO CLIPE: ao pé da agulha, e do lado que couber.
//
// Na ponta esquerda do clipe ela funcionava enquanto os clipes coubessem no ecrã. Num clipe
// comprido — que é onde se corta de verdade — a ponta está a milhares de pontos de distância, e
// as quatro ações ficavam inalcançáveis sem rolar para trás à procura delas.
//
// ⚠️ E O LADO NÃO PODE SER SEMPRE O MESMO. À direita da agulha ela saía pela borda do ecrã
// sempre que a agulha se aproximava dela; empurrá-la só para dentro da janela — que foi a
// primeira correção — deixava-a a uma distância qualquer da linha vermelha. Invertida, continua
// colada: do outro lado, mas colada.
//
// ⚠️ ESTE FICHEIRO EXISTE PORQUE O APARELHO NÃO O PODIA PROVAR. A inversão precisa da agulha
// perto da borda, e mover a agulha precisa da mesa com áudio carregado — que no simulador, a
// recarregar a cada edição, deixou de decodificar. A conta é do núcleo e tem os seus casos; o
// que se prova aqui é a LIGAÇÃO: a tela mede-se, sabe o que se vê, e põe a barra no lado certo.

const COLUNA = 132;
/** A 34 % seriam 20,4 pt/s; a 100 % são 60, que dá contas redondas. */
const PONTOS_POR_SEGUNDO = 60;
const LADO = 8;

const estado = (posicao: number): EstadoDaMesa => ({
  tocando: false, posicao, duracao: 600, emLoop: false, pistas: [], carga: 'pronto',
} as unknown as EstadoDaMesa);

const pista = (): Pista => ({
  id: 't-1',
  nome: 'Voz',
  clipes: [{ id: 'c-1', url: 'file:///voz.wav', inicio: 0, recorte: 0, duracao: 600 }],
} as unknown as Pista);

const montagem = (posicao: number) => (
  <LinhaDoTempo
    pistas={[pista()]}
    estado={estado(posicao)}
    picos={() => [0.5, 0.5, 0.5]}
    duracaoDoClipe={() => 600}
    zoom={1}
    podeEditar
    aoBuscar={() => {}}
    aoApagar={() => {}}
  />
);

/** O `left` que a barra recebeu, achatando o array de estilos. */
const esquerdaDaBarra = () => {
  const barra = screen.getByLabelText('Remover o clipe').parent!;
  const estilo = (barra.props as { style?: unknown }).style;
  const camadas = (Array.isArray(estilo) ? estilo : [estilo]).flat(9);
  const com = camadas.find((c) => c && typeof c === 'object' && 'left' in (c as object));
  return (com as { left: number }).left;
};

describe('a barra de ações do clipe, no aparelho', () => {
  it('fica à direita da agulha, e passa para a esquerda quando não cabe', async () => {
    // A rolagem lê-se na linha da interface; aqui é este objeto, como no aparelho seria.
    const rolagem = { value: 0 };
    jest.spyOn(reanimated, 'useScrollViewOffset').mockReturnValue(rolagem as never);
    const { rerender, unmount } = await render(montagem(2));

    // Sem largura medida não há janela nenhuma para decidir o lado.
    await fireEvent(screen.getByTestId('montagem'), 'layout', {
      nativeEvent: { layout: { width: COLUNA + 400, height: 600 } },
    });
    // A barra só existe com o clipe escolhido — como na web.
    await fireEvent.press(screen.getByLabelText('Trecho 1 de Voz'));
    // E mede-se sozinha: o número de botões muda com o que se pode fazer.
    await fireEvent(screen.getByLabelText('Remover o clipe').parent!, 'layout', {
      nativeEvent: { layout: { width: 130, height: 36 } },
    });

    // ⚠️ COM ESPAÇO, À DIREITA. A agulha no segundo 2 está a 120 pt, e a janela dá 400: cabem os
    // 130 da barra com folga de sobra.
    expect(esquerdaDaBarra()).toBe(2 * PONTOS_POR_SEGUNDO + LADO);

    // ⚠️ SEM ESPAÇO, DO OUTRO LADO. No segundo 6 a agulha está a 360 pt e a janela acaba nos
    // 400: os 130 da barra não cabem à direita, e ela passa a acabar 8 pt antes da linha.
    await rerender(montagem(6));
    expect(esquerdaDaBarra() + 130).toBe(6 * PONTOS_POR_SEGUNDO - LADO);

    unmount();
    jest.restoreAllMocks();
  });
});
