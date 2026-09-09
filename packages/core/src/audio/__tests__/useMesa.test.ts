import { act, renderHook, waitFor } from '@testing-library/react';

import { ContextoFalso, buscarFalso } from '../duplos/contextoFalso';
import { useMesa } from '../useMesa';
import type { Pista } from '../mesa';

// A costura entre a mesa e a tela.
//
// A mistura em si (arranque em fase, solo, mute, busca) é provada em `mesa.test.ts`, com um
// relógio manual. O que se prova aqui é o que só existe por haver React no meio: que a mesa não
// é recriada à toa, que os picos não são recalculados a cada tique, e — o mais importante — que
// um contexto de áudio que se recusa a nascer não derruba a tela.

const PISTAS: Pista[] = [
  { id: 'mix', nome: 'Mix ★', url: 'https://x/mix.wav' },
  { id: 's1', nome: 'Voz', url: 'https://x/voz.wav' },
];

const comContexto = (criar: () => ContextoFalso) => ({
  criarContexto: criar as unknown as () => never,
  buscar: buscarFalso,
});

describe('useMesa', () => {
  // ⚠️ O caso que justifica o try/catch: sem ele a exceção sobe pelo efeito e leva a TELA
  // inteira — quem abrisse o editor num navegador sem Web Audio veria uma página branca em vez
  // de uma música que não toca.
  it('um contexto que não nasce não derruba a tela: as pistas dizem por que não tocam', async () => {
    const { result } = renderHook(() => useMesa(PISTAS, comContexto(() => {
      throw new Error('Este navegador não toca áudio.');
    })));

    await waitFor(() => expect(result.current.estado.pistas).toHaveLength(2));
    expect(result.current.estado.pistas.map((p) => p.carga)).toEqual(['erro', 'erro']);
    expect(result.current.estado.pistas[0].erro).toBe('Este navegador não toca áudio.');
    // E o transporte continua coerente: nada carregando, nada tocando.
    expect(result.current.estado.carregando).toBe(false);
    expect(result.current.estado.tocando).toBe(false);
  });

  // Renomear uma pista não pode custar o download e a descodificação de tudo outra vez.
  it('a mesa só nasce de novo quando as URLs mudam', async () => {
    let criados = 0;
    const criar = () => { criados += 1; return new ContextoFalso(); };
    const { result, rerender } = renderHook(
      ({ pistas }) => useMesa(pistas, comContexto(criar)),
      { initialProps: { pistas: PISTAS } },
    );

    await waitFor(() => expect(result.current.estado.pistas[0].carga).toBe('pronta'));
    expect(criados).toBe(1);

    // Outro array, outros nomes, as MESMAS gravações: a mesa é a mesma.
    rerender({ pistas: PISTAS.map((p) => ({ ...p, nome: `${p.nome} v2` })) });
    await waitFor(() => expect(result.current.estado.pistas).toHaveLength(2));
    expect(criados).toBe(1);

    // A ordem também não conta: a mesa toca tudo ao mesmo tempo, e quem empilha as linhas é a
    // tela. Sem isto, "mover para cima" recarregaria centenas de MB de áudio.
    rerender({ pistas: [...PISTAS].reverse() });
    await waitFor(() => expect(result.current.estado.pistas).toHaveLength(2));
    expect(criados).toBe(1);

    // Outra gravação, aí sim.
    rerender({ pistas: [{ id: 'mix2', nome: 'Mix ★', url: 'https://x/outra.wav' }] });
    await waitFor(() => expect(criados).toBe(2));
  });

  // `picos()` percorre o PCM inteiro, e a tela pede-os 20 vezes por segundo, por pista.
  it('os picos de uma pista são calculados uma vez só', async () => {
    const contexto = new ContextoFalso();
    const { result } = renderHook(() => useMesa(PISTAS, comContexto(() => contexto)));

    await waitFor(() => expect(result.current.estado.pistas[0].carga).toBe('pronta'));
    const primeiro = result.current.picos('mix', 8);
    expect(primeiro).toHaveLength(8);
    // A MESMA lista, e não uma igual: é a identidade que faz o `memo` da onda não redesenhar.
    expect(result.current.picos('mix', 8)).toBe(primeiro);
    // Outra resolução é outra conta — guardar só uma devolveria o número errado de barras.
    expect(result.current.picos('mix', 16)).toHaveLength(16);
  });

  // Sair da tela sem isto deixa a mesa a tocar por baixo da seguinte, com centenas de MB de
  // áudio descodificado presos na memória.
  it('desmontar fecha o contexto', async () => {
    const contexto = new ContextoFalso();
    const { result, unmount } = renderHook(() => useMesa(PISTAS, comContexto(() => contexto)));

    await waitFor(() => expect(result.current.estado.pistas[0].carga).toBe('pronta'));
    await act(async () => { unmount(); });
    await waitFor(() => expect(contexto.state).toBe('closed'));
  });
});
