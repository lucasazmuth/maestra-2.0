import { render, waitFor } from '@testing-library/react-native';

import { PortaoDaSessao } from '@/nucleo/PortaoDaSessao';

// QUEM SAI DA CONTA SAI DA TELA.
//
// "Sair da conta" chamava o `signOut` e mais nada acontecia: a sessão sumia, a tela continuava
// ali com os dados que já estavam na memória, e quem tocou o botão via o menu fechar e nada
// mudar. Parecia botão quebrado — e a conta ficava aberta na cara de quem achava que tinha
// saído.
//
// A causa era o guardião viver em cada tela: seis tinham o seu `Redirect`, e as de dentro do
// artista não tinham nenhum.

const mockReplace = jest.fn();
let mockSegmentos: string[] = ['artista', '[id]'];
let mockSessao: { sessao: unknown; carregando: boolean } = { sessao: null, carregando: false };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegmentos,
}));

jest.mock('@/nucleo/sessao', () => ({ useSessao: () => mockSessao }));

beforeEach(() => {
  mockReplace.mockClear();
  mockSegmentos = ['artista', '[id]'];
  mockSessao = { sessao: null, carregando: false };
});

describe('portão da sessão', () => {
  it('sem sessão, tira a pessoa de qualquer tela', async () => {
    await render(<PortaoDaSessao />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/entrar'));
  });

  it('com sessão, não mexe em nada', async () => {
    mockSessao = { sessao: { user: { id: 'u-1' } }, carregando: false };
    await render(<PortaoDaSessao />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Sem isto, o app mandaria todo mundo para o login por meio segundo, até a sessão do disco
  // chegar — o piscar clássico.
  it('enquanto não sabe, espera', async () => {
    mockSessao = { sessao: null, carregando: true };
    await render(<PortaoDaSessao />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Empurrar quem já está numa tela que existe SEM sessão é um laço.
  it.each([['entrar'], ['intro']])('não expulsa quem está em /%s', async (rota) => {
    mockSegmentos = [rota];
    await render(<PortaoDaSessao />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
