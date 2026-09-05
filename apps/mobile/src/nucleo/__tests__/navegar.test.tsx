import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useVoltar } from '../navegar';

const mockPodeVoltar = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => mockPodeVoltar(),
    back: mockBack,
    replace: mockReplace,
  }),
}));

// `router.back()` sozinho falha com "The action 'GO_BACK' was not handled" quando a tela é a
// PRIMEIRA da pilha. Não é caso raro: acontece em todo deep link, e vai acontecer em toda
// notificação push tocada — o botão de voltar viraria um beco sem saída.

const Tela = ({ destino }: { destino: string }) => {
  const voltar = useVoltar(destino as never);
  voltar();
  return <Text>tela</Text>;
};

describe('voltar', () => {
  beforeEach(() => {
    mockPodeVoltar.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
  });

  it('com pilha, volta normalmente', async () => {
    mockPodeVoltar.mockReturnValue(true);
    await render(<Tela destino="/perfis" />);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sem pilha, vai para o destino em vez de falhar', async () => {
    mockPodeVoltar.mockReturnValue(false);
    await render(<Tela destino="/perfis" />);

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/perfis');
  });
});
