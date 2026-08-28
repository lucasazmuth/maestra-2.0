import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import type { CatalogItem } from '@maestra/core/interfaces/maestra';
import { store } from '@maestra/core/store/store';
import Catalogo from '../catalogo/[id]';
import { comDiagnostico } from './fixtures';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a-1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

const mockListar = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  listCatalogProjectItems: (...args: unknown[]) => mockListar(...args),
}));

// Um player de mentira, com a mesma superficie do expo-audio. O que precisa ficar provado nao e
// que o audio sai — isso e do sistema — e sim QUAL fonte o app manda tocar, e que ele nunca
// deixa duas faixas no ar.
const mockPlayer = { play: jest.fn(), pause: jest.fn(), replace: jest.fn() };
let mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

const faixa = (over: Partial<CatalogItem>): CatalogItem => ({
  id: 'f-0', artist_id: 'a-1', title: 'Faixa', status: 'mixing',
  audio_file: 'https://exemplo.invalid/audio.mp3', ...over,
});

const montar = () => render(<Provider store={store}><Catalogo /></Provider>);

describe('catalogo', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    mockPlayer.replace.mockClear();
    mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
  });

  it('lista as faixas com o rotulo de status do nucleo', async () => {
    mockListar.mockResolvedValue([
      faixa({ id: 'f-1', title: 'Chuva de Março', status: 'mastering' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Chuva de Março')).toBeTruthy());
    expect(tela.getByText('Masterização')).toBeTruthy();
  });

  it('tocar uma faixa manda o player para a fonte dela', async () => {
    mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Chuva de Março' })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Chuva de Março')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Tocar Chuva de Março'));

    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://exemplo.invalid/audio.mp3' });
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  // O defeito classico de lista com som: duas faixas no ar ao mesmo tempo. Um player unico para a
  // tela torna isso impossivel — trocar de faixa e `replace`, nao um player novo.
  it('trocar de faixa substitui a fonte, em vez de somar players', async () => {
    mockListar.mockResolvedValue([
      faixa({ id: 'f-1', title: 'Primeira', audio_file: 'https://exemplo.invalid/1.mp3' }),
      faixa({ id: 'f-2', title: 'Segunda', audio_file: 'https://exemplo.invalid/2.mp3' }),
    ]);
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Primeira')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Tocar Primeira'));
    await usuario.press(tela.getByLabelText('Tocar Segunda'));

    expect(mockPlayer.replace).toHaveBeenCalledTimes(2);
    expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: 'https://exemplo.invalid/2.mp3' });
  });

  it('tocar na faixa que ja toca PAUSA, em vez de recomecar', async () => {
    mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Primeira' })]);
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Primeira')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Tocar Primeira'));
    mockStatus = { ...mockStatus, playing: true };
    // `rerender` tambem e assincrono no RNTL 14, como o `render`.
    await tela.rerender(<Provider store={store}><Catalogo /></Provider>);

    await usuario.press(tela.getByLabelText('Pausar Primeira'));

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    // E nao pode ter recarregado a fonte: isso jogaria o audio de volta ao inicio.
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  });

  it('faixa sem audio nao finge ter botao de tocar', async () => {
    mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Só a letra', audio_file: null })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByLabelText('Só a letra, sem áudio')).toBeTruthy());
  });

  it('catalogo vazio explica de onde vem o conteudo', async () => {
    mockListar.mockResolvedValue([]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Nenhuma música ainda')).toBeTruthy());
  });

  it('erro de carga diz indisponibilidade, nao ausencia', async () => {
    mockListar.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Catálogo indisponível')).toBeTruthy());
    expect(tela.queryByText('Nenhuma música ainda')).toBeNull();
  });
});
