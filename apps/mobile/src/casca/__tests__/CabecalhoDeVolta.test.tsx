import { render, userEvent } from '@testing-library/react-native';

import { CabecalhoDeVolta } from '@/casca/CabecalhoDeVolta';

// O cabeçalho das telas folha do sistema: um botão só, no mesmo círculo branco do sino.

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockPodeVoltar = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockPodeVoltar,
  }),
}));

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockPodeVoltar = true;
});

describe('cabeçalho de voltar', () => {
  it('volta para de onde a pessoa veio', async () => {
    const tela = await render(<CabecalhoDeVolta />);
    await userEvent.setup().press(tela.getByLabelText('Voltar'));

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Quem abre a tela por link direto chega com a pilha vazia: sem este desvio, o botão de
  // voltar não faria nada e a pessoa ficaria presa numa tela sem saída.
  it('sem pilha, cai no destino declarado', async () => {
    mockPodeVoltar = false;
    const tela = await render(<CabecalhoDeVolta />);
    await userEvent.setup().press(tela.getByLabelText('Voltar'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/perfis');
  });

  it('o destino de fallback é escolhível', async () => {
    mockPodeVoltar = false;
    const tela = await render(<CabecalhoDeVolta para="/conta" />);
    await userEvent.setup().press(tela.getByLabelText('Voltar'));

    expect(mockReplace).toHaveBeenCalledWith('/conta');
  });
});
