// A GUIA: a soma da montagem, gerada ao sair do editor.
//
// ⚠️ NUM FICHEIRO À PARTE, E NÃO POR ARRUMAÇÃO. Gerar a guia é a única coisa desta tela que
// continua a correr DEPOIS de a pessoa sair: renderiza, codifica e sobe, com a tela já a
// caminho da lista. No jest isso deixa trabalho por entregar quando a suíte limpa a árvore — e
// o efeito não é este teste falhar, é o SEGUINTE não renderizar nada, com uma mensagem que não
// tem nada a ver com o que está partido.
//
// Um ficheiro é um ambiente: aqui a cadeia acaba com a suíte, e ninguém herda o estrago. Se um
// dia alguém juntar isto ao `jam.test.tsx`, o preço aparece três testes abaixo.
//
// ⚠️ E SÃO DOIS TESTES, NÃO TRÊS. Um terceiro montado neste ficheiro passa e falha conforme a
// corrida — tentei um, para a trava do silêncio, e ele derrubava os outros dois em metade das
// execuções. Um teste que muda de resultado sem o código mudar é pior do que não ter teste, e
// eu não consegui isolar a causa dentro de um tempo razoável.
//
// O que ficou de fora não ficou sem guarda: que a montagem muda não grava por cima da guia boa
// é regra do NÚCLEO (`temSom`, com os seus casos), e que as duas telas a chamam ANTES de
// codificar está preso no cromo do Espaço JAM, que lê os dois ficheiros.
//
// O que é da SAÍDA — que ela espera pela guia, e que a tela diz porquê — vive dentro do segundo
// caso, e não num terceiro, pela mesma razão.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { CatalogProject, CatalogTrack, CatalogVersion, CatalogVersionFile } from '@maestra/core/interfaces/maestra';


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
const mockMoverClipe = jest.fn();
const mockCriarClipe = jest.fn();
const mockMarcarApagado = jest.fn();
const mockRestaurar = jest.fn();
const mockPurgar = jest.fn();
const mockGravarFicha = jest.fn();
const mockGravarFixo = jest.fn();
const mockNovoArquivo = jest.fn();
const mockCriarPista = jest.fn();
const mockMarcarPista = jest.fn();
const mockAtualizarFaixa = jest.fn();
const mockComentarios = jest.fn();
const mockComentar = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  getCatalogProject: (...a: unknown[]) => mockBuscar(...a),
  updateCatalogProject: (...a: unknown[]) => mockAtualizar(...a),
  updateCatalogVersion: (...a: unknown[]) => mockAtualizarVersao(...a),
  setPrimaryVersion: (...a: unknown[]) => mockPrincipal(...a),
  createCatalogVersion: jest.fn(),
  deleteCatalogVersion: jest.fn(),
  addVersionFile: (...a: unknown[]) => mockNovoArquivo(...a),
  criarPistaComArquivo: (...a: unknown[]) => mockCriarPista(...a),
  marcarPistaApagada: (...a: unknown[]) => mockMarcarPista(...a),
  restaurarPista: jest.fn(),
  updateVersionFile: jest.fn(),
  // ⚠️ A PISTA DA MONTAGEM É UMA FAIXA: renomear e o volume escrevem em `catalog_tracks`.
  updateTrack: (...a: unknown[]) => mockAtualizarFaixa(...a),
  createTrack: jest.fn(),
  reorderVersionFiles: jest.fn(),
  deleteVersionFile: jest.fn(),
  listVersionComments: (...a: unknown[]) => mockComentarios(...a),
  createVersionComment: (...a: unknown[]) => mockComentar(...a),
  // ⚠️ O DUPLO LÊ OS ARGUMENTOS, e não devolve uma constante. Como constante, ele engolia um
  // `projeto` NULO que a função de verdade não engole — e a tela estourava no aparelho com
  // "Cannot read property 'id' of null" enquanto os testes passavam todos.
  catalogProjectToItem: (projeto: { id: string; artist_id: string; title: string; status: string },
    versao?: { id: string }) => ({
    id: versao?.id || projeto.id,
    project_id: projeto.id,
    artist_id: projeto.artist_id,
    title: projeto.title,
    status: projeto.status,
  }),
  saveCatalogProjectFromForm: (...a: unknown[]) => mockGravarFicha(...a),
  deleteCatalogProject: jest.fn(),
  // A montagem: mover, dividir e apagar (que MARCA, não apaga), e a limpeza do fim da sessão.
  updateClip: (...a: unknown[]) => mockMoverClipe(...a),
  createClip: (...a: unknown[]) => mockCriarClipe(...a),
  marcarClipeApagado: (...a: unknown[]) => mockMarcarApagado(...a),
  restaurarClipe: (...a: unknown[]) => mockRestaurar(...a),
  purgarMontagem: (...a: unknown[]) => mockPurgar(...a),
}));

