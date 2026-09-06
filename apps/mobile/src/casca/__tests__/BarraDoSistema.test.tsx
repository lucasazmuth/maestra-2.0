import { render, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';

import { BarraDoSistema } from '@/casca/BarraDoSistema';

// O cabeçalho das telas que ficam FORA de um artista: perfis, configurações e notificações.
//
// As três eram irmãs com cabeçalhos diferentes — a lista de perfis tinha a barra da marca, e as
// outras duas um "‹ Perfis" solto. Três telas do mesmo sistema com três desenhos fazem o app
// parecer três aplicativos.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u-1' } }, carregando: false }),
}));

jest.mock('@maestra/core/services/db/notifications', () => ({
  countUnread: () => Promise.resolve(0),
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = (aqui?: 'perfis' | 'configuracoes') => render(
  <Provider store={store}>
    <SafeAreaProvider initialMetrics={MEDIDAS}><BarraDoSistema aqui={aqui} /></SafeAreaProvider>
  </Provider>,
);

beforeEach(() => { mockPush.mockClear(); });

describe('barra do sistema', () => {
  it('tem a marca, o sino e o menu', async () => {
    const tela = await montar();

    expect(tela.getByLabelText('Maestra. Ir para os perfis')).toBeTruthy();
    expect(tela.getByLabelText('Notificações')).toBeTruthy();
    expect(tela.getByLabelText('Menu do sistema')).toBeTruthy();
  });

  // O caminho de volta é a marca, como no cabeçalho de dentro do artista. É por isso que o
  // "‹ Perfis" solto pôde sair sem deixar ninguém preso.
  it('a marca leva aos perfis', async () => {
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText('Maestra. Ir para os perfis'));

    expect(mockPush).toHaveBeenCalledWith('/perfis');
  });

  it('o sino leva às notificações', async () => {
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText('Notificações'));

    expect(mockPush).toHaveBeenCalledWith('/notificacoes');
  });

  // A tela em que se está acende no menu — é para isso que a barra recebe `aqui`.
  it('acende no menu a tela em que se está', async () => {
    const tela = await montar('configuracoes');
    await userEvent.setup().press(tela.getByLabelText('Menu do sistema'));

    expect(tela.getByLabelText('Configurações').props.accessibilityState.selected).toBe(true);
  });
});
