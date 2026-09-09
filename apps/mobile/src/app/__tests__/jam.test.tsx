import { Alert } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { CatalogProject, CatalogVersion, CatalogVersionFile } from '@maestra/core/interfaces/maestra';

import EspacoJam from '../jam/[artista]/[projeto]';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ artista: 'a-1', projeto: 'p-1' }),
}));

const mockBuscar = jest.fn();
const mockAtualizar = jest.fn();
const mockAtualizarVersao = jest.fn();
const mockPrincipal = jest.fn();
const mockComentarios = jest.fn();
const mockComentar = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  getCatalogProject: (...a: unknown[]) => mockBuscar(...a),
  updateCatalogProject: (...a: unknown[]) => mockAtualizar(...a),
  updateCatalogVersion: (...a: unknown[]) => mockAtualizarVersao(...a),
  setPrimaryVersion: (...a: unknown[]) => mockPrincipal(...a),
  createCatalogVersion: jest.fn(),
  deleteCatalogVersion: jest.fn(),
  addVersionFile: jest.fn(),
  updateVersionFile: jest.fn(),
  reorderVersionFiles: jest.fn(),
  deleteVersionFile: jest.fn(),
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

// A MESA de verdade roda aqui — é o código do núcleo, e é ele quem decide o que a tela mostra
// (quantas pistas, qual entra muda, quando o transporte deixa de estar "preparando"). O que se
// troca é só a torneira: um contexto de áudio que devolve um buffer de três minutos sem tocar
// nada, e uma busca que não vai à rede. Mockar a mesa em vez disto testaria o mock.
jest.mock('@/nucleo/audio/contextoNativo', () => {
  const buffer = {
    duration: 180, length: 180 * 44100, numberOfChannels: 1, sampleRate: 44100,
    getChannelData: () => new Float32Array(4410),
  };
  const parametro = () => ({ value: 1, setValueAtTime: jest.fn(), setTargetAtTime: jest.fn() });
  const ganho = () => ({ gain: parametro(), connect: jest.fn(), disconnect: jest.fn() });
  // O limitador do mestre: sem ele o grafo não se monta e TODA pista dá erro de carga.
  const limitador = () => ({
    threshold: parametro(), ratio: parametro(), attack: parametro(),
    release: parametro(), knee: parametro(),
    connect: jest.fn(), disconnect: jest.fn(),
  });
  return {
    criarContextoNativo: () => ({
      currentTime: 0,
      state: 'running',
      destination: {},
      decodeAudioData: () => Promise.resolve(buffer),
      createGain: ganho,
      createDynamicsCompressor: limitador,
      createBuffer: () => ({ ...buffer, getChannelData: () => new Float32Array(4410) }),
      createBufferSource: () => ({
        buffer: null, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(),
      }),
      resume: () => Promise.resolve(),
      suspend: () => Promise.resolve(),
      close: () => Promise.resolve(),
    }),
    buscarNativo: () => Promise.resolve('/cache/pistas/falsa.wav'),
  };
});

const mockEscolherAudios = jest.fn();
jest.mock('@/nucleo/arquivos', () => ({
  escolherAudio: jest.fn(),
  escolherAudios: (...a: unknown[]) => mockEscolherAudios(...a),
  paraEnvioDePista: (arquivo: { nome: string }) => ({ ...arquivo, dados: jest.fn() }),
  escolherImagem: jest.fn(),
  enviarParaOCatalogo: jest.fn(),
}));

