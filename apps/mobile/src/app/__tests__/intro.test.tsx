import { render, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { LANDING_HERO, tituloDaLanding } from '@maestra/core/constants/landing';

import Intro from '../intro';

// A APRESENTAÇÃO — a primeira tela de quem abre o app sem conta.
//
// Antes dela, quem instalava caía direto num formulário de e-mail e senha, sem uma linha
// dizendo do que se tratava. Quem chegou por indicação e ainda não tem conta não tinha por que
// preencher nada.

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}><Intro /></SafeAreaProvider>,
);

beforeEach(() => {
  mockReplace.mockClear();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => { jest.restoreAllMocks(); });

describe('apresentação', () => {
  // A COPY É A DA LANDING, e vem do núcleo. Uma segunda versão das mesmas palavras vira uma
  // segunda promessa na primeira vez que alguém ajusta só uma delas.
  it('diz o que o app faz com as palavras da landing', async () => {
    const tela = await montar();

    expect(tela.getByText(tituloDaLanding())).toBeTruthy();
    expect(tela.getByText(LANDING_HERO.sobretitulo.toUpperCase())).toBeTruthy();
    expect(tela.getByText(LANDING_HERO.nota)).toBeTruthy();
  });

  // As frentes saem da MESMA lista que a landing usa — nada é redigitado aqui.
  it('lista as frentes da plataforma, com os títulos do núcleo', async () => {
    const tela = await montar();

    for (const titulo of ['Diagnóstico REAL', 'Planejamento estratégico', 'Plano de ação', 'Gestão completa']) {
      expect(tela.getByText(new RegExp(titulo))).toBeTruthy();
    }
    // A Nyta atravessa todos os módulos e não é uma frente à parte; "E ela só cresce" é
    // promessa de roteiro, que não cabe numa primeira tela.
    expect(tela.queryByText(/E ela só cresce/)).toBeNull();
  });

  // Os DOIS caminhos: é a diferença entre uma porta e um portão. O cadastro sai para o
  // navegador porque é lá que ele vive.
  it('oferece começar e entrar numa conta que já existe', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText(LANDING_HERO.acao));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.maestramanager.com/cadastro');

    await usuario.press(tela.getByLabelText('Já tenho conta'));
    expect(mockReplace).toHaveBeenCalledWith('/entrar');
  });

});
