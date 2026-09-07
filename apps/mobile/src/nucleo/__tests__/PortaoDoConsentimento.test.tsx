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
});
