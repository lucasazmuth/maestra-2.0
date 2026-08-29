import { render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { CatalogProject, CatalogVersion } from '@maestra/core/interfaces/maestra';

import EspacoJam from '../jam/[artista]/[projeto]';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ artista: 'a-1', projeto: 'p-1' }),
}));

const mockBuscar = jest.fn();
const mockAtualizar = jest.fn();
const mockPrincipal = jest.fn();
const mockConversa = jest.fn();
const mockEnviar = jest.fn();
const mockComentarios = jest.fn();
const mockComentar = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  getCatalogProject: (...a: unknown[]) => mockBuscar(...a),
  updateCatalogProject: (...a: unknown[]) => mockAtualizar(...a),
  setPrimaryVersion: (...a: unknown[]) => mockPrincipal(...a),
  listCatalogProjectMessages: (...a: unknown[]) => mockConversa(...a),
  createCatalogProjectMessage: (...a: unknown[]) => mockEnviar(...a),
  createCatalogVersion: jest.fn(),
  updateCatalogVersion: jest.fn(),
  deleteCatalogVersion: jest.fn(),
  listVersionComments: (...a: unknown[]) => mockComentarios(...a),
  createVersionComment: (...a: unknown[]) => mockComentar(...a),
  catalogProjectToItem: () => ({ id: 'v-1', artist_id: 'a-1', title: 'Noite Clara', status: 'mixing' }),
}));

const mockCanal = { on: jest.fn(), subscribe: jest.fn() };
mockCanal.on.mockReturnValue(mockCanal);
mockCanal.subscribe.mockReturnValue(mockCanal);
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    channel: () => mockCanal,
    removeChannel: jest.fn(),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

const mockPlayer = { play: jest.fn(), pause: jest.fn(), replace: jest.fn(), seekTo: jest.fn() };
const mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

jest.mock('@/nucleo/arquivos', () => ({
  escolherAudio: jest.fn(),
  escolherImagem: jest.fn(),
  enviarParaOCatalogo: jest.fn(),
}));

const versao = (over: Partial<CatalogVersion>): CatalogVersion => ({
  id: 'v-1', project_id: 'p-1', version_number: 1, title: 'guia vocal',
  audio_file: 'https://exemplo.invalid/guia.mp3', author_name: 'Lucas',
  created_at: '2026-08-01T12:00:00Z', ...over,
} as CatalogVersion);

const projeto = (over: Partial<CatalogProject> = {}): CatalogProject => ({
  id: 'p-1', artist_id: 'a-1', title: 'Noite Clara', status: 'mixing',
  bpm: '128', key: 'Am', genre: 'Pop', release_date: null,
  primary_version_id: 'v-1', versions: [versao({})], ...over,
} as CatalogProject);

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}><EspacoJam /></SafeAreaProvider>,
);

