import { render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { CatalogProject, CatalogVersion } from '@maestra/core/interfaces/maestra';

import EspacoDaVersao from '../jam/[artista]/[projeto]/[versao]';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: () => mockBack(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ artista: 'a-1', projeto: 'p-1', versao: 'v-1' }),
}));

const mockBuscar = jest.fn();
const mockComentarios = jest.fn();
const mockComentar = jest.fn();
const mockPrincipal = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  getCatalogProject: (...a: unknown[]) => mockBuscar(...a),
  listVersionComments: (...a: unknown[]) => mockComentarios(...a),
  createVersionComment: (...a: unknown[]) => mockComentar(...a),
  setPrimaryVersion: (...a: unknown[]) => mockPrincipal(...a),
  createCatalogVersion: jest.fn(),
  updateCatalogVersion: jest.fn(),
  deleteCatalogVersion: jest.fn(),
}));

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

const mockPlayer = { play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn() };
let mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

jest.mock('@/nucleo/arquivos', () => ({
  escolherAudio: jest.fn(), escolherImagem: jest.fn(),
  enviarParaOCatalogo: jest.fn(), duracaoDoAudio: jest.fn(),
}));

const versao = (over: Partial<CatalogVersion> = {}): CatalogVersion => ({
  id: 'v-1', project_id: 'p-1', version_number: 2, title: 'mix v2', duration: '3:20',
  audio_file: 'https://exemplo.invalid/mix.mp3', author_name: 'Lucas',
  created_at: '2026-08-01T12:00:00Z', ...over,
} as CatalogVersion);

const projeto = (over: Partial<CatalogProject> = {}): CatalogProject => ({
  id: 'p-1', artist_id: 'a-1', title: 'Noite Clara', status: 'mixing',
  bpm: '128', key: 'Am', genre: 'Pop', primary_version_id: 'v-1',
  versions: [versao()], ...over,
} as CatalogProject);

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}><EspacoDaVersao /></SafeAreaProvider>,
);

describe('espaço da versão', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuscar.mockResolvedValue(projeto());
    mockComentarios.mockResolvedValue([]);
    mockStatus = { playing: false, currentTime: 0, duration: 200, didJustFinish: false };
  });

  it('abre a gravação, com a ficha técnica da música', async () => {
    const tela = await montar();
    expect(await tela.findByText('mix v2')).toBeTruthy();
    expect(tela.getByText('ESPAÇO DA VERSÃO · Mixagem')).toBeTruthy();
    expect(tela.getByText('128')).toBeTruthy();
    expect(tela.getByText('Am')).toBeTruthy();
    expect(tela.getByText('Pop')).toBeTruthy();
  });

  // O áudio entra no player assim que a tela abre: é a razão de a tela existir.
  it('carrega o áudio da versão e toca', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();
    await waitFor(() => expect(mockPlayer.replace)
      .toHaveBeenCalledWith({ uri: 'https://exemplo.invalid/mix.mp3' }));

    await usuario.press(tela.getByLabelText('Tocar música'));
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  // O que distingue esta tela do resto: o comentário preso a um SEGUNDO do áudio. Sem o tempo
  // junto, ele é só mais uma linha de conversa.
  it('mostra os comentários marcados com o ponto do áudio', async () => {
    mockComentarios.mockResolvedValue([
      { id: 'c-1', version_id: 'v-1', author_name: 'Bia', text: 'sobe o vocal', time_seconds: 95 },
      { id: 'c-2', version_id: 'v-1', author_name: 'Rui', text: 'fechado', time_seconds: null },
    ]);
    const tela = await montar();

    expect(await tela.findByText('sobe o vocal')).toBeTruthy();
    expect(tela.getByText('Marcado em 1:35')).toBeTruthy();
    // O de tempo nulo não inventa um ponto.
    expect(tela.queryByText('Marcado em 0:00')).toBeNull();
  });

  // O alfinete na régua é o atalho: tocar nele leva a reprodução até o ponto comentado.
  it('o alfinete leva a reprodução ao ponto comentado', async () => {
    mockComentarios.mockResolvedValue([
      { id: 'c-1', version_id: 'v-1', author_name: 'Bia', text: 'sobe o vocal', time_seconds: 95 },
    ]);
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Ir para o comentário marcado em 1:35'));
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(95);
  });

  it('o marcador abre o campo daquele ponto, e o comentário sai com o tempo', async () => {
    mockStatus = { playing: true, currentTime: 42, duration: 200, didJustFinish: false };
    mockComentar.mockResolvedValue({
      id: 'c-9', version_id: 'v-1', author_name: 'Você', text: 'cortar aqui', time_seconds: 42,
    });
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Comentar neste ponto da música'));
    const campo = tela.getByLabelText('Comentário marcado em 0:42');
    await usuario.type(campo, 'cortar aqui');
    await usuario.press(tela.getByLabelText('Enviar comentário neste ponto'));

    await waitFor(() => expect(mockComentar).toHaveBeenCalled());
    expect(mockComentar.mock.calls[0][0]).toMatchObject({
      version_id: 'v-1', text: 'cortar aqui', time_seconds: 42,
    });
  });

  // O comentário do campo de baixo é sobre a versão inteira: sai SEM tempo.
  it('o campo da conversa manda comentário sem ponto', async () => {
    mockComentar.mockResolvedValue({
      id: 'c-8', version_id: 'v-1', author_name: 'Você', text: 'ficou boa', time_seconds: null,
    });
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.type(
      await tela.findByLabelText('Comentário sobre esta versão'), 'ficou boa',
    );
    await usuario.press(tela.getByLabelText('Enviar comentário'));

    await waitFor(() => expect(mockComentar).toHaveBeenCalled());
    expect(mockComentar.mock.calls[0][0]).toMatchObject({ text: 'ficou boa', time_seconds: null });
  });

  it('a estrela desmarca a versão principal', async () => {
    mockPrincipal.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Desmarcar V2 como versão principal'));
    await waitFor(() => expect(mockPrincipal).toHaveBeenCalledWith('p-1', null));
  });

  it('a versão que sumiu não deixa a tela em branco', async () => {
    mockBuscar.mockResolvedValue(projeto({ versions: [] }));
    const tela = await montar();
    expect(await tela.findByText('Esta versão não existe mais.')).toBeTruthy();
  });
});
