import { render, userEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { WIZARD_TOTAL_STEPS, WIZARD_VERSION } from '@maestra/core/constants/maestra';
import { store } from '@maestra/core/store/store';
import type { Artist } from '@maestra/core/interfaces/maestra';
import Inicio from '../artista/[id]/index';
import { comDiagnostico, semDiagnostico } from './fixtures';

// O fixture com diagnóstico tem estratégias mas o wizard por concluir, que é o estado mais comum
// de quem parou no meio. Para exercitar os destinos de quem TEM plano, o mesmo perfil com o
// wizard fechado: `isOnboardingComplete` cobra a versão atual e o último passo.
const comPlano: Artist = {
  ...comDiagnostico,
  id: 'a-3',
  content: { ...comDiagnostico.content, wizardVersion: WIZARD_VERSION, step: WIZARD_TOTAL_STEPS },
};

// A home é a PORTA do método: Diagnóstico, Plano de Ação e Planejamento saíram da barra de abas e
// só se alcançam pelos três cartões daqui. Um destino errado num deles não quebra nada, não dá
// erro nem tela em branco: só deixa um módulo inalcançável para quem usa, que foi exatamente como
// os atalhos do diagnóstico já sumiram uma vez.

let mockIdNaRota = comDiagnostico.id;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: mockIdNaRota }),
}));

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const semear = () =>
  store.dispatch({
    type: 'artists/fetchArtists/fulfilled',
    payload: [comDiagnostico, semDiagnostico, comPlano],
  });

const montar = () => {
  semear();
  return render(
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={MEDIDAS}>
        <Inicio />
      </SafeAreaProvider>
    </Provider>,
  );
};

beforeEach(() => {
  mockPush.mockClear();
  mockIdNaRota = comDiagnostico.id;
});

describe('a home do artista', () => {
  it('abre com os três pilares, na ordem do método', async () => {
    const tela = await montar();

    expect(tela.getByText('ONDE ESTOU')).toBeTruthy();
    expect(tela.getByText('EXECUÇÃO')).toBeTruthy();
    expect(tela.getByText('PARA ONDE IR')).toBeTruthy();
    expect(tela.getByText('Diagnóstico REAL')).toBeTruthy();
    expect(tela.getByText('Plano de Ação')).toBeTruthy();
    expect(tela.getByText('Planejamento Estratégico')).toBeTruthy();
  });

  it('com o plano pronto, cada cartão leva ao módulo dele', async () => {
    mockIdNaRota = comPlano.id;
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText(/^Diagnóstico REAL:/));
    expect(mockPush).toHaveBeenCalledWith(`/artista/${comPlano.id}/diagnostico`);

    await usuario.press(tela.getByLabelText(/^Plano de Ação:/));
    expect(mockPush).toHaveBeenCalledWith(`/artista/${comPlano.id}/plano`);

    await usuario.press(tela.getByLabelText(/^Planejamento Estratégico:/));
    expect(mockPush).toHaveBeenCalledWith(`/artista/${comPlano.id}/perfil`);
  });

  // Sem planejamento não há o que executar, e o Plano de Ação entregaria uma tela de bloqueio. O
  // cartão corta caminho e leva ao wizard — que, de dentro do perfil, nem tinha caminho antes.
  it('sem planejamento, os cartões levam ao wizard em vez da tela travada', async () => {
    mockIdNaRota = semDiagnostico.id;
    const tela = await montar();

    await userEvent.setup().press(tela.getByLabelText(/^Plano de Ação:/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/wizard/[id]',
      params: { id: semDiagnostico.id },
    });
  });

  it('o rodapé leva ao suporte e aos termos, em vez de só informar', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Suporte'));
    expect(mockPush).toHaveBeenCalledWith('/suporte');

    await usuario.press(tela.getByLabelText('Termos de uso'));
    expect(mockPush).toHaveBeenCalledWith('/legal/termos');
  });

  // O que a home deixou de ser: uma vitrine. Estes três blocos saíram, e cada um saiu por um
  // motivo diferente — o herói virou o cartão de Execução, o promo repetia o módulo Músicas e a
  // lista do catálogo vive inteira dentro dele.
  it('não repete o que já está nos cartões nem no módulo Músicas', async () => {
    const tela = await montar();

    expect(tela.queryByText('PRÓXIMA TAREFA DO PLANO')).toBeNull();
    expect(tela.queryByText('Ver Plano de Ação')).toBeNull();
    expect(tela.queryByText('Abrir músicas →')).toBeNull();
    expect(tela.queryByText('Ver planejamento →')).toBeNull();
  });
});
