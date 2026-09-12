import { render, waitFor } from '@testing-library/react-native';

import { PortaoDoConsentimento } from '@/nucleo/PortaoDoConsentimento';

// O PORTÃO DO CONSENTIMENTO (LGPD).
//
// Quem entra por Google ou Apple nunca declarou idade nem aceitou os documentos: o provedor
// devolve uma sessão e pronto. Sem este portão essa pessoa usaria o app inteiro sem nada
// registrado — e é o registro que sustenta a regra de maioridade dos Termos e da Política.

const mockReplace = jest.fn();
let mockSegmentos: string[] = ['perfis'];
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegmentos,
}));

let mockSessao: { sessao: unknown } = { sessao: { user: { id: 'u-1', email: 'a@b.c' } } };
jest.mock('@/nucleo/sessao', () => ({ useSessao: () => mockSessao }));

let mockEstado: { satisfied: boolean } | null = null;
jest.mock('@maestra/core/hooks/useConsent', () => ({
  useEstadoDoConsentimento: () => ({ state: mockEstado }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockSegmentos = ['perfis'];
  mockSessao = { sessao: { user: { id: 'u-1', email: 'a@b.c' } } };
  mockEstado = null;
});

describe('portão do consentimento', () => {
  it('quem não consentiu vai para a tela de consentimento', async () => {
    mockEstado = { satisfied: false };
    await render(<PortaoDoConsentimento />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/consentimento'));
  });

  it('quem já consentiu segue a vida', async () => {
    mockEstado = { satisfied: true };
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Trancar todo mundo do lado de fora por uma falha transitória é pior do que o risco que o
  // portão cobre, e a coleta volta a ser exigida na próxima verificação que der certo. É a
  // mesma decisão que o `RequireConsent` da web tomou.
  it('estado indisponível não tranca ninguém', async () => {
    mockEstado = null;
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sem sessão, não há o que cobrar', async () => {
    mockSessao = { sessao: null };
    mockEstado = { satisfied: false };
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Empurrar quem já está na tela para a mesma tela é um laço.
  it('não expulsa quem já está no consentimento', async () => {
    mockEstado = { satisfied: false };
    mockSegmentos = ['consentimento'];
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ⚠️ O PORTÃO NÃO PODE TRANCAR O QUE ELE PEDE PARA ACEITAR.
  //
  // A tela do consentimento liga para os Termos e para a Política, e tem um botão de falar com o
  // suporte para quem errou a data de nascimento. Enquanto esses três destinos abriam o
  // navegador, o portão nem os via. No dia em que viraram telas do app, sem a lista de livres ele
  // devolvia a pessoa ao consentimento no instante em que ela tocasse em "Termos de uso" — pedir
  // o aceite de um documento e trancar a porta do documento.
  it.each([['legal'], ['suporte']])('deixa ler o que pede para aceitar: /%s', async (segmento) => {
    mockEstado = { satisfied: false };
    mockSegmentos = [segmento];
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // E o resto continua trancado: uma lista de livres que crescesse sozinha esvaziaria o portão.
  it('o resto do app continua trancado', async () => {
    mockEstado = { satisfied: false };
    mockSegmentos = ['artista'];
    await render(<PortaoDoConsentimento />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/consentimento'));
  });
});