const mockCanal = { on: jest.fn(), subscribe: jest.fn() };
mockCanal.on.mockReturnValue(mockCanal);
mockCanal.subscribe.mockReturnValue(mockCanal);
// O balde: a guia sobe para um caminho fixo, e o teste lê qual foi.
//
// ⚠️ SEM `requireActual`. Aquele módulo importa o cliente do banco no topo, e trazê-lo por aqui
// criava uma SEGUNDA instância dele dentro da fábrica do mock — a partir da primeira gravação
// da guia, toda montagem seguinte nesta suíte parava de renderizar, e a mensagem era sempre
// sobre outra coisa. As três funções que a tela usa ficam ditas à mão.
jest.mock('@maestra/core/services/armazenamento', () => ({
  BALDE_DO_CATALOGO: 'catalog',
  tipoDoCatalogo: (nome: string) => (/\.(mp3|wav)$/i.test(nome) ? 'audio/wav' : null),
  tituloDoArquivo: (nome: string) => nome.replace(/\.[^.]+$/, ''),
  gravarEmCaminhoFixo: (...a: unknown[]) => mockGravarFixo(...a),
}));

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
// O duplo do render: cada teste diz se a montagem soa a alguma coisa. Ver a trava do silêncio.
let mockRenderSilencioso = false;
jest.mock('@/nucleo/audio/contextoNativo', () => {
  const buffer = {
    duration: 180, length: 180 * 44100, numberOfChannels: 1, sampleRate: 44100,
    getChannelData: () => new Float32Array(4410),
  };
  const parametro = () => ({ value: 1, setValueAtTime: jest.fn(), setTargetAtTime: jest.fn() });
  const ganho = () => ({ gain: parametro(), connect: jest.fn(), disconnect: jest.fn() });
  // O teto do mestre: sem ele o grafo não se monta e TODA pista dá erro de carga — que foi
  // exatamente o que aconteceu no aparelho quando o teto era um compressor, que o motor do
  // telemóvel não tem.
  const teto = () => ({ curve: null, oversample: 'none', connect: jest.fn(), disconnect: jest.fn() });
  return {
    criarContextoNativo: () => ({
      currentTime: 0,
      state: 'running',
      destination: {},
      decodeAudioData: () => Promise.resolve(buffer),
      createGain: ganho,
      createWaveShaper: teto,
      // O panorama de cada pista: sem ele o grafo não se monta e toda pista dá erro de carga.
      createStereoPanner: () => ({ pan: parametro(), connect: jest.fn(), disconnect: jest.fn() }),
      createBuffer: () => ({ ...buffer, getChannelData: () => new Float32Array(4410) }),
      createBufferSource: () => ({
        buffer: null, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(),
      }),
      resume: () => Promise.resolve(),
      suspend: () => Promise.resolve(),
      close: () => Promise.resolve(),
    }),
    buscarNativo: () => Promise.resolve('/cache/pistas/falsa.wav'),
    // ⚠️ O CONTEXTO OFFLINE PRECISA DE RENDER DE VERDADE. Como objeto vazio, `renderizar`
    // estourava dentro do `try` da guia e o teste media um silêncio: a guia "não era gerada"
    // porque o duplo não sabia renderizar, e não porque a tela decidiu não a gerar.
    criarOfflineNativo: () => ({
      sampleRate: 44100,
      currentTime: 0,
      destination: {},
      createGain: ganho,
      createWaveShaper: teto,
      createStereoPanner: () => ({ pan: parametro(), connect: jest.fn(), disconnect: jest.fn() }),
      createBufferSource: () => ({
        buffer: null, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(),
      }),
      // ⚠️ MEIO SEGUNDO COM SOM, e não de silêncio. Era silêncio, e não podia ser: a tela
      // recusa-se a gravar uma guia muda por cima da que estava lá (ver `temSom`, no núcleo), e
      // com o duplo a devolver zeros o caminho feliz deixava de existir — o teste passava a
      // medir a trava, e a gravação da guia ficava sem ninguém a olhar por ela.
      startRendering: () => Promise.resolve({
        duration: 0.5, length: 22050, numberOfChannels: 1, sampleRate: 44100,
        getChannelData: () => (mockRenderSilencioso
          ? new Float32Array(22050)
          : Float32Array.from({ length: 22050 }, (_, i) => Math.sin(i / 8) * 0.5)),
      }),
    }),
  };
});

