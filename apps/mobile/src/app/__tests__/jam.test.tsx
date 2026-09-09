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
const mockComentarios = jest.fn();
const mockComentar = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  getCatalogProject: (...a: unknown[]) => mockBuscar(...a),
  updateCatalogProject: (...a: unknown[]) => mockAtualizar(...a),
  setPrimaryVersion: (...a: unknown[]) => mockPrincipal(...a),
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
  bpm: '128', key: 'Am',
  created_at: '2026-08-01T12:00:00Z', ...over,
} as CatalogVersion);

const projeto = (over: Partial<CatalogProject> = {}): CatalogProject => ({
  id: 'p-1', artist_id: 'a-1', title: 'Noite Clara', status: 'mixing',
  genre: 'Pop', release_date: null,
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
    mockComentarios.mockResolvedValue([]);
  });

  it('mostra a música, a ficha técnica numa linha e as versões', async () => {
    const tela = await montar();
    expect(await tela.findByText('Noite Clara')).toBeTruthy();
    // O kicker "ESPAÇO JAM" saiu: a seta de voltar e a origem já dizem onde se está, e ele
    // custava 23 pt no topo de uma tela que já tinha 441 pt antes da primeira versão.
    expect(tela.queryByText('ESPAÇO JAM')).toBeNull();
    // A ficha técnica é UMA linha, com o BPM e o tom da favorita e o gênero da música.
    expect(tela.getByText('128 BPM · Am · Pop')).toBeTruthy();
    expect(tela.getByText('guia vocal')).toBeTruthy();
    expect(tela.getByText('V1')).toBeTruthy();
  });

  // BPM, tom, gênero e data já não se editam em linha aqui: a linha-resumo e o lápis abrem a
  // MESMA ficha do catálogo. Um segundo formulário só para estes quatro faria parecer outra
  // entidade — e era a grelha 2×2 deles que custava 153 pt à tela.
  it('a linha-resumo abre a ficha da música', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Editar a ficha técnica'));
    // O campo BPM da FICHA, e não da tela: é a prova de que abriu a ficha.
    expect(await tela.findByLabelText('BPM')).toBeTruthy();
  });

  // O pedido do dono do produto, e a razão de tudo isto: a ficha mostra a FAVORITA.
  it('a ficha mostra o BPM da favorita, e não o da primeira versão da lista', async () => {
    mockBuscar.mockResolvedValue(projeto({
      primary_version_id: 'v-2',
      versions: [
        versao({ id: 'v-1', version_number: 1, bpm: '128', key: 'Am' }),
        versao({ id: 'v-2', version_number: 2, title: 'acústico', bpm: '92', key: 'D' }),
      ],
    }));

    const tela = await montar();
    expect(await tela.findByText('92 BPM · D · Pop')).toBeTruthy();
    expect(tela.queryByText(/128 BPM/)).toBeNull();
  });

  // Sem nada preenchido, a linha convida — e não mostra quatro traços, que era o que a grelha
  // fazia e o que a tornava o bloco mais alto e mais vazio da tela.
  it('sem favorita e sem dados, a linha convida a preencher', async () => {
    mockBuscar.mockResolvedValue(projeto({ primary_version_id: null, genre: null }));

    const tela = await montar();
    expect(await tela.findByText('Adicionar BPM, tom e gênero')).toBeTruthy();
    expect(tela.queryByText(/BPM ·/)).toBeNull();
  });

  // O status saiu da fila do título (onde a pílula de até 132 pt lhe roubava a largura) e
  // virou um chip que abre a Escolha por cima — a lista antiga abria NO FLUXO e empurrava a
  // tela inteira 217 pt para baixo.
  it('o chip de status abre a escolha por cima, e trocar grava', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockAtualizar.mockResolvedValue(projeto({ status: 'composition' }));

    const tela = await montar();
    await usuario.press(await tela.findByLabelText('Status: Mixagem. Toque para trocar.'));
    expect(tela.getByText('Status da música')).toBeTruthy();

    await usuario.press(tela.getByLabelText('Composição'));
    expect(mockAtualizar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(700);
    await waitFor(() => expect(mockAtualizar).toHaveBeenCalledTimes(1));
    expect(mockAtualizar.mock.calls[0][1]).toEqual({ status: 'composition' });
    jest.useRealTimers();
  });

  // ⚠️ O "Salvo" vai embora sozinho. Antes ficava para sempre: `setSelo` nunca voltava a
  // 'parado', e a linha empurrava a tela 25 pt para baixo desde a primeira edição até sair.
  it('o selo de salvo some sozinho', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockAtualizar.mockResolvedValue(projeto({ status: 'composition' }));

    const tela = await montar();
    await usuario.press(await tela.findByLabelText('Status: Mixagem. Toque para trocar.'));
    await usuario.press(tela.getByLabelText('Composição'));
    jest.advanceTimersByTime(700);
    expect(await tela.findByText('Salvo')).toBeTruthy();

    jest.advanceTimersByTime(2100);
    await waitFor(() => expect(tela.queryByText('Salvo')).toBeNull());
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
