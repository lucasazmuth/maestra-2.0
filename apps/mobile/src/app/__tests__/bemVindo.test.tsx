import { AccessibilityInfo } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { BOAS_VINDAS } from '@maestra/core/constants/landing';

import BemVindo from '../bem-vindo';

// A TELA DE BOAS-VINDAS DO APP.
//
// Ela não é decoração: é ela que DECIDE para onde vai quem acabou de criar a conta. O app não a
// tinha, e o código de confirmação levava todo mundo para a criação do primeiro perfil —
// inclusive quem foi convidado para a equipe de alguém e não veio criar perfil nenhum.

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));

const mockCount = jest.fn();
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => mockCount() }) },
}));

const mockConvites = jest.fn();
jest.mock('@maestra/core/services/db/members', () => ({ fetchPendingInvites: () => mockConvites() }));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={METRICAS}><BemVindo /></SafeAreaProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  // Com "reduzir movimento" a frase aparece inteira de uma vez: é o caminho de acessibilidade,
  // e é o que deixa o teste falar do CONTEÚDO em vez de esperar quatro segundos de digitação.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  mockCount.mockResolvedValue({ count: 0, error: null });
  mockConvites.mockResolvedValue([]);
});

describe('boas-vindas', () => {
  it('quem não tem perfil nem convite vai criar o primeiro perfil', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText(BOAS_VINDAS.botao)).toBeTruthy());
    await waitFor(() => expect(tela.getByText(BOAS_VINDAS.artista)).toBeTruthy());

    await userEvent.setup().press(tela.getByText(BOAS_VINDAS.botao));
    expect(mockReplace).toHaveBeenCalledWith('/criar-artista');
  });

  // O convite pendente NÃO conta como perfil: a contagem de artistas dá zero para quem ainda
  // não aceitou. Sem esta checagem, o convidado era empurrado a criar um perfil.
  it('quem foi convidado vê o convite, e não o formulário de perfil', async () => {
    mockConvites.mockResolvedValue([{ id: 'c1' }]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText(BOAS_VINDAS.botaoDoConvite)).toBeTruthy());
    expect(tela.getByText(BOAS_VINDAS.convidado)).toBeTruthy();

    await userEvent.setup().press(tela.getByText(BOAS_VINDAS.botaoDoConvite));
    expect(mockReplace).toHaveBeenCalledWith('/perfis');
  });

  // Trancar alguém do lado de fora por uma falha transitória é pior do que o risco: a lista de
  // perfis lida com os dois casos.
  it('se a consulta falhar, o destino seguro é a lista de perfis', async () => {
    mockCount.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText(BOAS_VINDAS.botao)).toBeTruthy());

    await userEvent.setup().press(tela.getByText(BOAS_VINDAS.botao));
    expect(mockReplace).toHaveBeenCalledWith('/perfis');
  });
});