// O motor de exportação é nativo de ponta a ponta (ficheiros, ZIP, folha de partilha do
// sistema) e tem a sua própria suíte, que prova o que entra no ZIP. Aqui o que se prova é a
// LIGAÇÃO: que a aba mostra as pistas certas e que o botão chama o que deve, com o que deve.
jest.mock('@/casca/jam/mesa/exportarNativo', () => ({
  partilharStems: jest.fn(() => Promise.resolve(2)),
  partilharGuiaWav: jest.fn(() => Promise.resolve(true)),
  partilharGuiaMp3: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/nucleo/arquivos', () => ({
  escolherAudio: jest.fn(),
  escolherAudios: jest.fn(() => Promise.resolve([])),
  escolherImagem: jest.fn(),
  enviarParaOCatalogo: jest.fn(),
  // A duração é lida do próprio ficheiro, ANTES de subir: é o tamanho do clipe que vai nascer.
  segundosDoAudio: jest.fn(() => Promise.resolve(90)),
}));

const arquivo = (over: Partial<CatalogVersionFile> = {}): CatalogVersionFile => ({
  id: 'f-1', version_id: 'v-1', name: 'Voz', kind: 'stem',
  file_url: 'https://exemplo.invalid/voz.wav', position: 0, ...over,
} as CatalogVersionFile);

/** Uma pista da montagem, com um clipe do princípio ao fim do ficheiro. */
const pista = (over: Partial<CatalogTrack> = {}, arquivoId = 'f-1'): CatalogTrack => ({
  id: 't-1', version_id: 'v-1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
  clips: [{
    id: `c-${over.id ?? 't-1'}`, track_id: String(over.id ?? 't-1'), file_id: arquivoId,
    start_seconds: 0, offset_seconds: 0, duration_seconds: 30,
  }],
  ...over,
} as CatalogTrack);

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

// A montagem só se edita com permissão, e a permissão vem do artista da rota. Aqui ele é o do
// fixture: montar meio slice de redux para trocar um booleano não prova nada sobre o editor.
// `requireActual` dentro da fábrica porque o `jest.mock` é içado para antes dos imports.
jest.mock('@/nucleo/artista', () => ({
  useArtistaDaRota: () => jest.requireActual('./fixtures').comDiagnostico,
}));

/**
 * A permissão, sem montar meio slice de redux.
 *
 * ⚠️ É UM BOOLEANO QUE MUDA A TELA INTEIRA: sem ele, um convidado só de leitura veria clipes que
 * se escolhem, setas que prometem desfazer e botões de remover que o banco ia recusar. Por isso
 * ele é uma variável aqui, e não uma constante: os casos da montagem correm com permissão, e há
 * um que corre sem.
 */
