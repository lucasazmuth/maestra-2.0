import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import { useArtistaDaRota } from '../artista';

let mockSessao: unknown = { user: { id: 'u-1' } };
jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: mockSessao, carregando: false }),
}));

const mockBuscar = jest.fn();
jest.mock('@maestra/core/store/slices/artists', () => {
  const real = jest.requireActual('@maestra/core/store/slices/artists');
  // `__esModule` e o `default` precisam sobreviver: o `default` deste modulo E o reducer de
  // artistas, e sem ele o `configureStore` monta um estado sem `artists` — o erro que aparece
  // e "Cannot read properties of undefined (reading 'items')", que nao aponta para o mock.
  return {
    __esModule: true,
    ...real,
    default: real.default,
    artistsActions: {
      ...real.artistsActions,
      fetchArtists: (id: string) => {
        mockBuscar(id);
        return { type: 'artists/fetchArtists/pending' };
      },
    },
  };
});

const Espia = ({ id }: { id: string }) => {
  const artista = useArtistaDaRota(id);
  return <Text>{artista?.name ?? 'sem artista'}</Text>;
};

const montar = (id: string) =>
  render(<Provider store={store}><Espia id={id} /></Provider>);

const semear = (itens: unknown[]) =>
  store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: itens });

describe('artista da rota', () => {
  beforeEach(() => {
    mockBuscar.mockReset();
    mockSessao = { user: { id: 'u-1' } };
  });

  it('devolve o artista quando ele ja esta carregado, sem buscar de novo', async () => {
    semear([{ id: 'a-1', user_id: 'u-1', name: 'Marina Sol', content: {} }]);
    const tela = await montar('a-1');

    expect(tela.getByText('Marina Sol')).toBeTruthy();
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  // O caso do deep link e, em breve, o da notificacao push: quem chega por ali nao passou pela
  // lista, entao ninguem disparou a busca — e a tela mostrava "Perfil" e nenhum dado.
  it('busca quando o store esta vazio', async () => {
    store.dispatch({ type: 'auth/clearAuth' });
    await montar('a-1');
    expect(mockBuscar).toHaveBeenCalledWith('u-1');
  });

  // Sem esta trava, um id que nao pertence a pessoa dispararia uma busca a cada render.
  it('nao busca em laco quando o id nao existe na conta', async () => {
    semear([{ id: 'a-1', user_id: 'u-1', name: 'Marina Sol', content: {} }]);
    const tela = await montar('nao-existe');

    expect(tela.getByText('sem artista')).toBeTruthy();
    expect(mockBuscar).not.toHaveBeenCalled();
  });
});
