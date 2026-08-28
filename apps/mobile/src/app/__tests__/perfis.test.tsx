import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import Perfis from '../perfis';
import { comDiagnostico, semDiagnostico } from './fixtures';

// A sessao vem do Supabase; aqui interessa a tela, nao o login.
jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({
    sessao: { user: { id: 'u-1', email: 'artista@exemplo.com' } },
    carregando: false,
  }),
}));

// Semear pelo `fulfilled` do thunk real, e nao por um estado inventado: assim o teste passa
// pelo mesmo reducer que producao usa para guardar o resultado da busca.
const semearPerfis = (perfis: unknown[]) =>
  store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: perfis });

// `render` do RNTL 14 e assincrono.
const montar = () => render(<Provider store={store}><Perfis /></Provider>);

describe('lista de perfis', () => {
  beforeEach(() => {
    semearPerfis([comDiagnostico, semDiagnostico]);
  });

  it('mostra os perfis do usuario', async () => {
    const tela = await montar();
    expect(tela.getByText('Marina Sol')).toBeTruthy();
    expect(tela.getByText('Coletivo Norte')).toBeTruthy();
  });

  it('mostra o perfil REAL de quem ja tem diagnostico', async () => {
    const tela = await montar();
    expect(tela.getByText('Em construção')).toBeTruthy();
    // Uma acesa de quatro: e a contagem que resume o padrao na lista.
    expect(tela.getByText('1/4')).toBeTruthy();
  });

  it('diz claramente quem ainda nao tem diagnostico', async () => {
    const tela = await montar();
    expect(tela.getByText('Sem diagnóstico')).toBeTruthy();
  });

  it('perfil sem foto cai na inicial do nome, nao numa imagem quebrada', async () => {
    const tela = await montar();
    expect(tela.getByText('C')).toBeTruthy(); // Coletivo Norte
  });

  it('lista vazia nao vira tela em branco', async () => {
    semearPerfis([]);
    const tela = await montar();
    expect(tela.getByText('Nenhum perfil ainda.')).toBeTruthy();
  });
});