describe('espaço jam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuscar.mockResolvedValue(projeto());
    mockConversa.mockResolvedValue([]);
    mockComentarios.mockResolvedValue([]);
  });

  it('mostra a música, a ficha técnica e as versões', async () => {
    const tela = await montar();
    expect(await tela.findByText('Noite Clara')).toBeTruthy();
    expect(tela.getByText('ESPAÇO JAM')).toBeTruthy();
    expect(tela.getByLabelText('BPM').props.value).toBe('128');
    expect(tela.getByLabelText('Tom').props.value).toBe('Am');
    expect(tela.getByText('guia vocal')).toBeTruthy();
    expect(tela.getByText('V1')).toBeTruthy();
  });

  // O que separa esta tela de uma lista qualquer: a ficha grava sozinha. Sem isso, mexer no BPM
  // no meio de uma sessão pede uma volta ao botão Salvar que a web não pede.
  it('a ficha técnica salva sozinha depois da última tecla', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockAtualizar.mockResolvedValue(projeto({ bpm: '140' }));

    const tela = await montar();
    await waitFor(() => expect(tela.getByLabelText('BPM')).toBeTruthy());
    await usuario.clear(tela.getByLabelText('BPM'));
    await usuario.type(tela.getByLabelText('BPM'), '140');

    // Antes do prazo não grava: senão seria uma escrita por tecla digitada.
    expect(mockAtualizar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(700);
    await waitFor(() => expect(mockAtualizar).toHaveBeenCalledTimes(1));
    expect(mockAtualizar.mock.calls[0][1]).toMatchObject({ bpm: '140' });
    jest.useRealTimers();
  });

  // A estrela alterna nos DOIS sentidos: tocar na acesa desmarca, e a música fica sem principal
  // até outra ser escolhida. Marcar sempre-para-frente foi o desenho que a web recusou.
  it('a estrela desmarca a versão principal', async () => {
    mockPrincipal.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    const tela = await montar();

    const estrela = await tela.findByLabelText('Desmarcar V1 como versão principal');
    await usuario.press(estrela);
    await waitFor(() => expect(mockPrincipal).toHaveBeenCalledWith('p-1', null));
  });

  it('manda a mensagem para o chat do projeto', async () => {
    mockEnviar.mockResolvedValue({ id: 'm-1', author_name: 'Você', text: 'subi a mix', created_at: '2026-08-02T10:00:00Z' });
    const usuario = userEvent.setup();
    const tela = await montar();

    const campo = await tela.findByLabelText('Mensagem para o chat do projeto');
    await usuario.type(campo, 'subi a mix');
    await usuario.press(tela.getByLabelText('Enviar mensagem'));

    await waitFor(() => expect(mockEnviar).toHaveBeenCalled());
    expect(mockEnviar.mock.calls[0][0]).toMatchObject({ project_id: 'p-1', text: 'subi a mix' });
    expect(await tela.findByText('subi a mix')).toBeTruthy();
  });

  // Sem áudio a versão não toca — e o botão precisa dizer isso, senão a pessoa toca e nada
  // acontece sem explicação.
  it('a versão sem áudio não toca', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ audio_file: null })], primary_version_id: null,
    }));
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Nenhum áudio anexado'));
    expect(mockPlayer.replace).not.toHaveBeenCalled();
    expect(tela.getByText('Nenhum áudio anexado')).toBeTruthy();
  });

  // O balão mostra QUANTOS comentários a versão tem: um balão sem número não diz se vale abrir,
  // que é a única coisa que ele precisa dizer.
  it('o balão traz a contagem de comentários da versão, e abre a lista', async () => {
    mockComentarios.mockResolvedValue([
      { id: 'c-1', version_id: 'v-1', author_name: 'Bia', text: 'sobe o vocal', time_seconds: 42 },
      { id: 'c-2', version_id: 'v-1', author_name: 'Lucas', text: 'fechado' },
    ]);
    const usuario = userEvent.setup();
    const tela = await montar();

    const balao = await tela.findByLabelText('Abrir 2 comentários de V1');
    await usuario.press(balao);

    expect(await tela.findByText('sobe o vocal')).toBeTruthy();
    // O comentário preso a um ponto do áudio mostra o ponto; o solto não inventa um.
    expect(tela.getByText('0:42')).toBeTruthy();
  });

  // A onda é do wavesurfer, dentro de um WebView; o que é NOSSO aqui é o atalho para a
  // visualização completa — a tela em que o comentário se prende a um ponto do áudio.
  it('o botão de expandir abre o Espaço da versão', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Abrir a visualização completa de V1'));
    expect(mockPush).toHaveBeenCalledWith('/jam/a-1/p-1/v-1');
  });

  it('sem versões, convida a mandar a primeira', async () => {
    mockBuscar.mockResolvedValue(projeto({ versions: [], primary_version_id: null }));
    const tela = await montar();
    expect(await tela.findByText('Este Espaço JAM ainda não tem uploads.')).toBeTruthy();
  });
});
