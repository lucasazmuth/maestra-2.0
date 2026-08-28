import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import Perfil from '../perfil/[id]';
import { comDiagnostico, semDiagnostico } from './fixtures';

// O prefixo  nao e estilo: o jest recusa a fabrica de  que referencia
// variavel de fora do escopo, e abre excecao so para nomes que comecam assim.
// O prefixo `mock` nao e estilo: o jest recusa fabrica de `jest.mock` que referencie variavel
// de fora do escopo, e abre excecao apenas para nomes que comecam assim.
let mockIdNaRota = comDiagnostico.id;
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockIdNaRota }),
  useRouter: () => ({ back: jest.fn() }),
}));

const semear = () =>
  store.dispatch({
    type: 'artists/fetchArtists/fulfilled',
    payload: [comDiagnostico, semDiagnostico],
  });

const montar = () => render(<Provider store={store}><Perfil /></Provider>);

describe('diagnostico REAL em leitura', () => {
  beforeEach(() => {
    semear();
    mockIdNaRota = comDiagnostico.id;
  });

  it('mostra o perfil que o motor atribuiu', async () => {
    const tela = await montar();
    expect(tela.getByText('Em construção')).toBeTruthy();
    expect(tela.getByText('Alcance crescendo, receita ainda irregular.')).toBeTruthy();
  });

  // A tela nao calcula: o `realIndex` vem gravado. Se um numero aqui divergir do que o motor
  // produziu, o erro esta no DESENHO — e e exatamente isso que este teste protege.
  it('desenha o boletim com as quatro notas do indice, sem recalcular', async () => {
    const tela = await montar();
    for (const nota of ['78', '34', '51', '12']) {
      expect(tela.getByText(nota)).toBeTruthy();
    }
  });

  it('nomeia as quatro dimensoes', async () => {
    const tela = await montar();
    for (const nome of ['Reach', 'Economics', 'Audience', 'Legitimacy']) {
      expect(tela.getByText(nome)).toBeTruthy();
    }
  });

  // Sem a linha de corte, o numero nao diz se a dimensao acendeu — 78 e muito ou pouco?
  it('diz qual e a linha de acender', async () => {
    const tela = await montar();
    expect(tela.getByText(/linha de 70/)).toBeTruthy();
  });

  it('mostra as leituras do perfil', async () => {
    const tela = await montar();
    expect(tela.getByText('O alcance já sustenta um show fora da cidade.')).toBeTruthy();
    expect(tela.getByText('A receita depende de um único canal.')).toBeTruthy();
  });

  it('perfil sem diagnostico explica o que fazer, em vez de mostrar tela vazia', async () => {
    mockIdNaRota = semDiagnostico.id;
    const tela = await montar();
    expect(tela.getByText('Sem diagnóstico ainda')).toBeTruthy();
    expect(tela.queryByText('Boletim')).toBeNull();
  });
});
