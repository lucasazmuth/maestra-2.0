import { render, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import Intro from '../intro';

// A APRESENTAÇÃO — a primeira tela de quem abre o app sem conta.
//
// Antes dela, quem instalava caía direto num formulário de e-mail e senha, sem uma linha
// dizendo do que se tratava. Quem chegou por indicação e ainda não tem conta não tinha por que
// preencher nada.

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockMarcar = jest.fn();
jest.mock('@/nucleo/intro', () => ({ marcarIntroComoVista: () => mockMarcar() }));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}><Intro /></SafeAreaProvider>,
);

beforeEach(() => {
  mockReplace.mockClear();
  mockMarcar.mockClear();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => { jest.restoreAllMocks(); });

describe('apresentação', () => {
  it('diz o que o app faz antes de pedir qualquer coisa', async () => {
    const tela = await montar();

    expect(tela.getByText('A carreira inteira, no seu bolso.')).toBeTruthy();
    expect(tela.getByText(/diagnóstico REAL/)).toBeTruthy();
    expect(tela.getByText(/plano de ação/)).toBeTruthy();
  });

  // Os DOIS caminhos: é a diferença entre uma porta e um portão. O cadastro sai para o
  // navegador porque é lá que ele vive.
  it('oferece criar conta e entrar numa que já existe', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Criar minha conta'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.maestramanager.com/cadastro');

    await usuario.press(tela.getByLabelText('Já tenho conta'));
    expect(mockReplace).toHaveBeenCalledWith('/entrar');
  });

  // Marca ao ABRIR, e não ao tocar num botão: quem fecha o app aqui já viu a apresentação, e
  // revê-la na próxima abertura seria insistir.
  it('se dá por vista assim que abre', async () => {
    await montar();
    expect(mockMarcar).toHaveBeenCalled();
  });
});