const stem = (over: Partial<CatalogVersionFile>): CatalogVersionFile => ({
  id: 's-1', version_id: 'v-1', name: 'Voz', kind: 'stem',
  file_url: 'https://exemplo.invalid/voz.wav', position: 0, gain: 1, ...over,
} as CatalogVersionFile);

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
    mockAtualizarVersao.mockImplementation((id, patch) => Promise.resolve(versao({ id, ...patch })));
  });

  // A forma da tela: um editor. As gravações são uma fila de fichas (são ALTERNATIVAS, ouve-se
  // uma de cada vez), e as pistas empilhadas são as camadas da que está aberta.
  it('abre a gravação principal com um transporte e a pista da mix', async () => {
    const tela = await montar();
    expect(await tela.findByText('Noite Clara')).toBeTruthy();
    expect(tela.getByText('Gravações desta música')).toBeTruthy();
    expect(tela.getByText('V1')).toBeTruthy();
    // Sem stems, a mix entra sozinha e ACESA: a mesa com uma pista é o tocador da gravação, e é
    // o que toda versão que já existe hoje passa a ter sem ninguém enviar nada.
    expect(await tela.findByLabelText('Silenciar Mix ★')).toBeTruthy();
    // Três minutos vindos do buffer, e um transporte só para a gravação inteira.
    await waitFor(() => expect(tela.getByLabelText('Tocar')).toBeTruthy());
    expect(tela.getByText('3:00')).toBeTruthy();
  });

  // ⚠️ A decisão menos óbvia da mesa: com stems, a MIX ENTRA MUDA. Ela já é a soma das camadas,
  // e tocá-la junto faz cada instrumento soar duas vezes, ligeiramente desalinhado.
  it('com stems, cada camada vira uma pista e a mix entra muda', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [stem({}), stem({ id: 's-2', name: 'Bateria', position: 1 })] })],
    }));

    const tela = await montar();
    expect(await tela.findByLabelText('Ouvir Mix ★')).toBeTruthy();
    expect(tela.getByLabelText('Silenciar Voz')).toBeTruthy();
    expect(tela.getByLabelText('Silenciar Bateria')).toBeTruthy();
    // Solo e mute são ações opostas e têm alvos próprios — não são o mesmo botão.
    expect(tela.getByLabelText('Ouvir só Voz')).toBeTruthy();
    // A Mix não se renomeia, não se move e não se apaga: ela É o áudio da gravação. Só os
    // stems têm o `⋯`.
    expect(tela.getByLabelText('Opções de Voz')).toBeTruthy();
    expect(tela.queryByLabelText('Opções de Mix ★')).toBeNull();
  });

  // ⚠️ A mix já é a SOMA das pistas. Acesa junto com elas, cada instrumento soa duas vezes e o
  // volume dobra. Não dá para impedir — é o que a pessoa pediu —, mas é quase sempre engano, e
  // ouvir sem entender por que "está estranho" é pior do que ler uma frase.
  it('acender a mix com as pistas no ar avisa que o volume dobra — e avisa uma vez só', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockBuscar.mockResolvedValue(projeto({ versions: [versao({ files: [stem({})] })] }));
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Ouvir Mix ★'));
    await waitFor(() => expect(alerta).toHaveBeenCalledTimes(1));
    expect(alerta.mock.calls[0][1]).toMatch(/duas vezes/);

    // Apagar e acender de novo não repete a lição: repetida, ela vira obstáculo.
    await usuario.press(await tela.findByLabelText('Silenciar Mix ★'));
    await usuario.press(await tela.findByLabelText('Ouvir Mix ★'));
    expect(alerta).toHaveBeenCalledTimes(1);
    alerta.mockRestore();
  });

  // Sem pista nenhuma no ar não há o que dobrar: acender a mix é só ouvir a gravação.
  it('acender a mix sozinha não avisa nada', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const usuario = userEvent.setup();
    const tela = await montar();

    // Sem stems, a mix já entra acesa: apagar e acender não deve dizer nada.
    await usuario.press(await tela.findByLabelText('Silenciar Mix ★'));
    await usuario.press(await tela.findByLabelText('Ouvir Mix ★'));
    expect(alerta).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  // O aviso de peso vem ANTES de descodificar, da soma dos tamanhos: depois já não há o que
  // avisar — ou coube, ou o sistema matou o app.
  it('pistas grandes demais avisam antes de derrubar o app', async () => {
    const grande = 300 * 1024 * 1024;
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [
        stem({ id: 's-1', size_bytes: grande }),
        stem({ id: 's-2', name: 'Bateria', position: 1, size_bytes: grande }),
      ] })],
    }));

    const tela = await montar();
    expect(await tela.findByText(/São muitas pistas grandes/)).toBeTruthy();
  });

  // O que o dono do produto pediu de volta, e a razão de o rótulo existir: o número é da
  // GRAVAÇÃO, não da música. Antes disto, ninguém sabia de quem era o BPM.
  it('o BPM digitado no cabeçalho grava na gravação aberta, e não na música', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const tela = await montar();

    const campo = await tela.findByLabelText('Andamento da gravação, em BPM');
    await usuario.clear(campo);
    await usuario.type(campo, '96');

    expect(mockAtualizarVersao).not.toHaveBeenCalled();
    jest.advanceTimersByTime(700);
    await waitFor(() => expect(mockAtualizarVersao).toHaveBeenCalledTimes(1));
    expect(mockAtualizarVersao.mock.calls[0][0]).toBe('v-1');
    expect(mockAtualizarVersao.mock.calls[0][1]).toEqual({ bpm: '96', key: 'Am' });
    // A música não foi tocada: o andamento nunca foi dela.
    expect(mockAtualizar).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  // Um BPM de quatro dígitos é engano de digitação, não uma escolha. Vai para o banco como
  // "sem BPM" em vez de sujar a ficha da gravação.
  it('um BPM fora da faixa não é gravado como número', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const tela = await montar();

    const campo = await tela.findByLabelText('Andamento da gravação, em BPM');
    await usuario.clear(campo);
    await usuario.type(campo, '999');

    jest.advanceTimersByTime(700);
    await waitFor(() => expect(mockAtualizarVersao).toHaveBeenCalledTimes(1));
    expect(mockAtualizarVersao.mock.calls[0][1]).toEqual({ bpm: null, key: 'Am' });
    jest.useRealTimers();
  });

  // ⚠️ Trocar de gravação não é uma EDIÇÃO. Sem o cuidado de marcar os números da nova como já
  // gravados, o salvamento automático acharia que o valor que acabou de ser lido é uma
  // digitação e o regravaria por cima — uma escrita à toa a cada troca de ficha, que atropelaria
  // quem estivesse a editar a mesma gravação noutro lugar. (A web tinha exatamente este bug, e
  // foi um teste igual a este que o apanhou.)
  it('trocar de gravação não regrava o que acabou de ler', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [
        versao({ id: 'v-1', version_number: 1 }),
        versao({ id: 'v-2', version_number: 2, title: 'acústico', bpm: '92', key: 'D' }),
      ],
    }));
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Abrir V2, acústico'));
    await tela.findByText('de V2 · acústico');

    await new Promise((pronto) => { setTimeout(pronto, 900); });
    expect(mockAtualizarVersao).not.toHaveBeenCalled();
  });

  // Trocar de ficha é ABRIR outra gravação: o cabeçalho passa a falar dela, e o rótulo diz qual.
  it('escolher outra gravação troca os números do cabeçalho', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [
        versao({ id: 'v-1', version_number: 1, bpm: '128', key: 'Am' }),
        versao({ id: 'v-2', version_number: 2, title: 'acústico', bpm: '92', key: 'D' }),
      ],
    }));
    const usuario = userEvent.setup();
    const tela = await montar();

    // Abre na principal (v-1), e o rótulo diz de quem são os números.
    expect(await tela.findByText('de V1 · guia vocal ★')).toBeTruthy();

    await usuario.press(tela.getByLabelText('Abrir V2, acústico'));
    expect(await tela.findByText('de V2 · acústico')).toBeTruthy();
    expect(tela.getByLabelText('Andamento da gravação, em BPM').props.value).toBe('92');
    expect(tela.getByLabelText('Tom da gravação').props.value).toBe('D');
  });

  // O que sobra na linha da ficha é o que é da MÚSICA e não muda de gravação para gravação.
  it('a linha da música mostra gênero e data, e abre a ficha', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    expect(await tela.findByText('Pop')).toBeTruthy();
    await usuario.press(tela.getByLabelText('Editar as informações da música'));
    // O campo BPM da FICHA, e não o do cabeçalho: é a prova de que abriu a ficha.
    expect(await tela.findByLabelText('BPM')).toBeTruthy();
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
  it('a estrela desmarca a gravação principal', async () => {
    mockPrincipal.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Desmarcar V1 como gravação principal'));
    await waitFor(() => expect(mockPrincipal).toHaveBeenCalledWith('p-1', null));
  });

  // O que não é áudio nem sobe: a recusa é dita ANTES de gastar rede, com o nome do arquivo e
  // o motivo. Um "falhou" genérico depois do upload não ensina nada a ninguém.
  it('um arquivo que não é áudio é recusado com o motivo', async () => {
    mockEscolherAudios.mockResolvedValue([{ nome: 'letra.pdf', uri: 'file://letra.pdf' }]);
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Adicionar pistas do aparelho'));
    expect(await tela.findByText(/letra\.pdf: formato não aceito/)).toBeTruthy();
  });

  // O balão mostra QUANTOS comentários a gravação tem: um balão sem número não diz se vale
  // abrir, que é a única coisa que ele precisa dizer.
  it('o balão traz a contagem de comentários da gravação, e abre a lista', async () => {
    mockComentarios.mockResolvedValue([
      { id: 'c-1', version_id: 'v-1', author_name: 'Bia', text: 'sobe o vocal', time_seconds: 42 },
      { id: 'c-2', version_id: 'v-1', author_name: 'Lucas', text: 'fechado' },
    ]);
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Abrir 2 comentários de V1'));

    expect(await tela.findByText('sobe o vocal')).toBeTruthy();
    // O comentário preso a um ponto do áudio mostra o ponto; o solto não inventa um.
    expect(tela.getByText('0:42')).toBeTruthy();
  });

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