let mockPodeEditar = true;
jest.mock('@maestra/core/hooks/useArtistCapabilities', () => ({
  useArtistCapabilities: () => ({ canCollaborateJam: mockPodeEditar, canEditCatalog: false }),
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}><EspacoJam /></SafeAreaProvider>,
);

describe('a guia do Espaço JAM', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderSilencioso = false;
    mockBuscar.mockResolvedValue(projeto());
    mockComentarios.mockResolvedValue([]);
    mockAtualizarVersao.mockImplementation((id, patch) => Promise.resolve(versao({ id, ...patch })));
    mockPurgar.mockResolvedValue({ pistas: 0, clipes: 0, arquivos: 0 });
    mockGravarFixo.mockResolvedValue({
      url: 'https://exemplo.invalid/guia.mp3?v=1', path: 'a-1/p-1/guia.mp3',
    });
  });

  // ⚠️ SEM MONTAGEM NÃO HÁ O QUE SOMAR. Com a Mix sintetizada sozinha, a guia sairia byte a byte
  // do mesmo áudio que já está lá — cem segundos de trabalho para regravar o ficheiro por cima
  // dele próprio. E é o caso mais comum: toda gravação começa assim.
  it('uma gravação por montar não gera guia: ela seria cópia do que já existe', async () => {
    const tela = await montar();
    await tela.findByText('FAIXAS');

    // Mexer no volume da Mix suja a montagem — e mesmo assim não há o que renderizar.
    fireEvent.press(tela.getByLabelText('Silenciar Mix'));
    fireEvent.press(tela.getAllByLabelText('Voltar para Músicas')[0]);

    await waitFor(() => expect(mockPurgar).toHaveBeenCalled());
    expect(mockGravarFixo).not.toHaveBeenCalled();
    // ⚠️ DESMONTAR À MÃO NO FIM. Quem tira esta tela do ar é o `router.back()`, que aqui é um
    // duplo: ela fica montada, com a mesa a bater o relógio e a saída ainda a terminar. O que
    // sobra disso chega depois da limpeza da suíte, e o teste SEGUINTE é que falha — montando
    // uma tela que nunca renderiza, com uma mensagem que não tem nada a ver.
    tela.unmount();
  });

  // ⚠️ A LISTA DE MÚSICAS TOCA A SOMA DA MONTAGEM. Sem isto, quem montasse quatro camadas no
  // telemóvel voltava para a lista e ouvia o áudio antigo, sem nada que explicasse porquê.

  it('sair depois de mexer na montagem gera a guia e aponta a gravação para ela', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    mockAtualizarVersao.mockResolvedValue(versao({ id: 'v-1' }));
    const tela = await montar();
    await tela.findByDisplayValue('Voz');

    // ⚠️ A SUBIDA FICA PRESA até este teste a soltar. É assim que se vê a diferença entre
    // esperar e não esperar: com o mock a resolver sozinho, as duas versões da tela passariam.
    let soltarASubida = () => {};
    mockGravarFixo.mockImplementation(() => new Promise((pronto) => {
      soltarASubida = () => pronto({
        url: 'https://exemplo.invalid/guia.mp3?v=1', path: 'a-1/p-1/guia.mp3',
      });
    }));

    // Mexer no volume de uma faixa muda a SOMA: é montagem, e não só escuta.
    fireEvent.press(tela.getByLabelText('Silenciar Voz'));
    fireEvent.press(tela.getAllByLabelText('Voltar para Músicas')[0]);

    await waitFor(() => expect(mockGravarFixo).toHaveBeenCalled());

    // ⚠️ A TELA NÃO SAIU, e diz porquê. Ela já saiu no mesmo instante, sem sinal nenhum: o
    // trabalho passava a depender de o aplicativo continuar aberto, e quem fechasse voltava a
    // uma lista que toca o áudio ANTERIOR sem nada a explicar. Uma promessa invisível é uma
    // promessa que ninguém sabe que está a quebrar.
    expect(mockBack).not.toHaveBeenCalled();
    // ⚠️ O QUANTO FALTA vem do próprio codificador. Enquanto ele não fala — a soma das faixas,
    // que no aparelho leva dezenas de segundos — o rótulo é só texto: um "0%" parado durante
    // esse tempo é o mesmo que reticências paradas, e parece uma tela pendurada. Aqui o áudio é
    // de brincadeira e a conta chega no mesmo instante, por isso o alvo aceita as duas formas;
    // quem prende o texto sem percentagem é o `rotuloDaGuia`, no núcleo.
    expect(await tela.findByText(/^Gerando a guia…/)).toBeTruthy();
    // E o X não aceita um segundo toque enquanto isso.
    expect(tela.getAllByLabelText(/^Gerando a guia…/)[0].props.accessibilityState.disabled).toBe(true);

    soltarASubida();
    // Caminho FIXO por música: cada render criando um arquivo novo deixaria trinta guias mortas
    // numa música editada trinta vezes.
    expect(mockGravarFixo.mock.calls[0][1]).toBe('a-1/p-1/guia.mp3');
    await waitFor(() => expect(mockAtualizarVersao).toHaveBeenCalledWith('v-1', expect.objectContaining({
      audio_file: 'https://exemplo.invalid/guia.mp3?v=1',
      audio_file_name: 'guia.mp3',
    })));
    await waitFor(() => expect(mockPurgar).toHaveBeenCalled());
    // E só então a tela sai.
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    tela.unmount();
  });
});
