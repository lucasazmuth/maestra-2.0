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
  // O portão importa o `router` do módulo, e não o `useRouter()`: ver o comentário dele.
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
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

  // E O SENTIDO CONTRÁRIO TAMBÉM É DAQUI, que é a correção do app travado pelo login da Apple.
  //
  // Isto vivia na `entrar.tsx`, num `<Redirect href="/perfis" />` — e um `<Redirect>` vale
  // outra vez A CADA RENDER da tela que o contém. Ele afirmava `/perfis` enquanto o portão do
  // consentimento afirmava `/consentimento` para quem ainda não declarou idade, cada um a
  // desfazer o do outro. O que se via era a lista de perfis desenhada com todos os toques a
  // serem engolidos; pior, a conta ficava sem consentimento nenhum registado.
  it.each([['entrar'], ['intro']])('com sessão, tira de /%s e leva aos perfis', async (rota) => {
    mockSessao = { sessao: { user: { id: 'u-1' } }, carregando: false };
    mockSegmentos = [rota];
    await render(<PortaoDaSessao />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/perfis'));
  });

  // ⚠️ MENOS NO CADASTRO, E A EXCEÇÃO É A REGRA.
  //
  // Quem confirma o código do e-mail ganha sessão e é levado pela PRÓPRIA tela a `/bem-vindo`,
  // que saúda e decide entre criar o primeiro perfil e abrir o convite de equipe à espera. Com
  // o portão a agir ali, as duas navegações correriam juntas e a última a chegar ganhava: num
  // dia mau, quem foi convidado caía em `/perfis` sem perfil nenhum, com o convite perdido e
  // sem erro nenhum à vista.
  it('com sessão, não atropela o cadastro a caminho das boas-vindas', async () => {
    mockSessao = { sessao: { user: { id: 'u-1' } }, carregando: false };
    mockSegmentos = ['cadastro'];
    await render(<PortaoDaSessao />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
