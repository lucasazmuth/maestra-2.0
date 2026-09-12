import { StrictMode } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { CatalogProject, CatalogTrack, CatalogVersion, CatalogVersionFile } from '@maestra/core/interfaces/maestra';
import { AVISO_DE_ARMAR } from '@maestra/core/constants/maestra';

import { partilharStems } from '@/casca/jam/mesa/exportarNativo';
import { enviarParaOCatalogo, escolherAudio, escolherAudios } from '@/nucleo/arquivos';
import { criarOfflineNativo } from '@/nucleo/audio/contextoNativo';

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
const mockCriarFaixa = jest.fn();
const mockMarcarPista = jest.fn();
const mockAtualizarFaixa = jest.fn();
const mockConversa = jest.fn((..._a: unknown[]): Promise<unknown[]> => Promise.resolve([]));
const mockFalar = jest.fn();
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
  createTrack: (...a: unknown[]) => mockCriarFaixa(...a),
  reorderVersionFiles: jest.fn(),
  deleteVersionFile: jest.fn(),
  listVersionComments: (...a: unknown[]) => mockComentarios(...a),
  // A conversa do projeto: a tabela, a RLS e o realtime nunca saíram do ar.
  listCatalogProjectMessages: (...a: unknown[]) => mockConversa(...a),
  createCatalogProjectMessage: (...a: unknown[]) => mockFalar(...a),
  createVersionComment: (...a: unknown[]) => mockComentar(...a),
  // ⚠️ O DUPLO LÊ OS ARGUMENTOS, e não devolve uma constante. Como constante, ele engolia um
  // `projeto` NULO que a função de verdade não engole — e a tela estourava no aparelho com
  // "Cannot read property 'id' of null" enquanto os testes passavam todos.
  //
  // ⚠️ E CARREGA OS CAMPOS DA FICHA, e não só a identidade. Enquanto devolvia quatro campos, a
  // ficha do editor recebia uma música sem responsável, sem gênero e sem detalhes a cada
  // remendo da tela — e um teste que gravasse um deles via a escolha apagar-se sozinha sem que
  // houvesse defeito nenhum no produto.
  catalogProjectToItem: (
    projeto: Record<string, unknown> & { id: string },
    versao?: Record<string, unknown> & { id: string },
  ) => ({
    id: versao?.id || projeto.id,
    project_id: projeto.id,
    version_id: versao?.id,
    artist_id: projeto.artist_id,
    title: projeto.title,
    status: projeto.status,
    assignee: projeto.assignee,
    details: projeto.details,
    release_date: projeto.release_date,
    cover_image: projeto.cover_image,
    cover_image_name: projeto.cover_image_name,
    genre: versao?.genre ?? projeto.genre,
    bpm: versao?.bpm ?? projeto.bpm,
    key: versao?.key ?? projeto.key,
    lyrics: versao?.lyrics,
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
// A equipe do artista, para o campo Responsável da ficha.
jest.mock('@maestra/core/services/db/members', () => ({
  listMembers: () => Promise.resolve([
    { id: 'm-1', user_id: 'u-2', name: 'Bia', email: 'bia@x.com', status: 'active' },
    { id: 'm-2', user_id: 'u-3', name: 'Convidado', email: 'c@x.com', status: 'pending' },
  ]),
}));

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
    criarOfflineNativo: jest.fn(() => ({
      sampleRate: 44100,
      currentTime: 0,
      destination: {},
      createGain: ganho,
      createWaveShaper: teto,
      createStereoPanner: () => ({ pan: parametro(), connect: jest.fn(), disconnect: jest.fn() }),
      createBufferSource: () => ({
        buffer: null, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(),
      }),
      // Meio segundo de silêncio: o que interessa é o caminho, não o som.
      startRendering: () => Promise.resolve({
        duration: 0.5, length: 22050, numberOfChannels: 1, sampleRate: 44100,
        getChannelData: () => new Float32Array(22050),
      }),
    })),
  };
});

// ⚠️ O RENDER É O QUE SE ESPIA, e não a gravação no balde. O duplo acima rende meio segundo de
// SILÊNCIO, e silêncio a tela recusa-se a gravar por cima da guia boa (ver `temSom`): espiar o
// `gravarEmCaminhoFixo` para provar que "só fechar" não gera a guia é medir o duplo, não a
// tela — passava na mesma com a tela a gerar. Pedir o contexto offline é o primeiro gesto de
// quem vai render, e acontece antes de qualquer decisão sobre o som.
const mockOffline = criarOfflineNativo as jest.Mock;

// O motor de exportação é nativo de ponta a ponta (ficheiros, ZIP, folha de partilha do
// sistema) e tem a sua própria suíte, que prova o que entra no ZIP. Aqui o que se prova é a
// LIGAÇÃO: que a aba mostra as pistas certas e que o botão chama o que deve, com o que deve.
jest.mock('@/casca/jam/mesa/exportarNativo', () => ({
  partilharStems: jest.fn(() => Promise.resolve(2)),
  partilharGuiaWav: jest.fn(() => Promise.resolve(true)),
  partilharGuiaMp3: jest.fn(() => Promise.resolve()),
}));

// O detector de andamento. O duplo é mutável: cada teste diz o que a máquina "ouviu", e se já
// havia uma análise a correr quando a tela abriu — que é o caminho por onde o resultado chega
// sem que esta tela tenha pedido nada.
let mockAnalise: { bpm?: number } | null = null;
let mockEmCurso = false;
const mockPedir = jest.fn(() => Promise.resolve());
jest.mock('@maestra/core/hooks/useAnaliseDaVersao', () => ({
  useAnaliseDaVersao: () => ({
    analise: mockAnalise,
    trabalhos: [],
    carregando: false,
    emCurso: () => mockEmCurso,
    // A oferta "Detectar BPM e tom" vive na ficha, e ela pergunta pelo último erro antes de se
    // desenhar: sem este, a aba da ficha estourava assim que passou a receber a gravação.
    ultimoErro: () => null,
    pedindo: null,
    erro: null,
    podeCancelar: () => false,
    cancelar: jest.fn(),
    recarregar: jest.fn(),
    pedir: mockPedir,
  }),
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

/**
 * A mesma tela, com os efeitos a correr DUAS vezes.
 *
 * É o que o `StrictMode` faz de propósito, e é também o que o Fast Refresh do Metro faz a cada
 * gravação de um ficheiro: monta, limpa, monta outra vez, sem desmontar o componente.
 */
const montarEmDobro = () => render(
  <StrictMode>
    <SafeAreaProvider initialMetrics={MEDIDAS}><EspacoJam /></SafeAreaProvider>
  </StrictMode>,
);

/**
 * Abre a aba do Mixer.
 *
 * ⚠️ O EDITOR PASSOU A ABRIR NA LINHA DO TEMPO, como a web: ela é a cara dele, e chegar ao
 * Espaço JAM por um ecrã de faders é chegar a outro produto. Os casos que exercitam a MESA
 * (mutar, solar, o fader, a mix muda) passam por aqui primeiro — e é bom que passem, porque
 * cada um deles prova de caminho que a troca de aba funciona.
 */
const abrirOMixer = async (tela: Awaited<ReturnType<typeof montar>>) => {
  await tela.findByLabelText('Mixer');
  fireEvent.press(tela.getByLabelText('Mixer'));
};

describe('espaço jam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuscar.mockResolvedValue(projeto());
    mockComentarios.mockResolvedValue([]);
    mockConversa.mockResolvedValue([]);
    mockAtualizarVersao.mockImplementation((id, patch) => Promise.resolve(versao({ id, ...patch })));
    mockPurgar.mockResolvedValue({ pistas: 0, clipes: 0, arquivos: 0 });
    mockMoverClipe.mockResolvedValue(null);
    mockMarcarApagado.mockResolvedValue(undefined);
    mockAnalise = null;
    mockEmCurso = false;
    mockGravarFixo.mockResolvedValue({ url: 'https://exemplo.invalid/guia.mp3?v=1', path: 'a-1/p-1/guia.mp3' });
    mockRestaurar.mockResolvedValue(undefined);
  });

  // ⚠️ A GUARDA DE "AINDA ESTOU MONTADA" TEM DE SE REARMAR. O React reexecuta efeitos sem
  // desmontar o componente: o `StrictMode` fá-lo no arranque e o Fast Refresh do Metro a cada
  // gravação de um ficheiro. Com a guarda posta só no `useRef` e limpa só na limpeza, a segunda
  // passagem deixava-a em `false` para sempre — e a partir daí TODA leitura do banco era feita
  // e deitada fora.
  //
  // O sintoma não era um erro: era a tela a CONGELAR na montagem que já tinha. O editor passou
  // uma sessão inteira a mostrar duas faixas com três no banco, e o desfazer pareceu não
  // funcionar — ele gravava certo, e o `buscar()` que vinha a seguir não chegava à tela.
  //
  // Aqui isso aparece já na primeira leitura: sem a rearmação, o editor nunca sai da espera.
  it('sobrevive aos efeitos correrem duas vezes, como no Fast Refresh', async () => {
    const tela = await montarEmDobro();

    expect(await tela.findByText('FAIXAS')).toBeTruthy();
    tela.unmount();
  });


  // ⚠️ VOLTAR AO INÍCIO E REPETIR CHEGARAM DA WEB. A mesa do núcleo já sabia fazer as duas desde
  // que o transporte da web as ganhou; o app é que não as oferecia. Sem a primeira, recomeçar
  // obriga a acertar o zero da régua com o dedo; sem a segunda, ouvir uma montagem em ciclo — que
  // é o que se faz o dia inteiro ao misturar — pede um toque a cada volta.
  it('o transporte tem voltar ao início e repetir, como o da web', async () => {
    const tela = await montar();
    expect(await tela.findByLabelText('Voltar ao início')).toBeTruthy();
    expect(tela.getByLabelText('Repetir do início ao fim')).toBeTruthy();
  });

  // O vocabulário da tela é "faixa", como na web desde a renomeação do Espaço JAM.
  it('fala em faixas, e não em pistas', async () => {
    const tela = await montar();
    await tela.findByLabelText('Voltar ao início');
    expect(tela.queryByLabelText(/\bpistas?\b/i)).toBeNull();
  });

  // ⚠️ O EDITOR ABRE NA LINHA DO TEMPO, e não na mesa. Ela é a cara dele: é onde se vê o que a
  // música TEM. Chegar ao Espaço JAM por um ecrã de faders, sem uma onda à vista, é chegar a
  // outro produto. Ver não é montar, e ver é o que ela faz bem no aparelho.
  it('abre na linha do tempo, com a régua e as faixas', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();

    expect(await tela.findByText('FAIXAS')).toBeTruthy();
    // O nome da faixa aparece na coluna, que fica FORA da rolagem horizontal — é ela que diz de
    // quem é cada onda quando se rola para o lado. É um CAMPO, como na web: renomear a faixa
    // faz-se onde ela está, e não num menu.
    expect(tela.getByDisplayValue('Voz')).toBeTruthy();
    // E os quatro botões da faixa: calar, ouvir só ela, armar para gravar, e enviar um áudio
    // direto para ela — sem o último, uma faixa que ficou sem áudio virava um beco.
    expect(tela.getByLabelText('Silenciar Voz')).toBeTruthy();
    expect(tela.getByLabelText('Ouvir só Voz')).toBeTruthy();
    expect(tela.getByLabelText('Armar Voz para gravar')).toBeTruthy();
    expect(tela.getByLabelText('Enviar um áudio para Voz')).toBeTruthy();
    // E a mesa não está à vista: é a outra aba.
    expect(tela.queryByLabelText('Volume de Voz')).toBeNull();
  });

  // As duas metades da mesma gravação: uma diz ONDE cada som está no tempo, a outra QUANTO de
  // cada um se ouve. Trocar de aba é olhar de outro sítio, e não recomeçar.
  it('a aba do Mixer traz a mesa de volta, e a linha do tempo sai de cena', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();

    await abrirOMixer(tela);
    expect(await tela.findByLabelText('Silenciar Voz')).toBeTruthy();
    expect(tela.queryByText('FAIXAS')).toBeNull();

    fireEvent.press(tela.getByLabelText('Timeline'));
    expect(await tela.findByText('FAIXAS')).toBeTruthy();
  });

  // O zoom é da linha do tempo, e afastar tem de chegar ao ponto em que a música inteira cabe:
  // sem isso, quem aproximasse uma vez não voltava a vê-la toda.
  it('a linha do tempo tem zoom', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();

    expect(await tela.findByLabelText('Aproximar a linha do tempo')).toBeTruthy();
    expect(tela.getByLabelText('Afastar a linha do tempo')).toBeTruthy();
  });

  // ⚠️ APAGAR MARCA, E NÃO APAGA (mesma regra da web, e ela não é da tela: vive no núcleo). A
  // linha fica no banco até a sessão fechar, e é isso que dá à seta do desfazer alguma coisa
  // para onde voltar. Sem isto, remover um clipe no aparelho seria definitivo enquanto na web é
  // reversível — a mesma ação com dois significados, conforme o aparelho.
  // ⚠️ "+ ADICIONAR FAIXA" PEDIA UM FICHEIRO, e era a coisa errada: não havia como preparar a
  // montagem — voz, guitarra, bateria — antes de ter o áudio de cada uma, e quem só queria mais
  // uma linha para largar um clipe tinha de arranjar um ficheiro primeiro.
  it('adicionar faixa cria a faixa vazia, sem pedir áudio nenhum', async () => {
    mockCriarFaixa.mockResolvedValue({ id: 't-2', version_id: 'v-1', name: 'Faixa 1' });
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();
    await tela.findByText('FAIXAS');

    fireEvent.press(tela.getByLabelText('Adicionar faixa'));

    await waitFor(() => expect(mockCriarFaixa).toHaveBeenCalledTimes(1));
    // `Faixa 1`, e não `Faixa 2`: a que já lá está chama-se "Voz", e quem baptizou uma faixa
    // não fica a dever um número.
    expect(mockCriarFaixa.mock.calls[0][0]).toMatchObject({
      version_id: 'v-1', name: 'Faixa 1', position: 1, gain: 1, muted: false,
    });
    // ⚠️ E NENHUM SELETOR DE FICHEIROS SE ABRE. Encher a faixa é o outro botão, o da própria
    // faixa — e é ele que continua a pedir o áudio.
    expect(escolherAudio).not.toHaveBeenCalled();
  });

  // ⚠️ O CLIPE DIZ QUE FICHEIRO TOCA, escrito no canto — é o rótulo que a web sempre teve e
  // que aqui não existia: o canto ficava vazio, e a diferença era uma daquelas que ninguém vê
  // até precisar de distinguir a voz da dobra por cima de duas ondas parecidas.
  it('o clipe mostra o nome do ficheiro, e volta ao take quando não há nome', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({
        files: [arquivo({ name: 'voz dobra.wav' })],
        tracks: [pista()],
      })],
    }));
    const tela = await montar();
    await tela.findByText('FAIXAS');

    expect(tela.getByText('voz dobra')).toBeTruthy();
    // E não a numeração, que era o que estava aqui na web e nada aqui.
    expect(tela.queryByText('Take 1')).toBeNull();
  });

  // Sem ficheiro com nome não há o que escrever, e o número do trecho é melhor do que um canto
  // vazio: ele continua a distinguir dois clipes da mesma faixa.
  it('sem nome de ficheiro, o clipe volta ao número do take', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo({ name: '' })], tracks: [pista()] })],
    }));
    const tela = await montar();
    await tela.findByText('FAIXAS');

    expect(tela.getByText('Take 1')).toBeTruthy();
  });

  it('remover um clipe marca, e o desfazer devolve', async () => {
    const comClipe = projeto({ versions: [versao({ files: [arquivo()], tracks: [pista()] })] });
    const semClipe = projeto({
      versions: [versao({ files: [arquivo()], tracks: [{ ...pista(), clips: [] }] })],
    });
    mockBuscar.mockResolvedValue(comClipe);

    // ⚠️ OS DUPLOS TÊM DE APAGAR DE VERDADE. Marcar um clipe tira-o da leitura seguinte, e é
    // isso que a seta confere antes de andar: ela só desfaz se o mundo ainda estiver como o
    // passo o deixou. Com o duplo a devolver sempre a montagem completa, a tela via o clipe
    // ainda lá, concluía que outra pessoa o tinha trazido de volta, e recusava-se a desfazer —
    // um teste a medir o duplo, e não o produto.
    mockMarcarApagado.mockImplementation(() => {
      mockBuscar.mockResolvedValue(semClipe);
      return Promise.resolve();
    });
    mockRestaurar.mockImplementation(() => {
      mockBuscar.mockResolvedValue(comClipe);
      return Promise.resolve();
    });

    const tela = await montar();
    await tela.findByText('FAIXAS');

    // Escolher o clipe é o que revela as ações: no aparelho, sem escolher não há o que tocar.
    fireEvent.press(await tela.findByLabelText('Trecho 1 de Voz'));
    fireEvent.press(await tela.findByLabelText('Remover o clipe'));

    await waitFor(() => expect(mockMarcarApagado).toHaveBeenCalledWith('c-t-1'));
    // E nunca o apagar de verdade: esse é do fim da sessão, e reconhece-se pelo `apenas` — a
    // varredura da ABERTURA também chama esta função, com `antesDe`, e não conta.
    expect(mockPurgar).not.toHaveBeenCalledWith(
      'v-1', expect.objectContaining({ apenas: expect.anything() }),
    );

    // A seta acorda e diz o que vai desmanchar.
    const seta = await tela.findByLabelText('Desfazer: remover o clipe');
    fireEvent.press(seta);
    await waitFor(() => expect(mockRestaurar).toHaveBeenCalledWith('c-t-1'));
  });

  // ⚠️ A SESSÃO FECHA E O QUE FOI APAGADO SAI DE VERDADE. É o outro lado do desfazer: fechada a
  // tela, não há mais quem chame a linha de volta, e guardá-la seria resíduo a acumular.
  it('sair do editor apaga de verdade o que foi marcado', async () => {
    const tela = await montar();
    await tela.findByText('FAIXAS');

    fireEvent.press(tela.getAllByLabelText('Voltar para Músicas')[0]);
    // ⚠️ A SAÍDA ESPERA PELA GUIA. Ela é gerada no mesmo instante, e a purga acontece depois —
    // por isso a asserção passou a ser assíncrona: seca, ela media o estado de meio caminho.
    //
    // ⚠️ E LEVA SÓ O QUE ESTA SESSÃO MARCOU. Nada marcado aqui: a lista vai vazia, e a purga
    // não toca no que a outra pessoa ainda pode desfazer.
    await waitFor(() => expect(mockPurgar).toHaveBeenCalledWith('v-1', { apenas: [] }));
  });

  // ⚠️ A MIX NÃO SE MEXE: ela é o áudio da própria gravação, e renomeá-la ou apagá-la é mexer na
  // gravação. O M e o S ficam — ouvir só a mistura, ou calá-la para ouvir as camadas, é
  // exatamente o que se faz com ela.
  it('a faixa da Mix não se renomeia, não se apaga e não recebe áudio', async () => {
    // Sem faixas, a montagem é só a Mix sintetizada a partir do áudio da gravação.
    const tela = await montar();
    await tela.findByText('FAIXAS');

    expect(tela.queryByLabelText('Apagar a faixa Mix')).toBeNull();
    expect(tela.queryByLabelText('Enviar um áudio para Mix')).toBeNull();
    expect(tela.queryByLabelText('Armar Mix para gravar')).toBeNull();
    // O campo do nome existe, mas travado.
    expect(tela.getByDisplayValue('Mix').props.editable).toBe(false);
    // E o que é de escuta continua lá.
    expect(tela.getByLabelText('Silenciar Mix')).toBeTruthy();
    expect(tela.getByLabelText('Ouvir só Mix')).toBeTruthy();
  });
  // ⚠️ SEM PERMISSÃO, A MONTAGEM SÓ SE VÊ. Um convidado de leitura veria clipes que se escolhem,
  // setas que prometem desfazer e botões de remover que o banco ia recusar — e a recusa chegaria
  // como "Falha ao salvar", que não explica nada a quem nunca teve permissão.
  it('quem não pode editar não vê as setas nem as ações do clipe', async () => {
    mockPodeEditar = false;
    try {
      mockBuscar.mockResolvedValue(projeto({
        versions: [versao({ files: [arquivo()], tracks: [pista()] })],
      }));
      const tela = await montar();
      await tela.findByText('FAIXAS');

      // ⚠️ ESPERAR O TOQUE PEGAR ANTES DE AFIRMAR A AUSÊNCIA. Sem isto o teste passava pelo
      // motivo errado: a consulta corria antes do render seguinte, e não achava a barra porque
      // ela ainda não tinha tido chance de aparecer — passaria na mesma com a permissão ligada.
      const clipe = await tela.findByLabelText('Trecho 1 de Voz');
      fireEvent.press(clipe);
      await waitFor(() => expect(clipe.props.accessibilityState.selected).toBe(true));

      expect(tela.queryByLabelText('Remover o clipe')).toBeNull();
      expect(tela.queryByLabelText(/^Desfazer/)).toBeNull();
    } finally {
      mockPodeEditar = true;
    }
  });

  // A forma da tela: um editor. As gravações são uma fila de fichas (são ALTERNATIVAS, ouve-se
  // uma de cada vez), e as pistas empilhadas são as camadas da que está aberta.
  it('abre a gravação principal com um transporte e a pista da mix', async () => {
    const tela = await montar();
    // O cabeçalho é a IDENTIDADE e a navegação, e mais nada: o nome da música, as quatro vistas
    // e a saída. É a fila da web.
    expect(await tela.findByText('Noite Clara')).toBeTruthy();
    expect(tela.getByLabelText('Timeline')).toBeTruthy();
    expect(tela.getByLabelText('Voltar para Músicas')).toBeTruthy();
    // Sem stems, a mix entra sozinha e ACESA: a mesa com uma pista é o tocador da gravação, e é
    // o que toda versão que já existe hoje passa a ter sem ninguém enviar nada.
    await abrirOMixer(tela);
    expect(await tela.findByLabelText('Silenciar Mix')).toBeTruthy();
    // Um transporte só para a gravação inteira, com o relógio no zero.
    await waitFor(() => expect(tela.getByLabelText('Tocar')).toBeTruthy());
    expect(tela.getByText('0:00')).toBeTruthy();
  });

  // ⚠️ A decisão menos óbvia da mesa: com stems, a MIX ENTRA MUDA. Ela já é a soma das camadas,
  // e tocá-la junto faz cada instrumento soar duas vezes, ligeiramente desalinhado.
  it('com stems, cada camada vira uma pista e a mix entra muda', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({
        files: [arquivo(), arquivo({ id: 'f-2', name: 'Bateria' })],
        tracks: [
          pista(),
          pista({ id: 't-2', name: 'Bateria', position: 1 }, 'f-2'),
        ],
      })],
    }));

    const tela = await montar();
    await abrirOMixer(tela);
    // ⚠️ OS RÓTULOS DA MESA DIZEM "NA MESA", e os da coluna da linha do tempo não: são dois
    // botões diferentes para a mesma pista, em duas vistas, e um leitor de tela que os
    // chamasse igual não diria em qual se está a carregar. É a distinção que a web faz.
    expect(await tela.findByLabelText('Silenciar Voz na mesa')).toBeTruthy();
    expect(tela.getByLabelText('Silenciar Bateria na mesa')).toBeTruthy();
    // Solo e mute são ações opostas e têm alvos próprios — não são o mesmo botão.
    expect(tela.getByLabelText('Ouvir só Voz na mesa')).toBeTruthy();
    // E o canal é uma coluna EM PÉ: nome, panorama, fader e os dois botões.
    expect(tela.getByLabelText('Panorama de Voz na mesa')).toBeTruthy();
    expect(tela.getByLabelText('Volume de Voz na mesa')).toBeTruthy();
    // ⚠️ Com a montagem feita, a MIX SAI DE CENA: ela é a soma das camadas, e tocá-la junto
    // faria cada instrumento soar duas vezes.
    expect(tela.queryByLabelText('Silenciar Mix na mesa')).toBeNull();
    expect(tela.queryByLabelText('Ouvir Mix na mesa')).toBeNull();
  });

  // ⚠️ A mix já é a SOMA das pistas. Acesa junto com elas, cada instrumento soa duas vezes e o
  // volume dobra. Não dá para impedir — é o que a pessoa pediu —, mas é quase sempre engano, e
  // ouvir sem entender por que "está estranho" é pior do que ler uma frase.
  it('acender a mix sozinha não avisa nada', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const usuario = userEvent.setup();
    const tela = await montar();

    // Pela COLUNA da linha do tempo, que é onde o editor abre: o M e o S estão lá, como na web.
    // Sem montagem, a mix entra sozinha e acesa: apagar e acender não dobra nada, e não avisa.
    await usuario.press(await tela.findByLabelText('Silenciar Mix'));
    await usuario.press(await tela.findByLabelText('Ouvir Mix'));
    expect(alerta).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  // O aviso de peso vem ANTES de descodificar, da soma dos tamanhos: depois já não há o que
  // avisar — ou coube, ou o sistema matou o app.
  it('pistas grandes demais avisam antes de derrubar o app', async () => {
    const grande = 300 * 1024 * 1024;
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [
        arquivo({ id: 'f-1', size_bytes: grande }),
        arquivo({ id: 'f-2', name: 'Bateria', size_bytes: grande }),
      ] })],
    }));

    const tela = await montar();
    // Ele é da GRAVAÇÃO, e por isso fica logo abaixo do transporte — vale nas duas abas de
    // áudio, e não só na que estiver aberta.
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
    // ⚠️ "9b6", E NÃO "96": o `b` do meio prova que o campo FILTRA NA TECLA. O `keyboardType` é
    // só uma sugestão ao aparelho — há teclados com símbolos ao lado dos números, e colar de
    // outro sítio passa por cima de qualquer teclado. Quem decide é o campo, com a regra do
    // núcleo que a web também usa.
    //
    // O tom não se mede aqui: escrever nele dispara uma segunda gravação, e entre uma e outra a
    // tela relê a gravação do banco e repõe os campos — o que se mediria era essa releitura, e
    // não o filtro. Ele está preso no núcleo (`camposDaGravacao`), na tela da web de ponta a
    // ponta, e no cromo, que obriga as duas superfícies a chamar a mesma função.
    await usuario.type(campo, '9b6');

    expect(mockAtualizarVersao).not.toHaveBeenCalled();
    jest.advanceTimersByTime(700);
    await waitFor(() => expect(mockAtualizarVersao).toHaveBeenCalledTimes(1));
    expect(mockAtualizarVersao.mock.calls[0][0]).toBe('v-1');
    expect(mockAtualizarVersao.mock.calls[0][1]).toEqual({ bpm: '96', key: 'Am' });

    // A música não foi tocada: o andamento nunca foi dela.
    expect(mockAtualizar).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  // ⚠️ O RÓTULO MUDOU-SE PARA DENTRO DO CAMPO, nas duas superfícies. Ele vivia ao lado, e o
  // campo vazio mostrava um traço: um retângulo com um traço, ao lado da palavra "BPM", não se
  // lia como campo — via-se a palavra e não se percebia que havia ali onde escrever.
  it('os campos vazios mostram o que são, em vez de um traço ao lado', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ bpm: null, key: null, files: [arquivo()] })],
    }));
    const tela = await montar();

    const andamento = await tela.findByLabelText('Andamento da gravação, em BPM');
    expect(andamento.props.placeholder).toBe('BPM');
    expect(tela.getByLabelText('Tom da gravação').props.placeholder).toBe('TOM');

    // E o rótulo não ficou também de fora, a dizer a mesma coisa duas vezes.
    expect(tela.queryByText('BPM')).toBeNull();
    expect(tela.queryByText('TOM')).toBeNull();
  });

  // ⚠️ A COR É ESCOLHIDA, e não sorteada. Ela é o que distingue uma faixa da outra de relance —
  // na coluna, no clipe e na mesa — e era o que calhasse na ordem de criação. Quem monta sabe
  // que a voz é verde e a bateria é azul; o produto passa a saber também.
  it('escolher a cor da faixa grava na faixa, e não noutro sítio', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    mockAtualizarFaixa.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    const tela = await montar();
    await tela.findByText('FAIXAS');

    // ⚠️ O SELETOR VIVE NA BARRA DO CLIPE ESCOLHIDO, ao lado de cortar e apagar — e não na
    // coluna da faixa, que foi onde ele nasceu. Ali era o quinto alvo de uma fila espremida
    // numa coluna estreita; aqui está junto das outras ações do mesmo gesto e em cima da
    // própria cor. Por isso o caminho começa por ESCOLHER o clipe.
    await usuario.press(tela.getByLabelText('Trecho 1 de Voz'));
    await usuario.press(tela.getByLabelText('Cor da faixa'));
    // Os nomes vêm do núcleo: seis bolinhas sem nome são seis alvos idênticos para quem usa
    // leitor de tela, e a cor é justamente o que distingue as faixas.
    await usuario.press(tela.getByLabelText('Turquesa'));

    await waitFor(() => expect(mockAtualizarFaixa).toHaveBeenCalledWith('t-1', { color_index: 5 }));
    // ⚠️ E GRAVA NA HORA. Escolher uma cor é um gesto único e deliberado, não uma régua a ser
    // arrastada: adiá-lo só abriria a janela em que fechar a tela perde a escolha.
    expect(tela.queryByLabelText('Turquesa')).toBeNull();
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

  // ⚠️ O "Salvo" vai embora sozinho. Antes ficava para sempre: `setSelo` nunca voltava a
  // 'parado', e a linha empurrava a tela 25 pt para baixo desde a primeira edição até sair.
  it('o selo de salvo some sozinho', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    try {
      const tela = await montar();
      // ⚠️ O STATUS SAIU DESTA TELA, como na web no telemóvel — ele é assunto da Ficha. Quem
      // grava daqui agora é o andamento, no rodapé, junto do que ele governa.
      const campo = await tela.findByLabelText('Andamento da gravação, em BPM');
      await usuario.clear(campo);
      await usuario.type(campo, '96');
      jest.advanceTimersByTime(700);
      expect(await tela.findByText('Salvo')).toBeTruthy();

      jest.advanceTimersByTime(2100);
      await waitFor(() => expect(tela.queryByText('Salvo')).toBeNull());
    } finally {
      // ⚠️ NUM `finally`: sem isto, este teste a falhar deixava os temporizadores FALSOS para
      // todos os que vêm depois — e eles falhavam em cascata, cada um com uma mensagem que não
      // tinha nada a ver com o que estava partido. Uma hora à procura do erro errado.
      jest.useRealTimers();
    }
  });

  // ⚠️ A CONVERSA, E NÃO OS COMENTÁRIOS DA GRAVAÇÃO. Um comentário preso a uma versão responde
  // "o que muda NESTA" e morre com ela; a conversa é o fio do trabalho da equipa sobre a música.
  // Presa a uma versão, ela ficava espalhada por V1, V2 e V3, e quem chegava tinha de abrir três
  // sítios para saber o que se passou.
  it('o balão abre a conversa da equipe, que é do projeto e não da gravação', async () => {
    mockConversa.mockResolvedValue([
      {
        id: 'm-1', project_id: 'p-1', author_name: 'Bia', text: 'consegue gravar quinta?',
        created_at: '2026-09-10T12:00:00Z',
      },
    ]);
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Abrir a conversa da equipe'));

    expect(await tela.findByText('consegue gravar quinta?')).toBeTruthy();
    // Pelo PROJETO, e não pela versão aberta.
    expect(mockConversa).toHaveBeenCalledWith('p-1');
  });

  it('quem só olha o catálogo lê a conversa, mas não escreve nela', async () => {
    mockPodeEditar = false;
    try {
      mockConversa.mockResolvedValue([]);
      const usuario = userEvent.setup();
      const tela = await montar();

      await usuario.press(await tela.findByLabelText('Abrir a conversa da equipe'));
      expect(await tela.findByText('Ninguém falou ainda')).toBeTruthy();
      expect(tela.queryByLabelText('Mensagem para a equipe')).toBeNull();
    } finally {
      mockPodeEditar = true;
    }
  });

  // ─── A aba de Exportar ─────────────────────────────────────────────────────
  //
  // ⚠️ EXPORTAR É COMO O TRABALHO SAI DAQUI. Sem ela, uma montagem feita no telemóvel fica
  // presa no telemóvel: não há como abri-la no Ableton nem mandar a mix para quem vai ouvir.
  // Era a última coisa que o editor do app não sabia fazer e o da web já sabia.

  it('a aba de exportar lista as pistas que vão para o ZIP, com a extensão que elas vão ter', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();
    // ⚠️ ESPERAR A MONTAGEM CHEGAR. Antes de a gravação carregar, a única pista é a Mix
    // sintetizada a partir do áudio da versão — e a lista sairia com uma linha só. O teste
    // passava a dizer que a aba funciona enquanto mostrava a montagem errada.
    await tela.findByDisplayValue('Voz');
    fireEvent.press(tela.getByLabelText('Exportar'));

    expect(await tela.findByText('Stems')).toBeTruthy();
    expect(tela.getByText('Voz')).toBeTruthy();
    expect(tela.getAllByText('.wav').length).toBeGreaterThan(0);
  });

  it('o botão dos stems chama a partilha com as pistas da gravação e o nome da música', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();
    await tela.findByDisplayValue('Voz');
    fireEvent.press(tela.getByLabelText('Exportar'));
    fireEvent.press(await tela.findByLabelText('Compartilhar todas as faixas num ZIP'));

    await waitFor(() => expect(partilharStems).toHaveBeenCalled());
    const [, , pistasEnviadas, titulo] = (partilharStems as jest.Mock).mock.calls[0];
    expect(titulo).toBe('Noite Clara');
    expect((pistasEnviadas as { nome: string }[]).map((p) => p.nome)).toContain('Voz');
  });

  // Falhar em silêncio aqui é o pior desfecho possível: a pessoa toca, nada acontece, e ela não
  // sabe se está a preparar ou se não funcionou.
  it('quando a exportação falha, a tela diz porquê', async () => {
    (partilharStems as jest.Mock).mockRejectedValueOnce(new Error('Sem espaço no aparelho.'));
    const aviso = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tela = await montar();

    fireEvent.press(await tela.findByLabelText('Exportar'));
    fireEvent.press(await tela.findByLabelText('Compartilhar todas as faixas num ZIP'));

    await waitFor(() => expect(aviso).toHaveBeenCalledWith(
      'Não consegui exportar', 'Sem espaço no aparelho.',
    ));
  });

  // Não se toca uma ficha, nem se exporta com o play na mão — é o mesmo corte da web.
  it('a aba de exportar não tem transporte', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();
    await tela.findByDisplayValue('Voz');
    await tela.findByLabelText('Tocar');

    fireEvent.press(tela.getByLabelText('Exportar'));
    // `waitFor`, e não uma asserção seca: o `expect(...).toBeNull()` logo a seguir ao toque
    // passa antes de a troca de aba chegar à tela — e passaria também se ela nunca chegasse.
    await waitFor(() => expect(tela.queryByLabelText('Tocar')).toBeNull());

    fireEvent.press(tela.getByLabelText('Timeline'));
    expect(await tela.findByLabelText('Tocar')).toBeTruthy();
  });

  // A ficha ocupa o lugar da montagem, como as outras três — e são os MESMOS campos do
  // formulário do catálogo, tingidos pela paleta do editor. Um segundo formulário seriam duas
  // verdades sobre a mesma música.
  it('a aba da ficha põe os campos da música no lugar da montagem', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Ficha'));

    // ⚠️ E OS CAMPOS VÊM PREENCHIDOS. Montada em linha não há "abrir", e o efeito que enche o
    // rascunho esperava por isso: a ficha aparecia com o título vazio, pronta a gravar por cima
    // do que estava lá.
    expect(await tela.findByDisplayValue('Noite Clara')).toBeTruthy();
    // ⚠️ UMA ROLAGEM SÓ, e não abas dentro da aba — é o que a web monta aqui: os campos e, logo
    // abaixo, os créditos. Estavam atrás de "Splits", e ninguém tocava.
    expect(tela.getByText('Obra')).toBeTruthy();
    expect(tela.getByText('Fonograma')).toBeTruthy();
    expect(tela.queryByText('Splits')).toBeNull();
    // E sem Letras: no editor a letra vive no balão, encostada à montagem, onde se canta.
    expect(tela.queryByText('Letras')).toBeNull();
    expect(tela.queryByLabelText('Letra da música')).toBeNull();
    // O responsável é a equipe ATIVA — um convite pendente ainda não é ninguém.
    expect(await tela.findByLabelText('Responsável: Bia')).toBeTruthy();
    expect(tela.queryByLabelText('Responsável: Convidado')).toBeNull();
    // ⚠️ E NENHUM BOTÃO DE SALVAR: ali a ficha grava sozinha, como tudo o mais nesta tela. Um
    // Salvar no meio dela ensinaria que o resto talvez não esteja salvo.
    expect(tela.queryByLabelText('Salvar')).toBeNull();
    // E a montagem saiu de cena, com o transporte: não se toca uma ficha.
    expect(tela.queryByText('FAIXAS')).toBeNull();
    // Nem a biblioteca: uma gaveta por cima de um formulário é só uma tela a tapar outra.
    expect(tela.queryByText('Biblioteca')).toBeNull();
    expect(tela.queryByLabelText('Tocar')).toBeNull();
    expect(tela.getByLabelText('Ficha').props.accessibilityState.selected).toBe(true);
  });

  it('sem versões, convida a mandar a primeira', async () => {
    mockBuscar.mockResolvedValue(projeto({ versions: [], primary_version_id: null }));
    const tela = await montar();
    expect(await tela.findByText('Este Espaço JAM ainda não tem áudio.')).toBeTruthy();
    // E o convite aponta para o botão que existe: a pasta, no rodapé.
    expect(tela.getByLabelText('Enviar a primeira gravação')).toBeTruthy();
  });

  // ─── O casco do editor ─────────────────────────────────────────────────────
  //
  // ⚠️ ESTA TELA DEIXOU DE SER UMA PÁGINA e passou a ser o editor da web, com a estrutura dele:
  // cabeçalho fixo (nome + as quatro vistas + a saída), a montagem no meio, e um rodapé com o
  // que vale para a montagem INTEIRA. O que rolava a página para cima levava o play e o relógio
  // junto — no telemóvel, bastava olhar a terceira faixa para perder o transporte.

  it('o que vale para a montagem inteira mora no rodapé, e não no cabeçalho', async () => {
    const tela = await montar();
    await tela.findByLabelText('Timeline');

    // O andamento e o tom são DA GRAVAÇÃO, e estão junto do que governam.
    expect(tela.getByLabelText('Andamento da gravação, em BPM')).toBeTruthy();
    expect(tela.getByLabelText('Tom da gravação')).toBeTruthy();
    // O volume geral, que é da montagem toda.
    expect(tela.getByLabelText('Volume geral')).toBeTruthy();
    // E a porta da BIBLIOTECA, que é onde a web a põe — com o resto do que governa a tela
    // inteira. No transporte ela ficava entre o play e o loop, e abrir uma pasta não é gesto de
    // transporte.
    expect(tela.getByLabelText('Abrir a biblioteca')).toBeTruthy();
  });

  // Armar a gravação sem dizer em que faixa é meia intenção: numa mesa, o REC global só sabe o
  // que fazer se alguma faixa estiver armada. Sem o aviso, o botão acendia e não significava
  // nada.
  it('armar a gravação sem faixa armada explica o que falta', async () => {
    const aviso = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tela = await montar();

    fireEvent.press(await tela.findByLabelText('Armar para gravar'));

    expect(aviso).toHaveBeenCalledWith(AVISO_DE_ARMAR.titulo, AVISO_DE_ARMAR.texto);
    // E não ficou armado: o estado só muda quando o gesto faz sentido.
    expect(tela.getByLabelText('Armar para gravar')).toBeTruthy();
    aviso.mockRestore();
  });

  // ⚠️ ENVIAR DIRETO PARA UMA FAIXA. Sem isto, uma faixa que ficou sem áudio (o clipe foi
  // apagado) vira um beco sem saída: não há arrasto de ficheiro num telemóvel, e ela ficava
  // lá, vazia, sem forma de a encher.
  it('enviar um áudio para uma faixa põe um clipe NELA, e não uma faixa nova', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    (escolherAudio as jest.Mock).mockResolvedValue({
      nome: 'take 2.wav', uri: 'file:///take2.wav', tipo: 'audio/wav', tamanho: 1024,
    });
    (enviarParaOCatalogo as jest.Mock).mockResolvedValue({
      url: 'https://exemplo.invalid/take2.wav', name: 'take 2.wav',
    });
    mockNovoArquivo.mockResolvedValue({ id: 'f-2' });

    const tela = await montar();
    await tela.findByDisplayValue('Voz');
    fireEvent.press(tela.getByLabelText('Enviar um áudio para Voz'));

    await waitFor(() => expect(mockCriarClipe).toHaveBeenCalled());
    expect(mockCriarClipe.mock.calls[0][0]).toMatchObject({
      track_id: 't-1', file_id: 'f-2', duration_seconds: 90,
    });
    // A faixa nova é o outro gesto, o da pasta do rodapé.
    expect(mockCriarPista).not.toHaveBeenCalled();
  });

  it('renomear a faixa escreve na hora e grava depois', async () => {
    jest.useFakeTimers();
    const usuario = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    try {
      mockBuscar.mockResolvedValue(projeto({
        versions: [versao({ files: [arquivo()], tracks: [pista()] })],
      }));
      mockAtualizarFaixa.mockResolvedValue({});
      const tela = await montar();

      const campo = await tela.findByDisplayValue('Voz');
      await usuario.clear(campo);
      await usuario.type(campo, 'Voz dobra');

      // O campo mostra já; o banco só depois — senão cada letra seria uma escrita.
      expect(mockAtualizarFaixa).not.toHaveBeenCalled();
      jest.advanceTimersByTime(700);
      await waitFor(() => expect(mockAtualizarFaixa).toHaveBeenCalledWith('t-1', { name: 'Voz dobra' }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('apagar a faixa inteira MARCA, e nunca a Mix', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    mockMarcarPista.mockResolvedValue(undefined);
    const tela = await montar();
    await tela.findByDisplayValue('Voz');

    fireEvent.press(tela.getByLabelText('Apagar a faixa Voz'));
    await waitFor(() => expect(mockMarcarPista).toHaveBeenCalledWith('t-1'));
  });

  // ⚠️ A FICHA DO EDITOR GRAVA SOZINHA, como tudo o mais nesta tela — e como na web. O caso que
  // interessa não é o que ela grava: é o que ela NÃO grava.
  it('a ficha na aba grava sozinha, e não grava o que ninguém mexeu', async () => {
    // ⚠️ COM TEMPORIZADORES DE VERDADE. Com os falsos, o próprio React agenda o trabalho de
    // renderizar num `setTimeout`, e o campo mudava sem que nada re-renderizasse: o teste
    // media o debounce de um efeito que nunca corria. Um segundo de espera real é o preço de
    // medir a coisa certa.
    mockGravarFicha.mockResolvedValue({ id: 'p-1', title: 'Noite Clara II' });
    const tela = await montar();
    fireEvent.press(await tela.findByLabelText('Ficha'));
    await tela.findByDisplayValue('Noite Clara');

    // ⚠️ ABRIR NÃO É EDITAR. Sem a assinatura, o primeiro render gravava de volta exatamente o
    // que acabara de chegar do servidor — e carimbava como edição de agora uma ficha em que
    // ninguém tocou.
    await new Promise((pronto) => { setTimeout(pronto, 900); });
    expect(mockGravarFicha).not.toHaveBeenCalled();

    fireEvent.changeText(tela.getByDisplayValue('Noite Clara'), 'Noite Clara II');
    await waitFor(() => expect(tela.getByDisplayValue('Noite Clara II')).toBeTruthy());

    // ⚠️ E O QUE ESTÁ A SER ESCRITO SOBREVIVE A UM RENDER DA TELA DE FORA. A ficha recarrega o
    // rascunho quando a música que recebe muda de IDENTIDADE — e montá-la com um objeto novo a
    // cada render fazia isso o tempo todo: com a mesa a bater o relógio vinte vezes por segundo
    // enquanto toca, o que a pessoa digitava era apagado e reposto pelo valor do servidor.
    // Mexer no andamento, no rodapé, é um render da tela de fora.
    fireEvent.changeText(tela.getByLabelText('Andamento da gravação, em BPM'), '96');
    await waitFor(() => expect(tela.getByDisplayValue('96')).toBeTruthy());
    expect(tela.getByDisplayValue('Noite Clara II')).toBeTruthy();
    // O campo já mostra; o banco ainda não recebeu — ele recebe uma vez, quando a mão para.
    expect(mockGravarFicha).not.toHaveBeenCalled();

    await waitFor(() => expect(mockGravarFicha).toHaveBeenCalledTimes(1));
    expect(mockGravarFicha.mock.calls[0][0]).toMatchObject({
      id: 'p-1', versionId: 'v-1', title: 'Noite Clara II',
    });
    // E o selo diz que pegou: numa aba sem botão de Salvar, gravar em silêncio deixa quem
    // escreveu sem saber.
    expect(await tela.findByText('Salvo')).toBeTruthy();
  });

  // O responsável é campo da MÚSICA, e a web grava-o daqui — o app tem de gravar também. Sem o
  // `assignee` no payload, escolher alguém pintava a pílula e não saía do aparelho; sem ele na
  // assinatura, nem a escolha chegava a agendar uma gravação.
  it('escolher o responsável grava, e escolher de novo desatribui', async () => {
    // ⚠️ O DUPLO DEVOLVE O QUE RECEBEU, como o banco devolve a linha gravada. Com uma resposta
    // fixa, a tela remendava a música com um responsável vazio e a pílula apagava-se sozinha —
    // que é exatamente o defeito que o remendo de `aoSalvar` foi lá corrigir.
    mockGravarFicha.mockImplementation((entrada: Record<string, unknown>) => Promise.resolve({
      ...entrada, id: 'v-1', project_id: 'p-1', version_id: 'v-1',
    }));
    const tela = await montar();
    fireEvent.press(await tela.findByLabelText('Ficha'));

    fireEvent.press(await tela.findByLabelText('Responsável: Bia'));
    await waitFor(() => expect(mockGravarFicha).toHaveBeenCalledTimes(1));
    expect(mockGravarFicha.mock.calls[0][0]).toMatchObject({
      assignee: { id: 'u-2', name: 'Bia' },
    });

    // ⚠️ ESPERAR O SELO antes do segundo toque não é frescura: a gravação volta e a tela remenda
    // a música, e esse remendo recarrega o rascunho. Tocar no meio disso era ver a escolha ser
    // desfeita pelo remendo em vez de pela pessoa.
    expect(await tela.findByText('Salvo')).toBeTruthy();

    // A pílula acesa é o `allowClear` da web: tocar nela outra vez tira o responsável.
    fireEvent.press(tela.getByLabelText('Remover Bia como responsável'));
    await waitFor(() => expect(mockGravarFicha).toHaveBeenCalledTimes(2));
    expect(mockGravarFicha.mock.calls[1][0].assignee).toBeNull();

    tela.unmount();
  });

  // ⚠️ A LETRA E A AJUDA SÃO BALÕES, e não abas: escreve-se letra a olhar para a montagem, e uma
  // aba faria trocar de tela para ler um verso. É o que a web faz com dois flutuantes.
  it('a letra abre num balão e grava na gravação aberta', async () => {
    mockAtualizarVersao.mockResolvedValue(versao({ id: 'v-1' }));
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Letra'));
    const campo = await tela.findByLabelText('Letra da música');
    fireEvent.changeText(campo, 'primeiro verso');

    await waitFor(() => expect(mockAtualizarVersao).toHaveBeenCalledWith('v-1', { lyrics: 'primeiro verso' }));
    // E a montagem continua por baixo: o balão não é uma tela, é um balão.
    expect(tela.getByLabelText('Timeline').props.accessibilityState.selected).toBe(true);
  });

  it('a ajuda explica como se monta, sem sair da montagem', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Ajuda'));
    expect(await tela.findByText('Como se monta')).toBeTruthy();
  });

  // ⚠️ RENOMEAR ERA O ÚNICO CAMINHO QUE PASSAVA PELA FICHA. O nome está à vista, no topo, que é
  // onde a mão vai — é onde a web o deixa editar.
  it('o nome da música se renomeia no topo', async () => {
    mockAtualizar.mockResolvedValue(projeto({ title: 'Noite Clara II' }));
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Noite Clara. Toque para renomear.'));
    const campo = await tela.findByLabelText('Nome da música');
    fireEvent.changeText(campo, 'Noite Clara II');
    await waitFor(() => expect(tela.getByDisplayValue('Noite Clara II')).toBeTruthy());
    fireEvent(tela.getByDisplayValue('Noite Clara II'), 'submitEditing');

    await waitFor(() => expect(mockAtualizar).toHaveBeenCalledWith('p-1', { title: 'Noite Clara II' }));
  });

  it('um nome apagado não vira uma música sem nome', async () => {
    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Noite Clara. Toque para renomear.'));
    // ⚠️ RE-CONSULTAR ANTES DE DISPARAR. O nó encontrado antes da mudança fica para trás
    // quando o campo re-renderiza, e o evento cai num elemento que já não está na árvore — o
    // teste passava a medir o silêncio de um clique que nunca aconteceu.
    fireEvent.changeText(await tela.findByLabelText('Nome da música'), '   ');
    await waitFor(() => expect(tela.getByDisplayValue('   ')).toBeTruthy());
    fireEvent(tela.getByDisplayValue('   '), 'submitEditing');

    // O título é o que identifica a música no catálogo inteiro: sem nome, ela some da lista de
    // quem a procura.
    expect(mockAtualizar).not.toHaveBeenCalled();
    expect(await tela.findByText('Noite Clara')).toBeTruthy();
  });

  // Armar a faixa e o transporte e carregar no play TERIA de gravar — e não grava, porque a
  // gravação ainda não existe. Tocar em silêncio seria o pior desfecho: a pessoa só descobria
  // ao procurar o take.
  it('play com tudo armado avisa em vez de fingir que gravou', async () => {
    const aviso = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();
    await tela.findByDisplayValue('Voz');

    // Duas armações, como em qualquer mesa: a faixa diz ONDE, o transporte diz QUANDO.
    fireEvent.press(tela.getByLabelText('Armar Voz para gravar'));
    await waitFor(() => expect(tela.getByLabelText('Desarmar Voz')).toBeTruthy());
    fireEvent.press(tela.getByLabelText('Armar para gravar'));
    await waitFor(() => expect(tela.getByLabelText('Desarmar a gravação')).toBeTruthy());

    fireEvent.press(tela.getByLabelText('Tocar'));
    expect(aviso).toHaveBeenCalledWith(
      'A gravação ainda não está disponível',
      expect.stringContaining('botão da faixa'),
    );
    aviso.mockRestore();
  });

  // ─── O andamento, ouvido sozinho ───────────────────────────────────────────
  //
  // Pedir a alguém que digite um número que a máquina consegue ouvir é trabalho que não devia
  // existir — e o andamento não é enfeite: é o que faz a régua contar COMPASSOS em vez de
  // segundos.

  it('o andamento ouvido entra no campo e se identifica como ouvido', async () => {
    // A gravação abriu sem andamento escrito e com uma análise já a correr: é assim que o
    // número chega sem que esta tela tenha pedido nada.
    mockBuscar.mockResolvedValue(projeto({ versions: [versao({ bpm: null })] }));
    mockEmCurso = true;
    mockAnalise = { bpm: 128 };
    const tela = await montar();

    const campo = await tela.findByLabelText('Andamento da gravação, em BPM, ouvido do áudio');
    expect(campo.props.value).toBe('128');
    // ⚠️ E DIZ DE ONDE VEIO. Um palpite da máquina sem marca é indistinguível de um número que a
    // pessoa escreveu e esqueceu — e é sobre esse que ela depois vai confiar para registar a obra.
  });

  // ⚠️ NÃO É "FALTA DE CONFIANÇA", é ambiguidade real: um trap a 140 e o mesmo trap contado em
  // meio-tempo a 70 têm exatamente as mesmas batidas, e a máquina escolhe uma delas com toda a
  // certeza do mundo.
  it('oferece a outra leitura da mesma batida, e trocar é um interruptor', async () => {
    mockBuscar.mockResolvedValue(projeto({ versions: [versao({ bpm: null })] }));
    mockEmCurso = true;
    mockAnalise = { bpm: 140 };
    const tela = await montar();
    await tela.findByLabelText('Andamento da gravação, em BPM, ouvido do áudio');

    fireEvent.press(tela.getByLabelText(
      'Trocar para 70 BPM: a mesma batida, contada em dobro ou em meio-tempo',
    ));
    await waitFor(() => expect(tela.getByDisplayValue('70')).toBeTruthy());
    // Volta com outro toque: é um interruptor entre as duas leituras, não uma correção única.
    expect(tela.getByLabelText(
      'Trocar para 140 BPM: a mesma batida, contada em dobro ou em meio-tempo',
    )).toBeTruthy();
  });

  it('escrever por cima do que a máquina ouviu tira a marca e a oferta', async () => {
    mockBuscar.mockResolvedValue(projeto({ versions: [versao({ bpm: null })] }));
    mockEmCurso = true;
    // 160 e não 128: a metade de 128 cai fora da faixa comum e não haveria oferta nenhuma para
    // desaparecer — o teste passaria sem testar nada.
    mockAnalise = { bpm: 160 };
    const tela = await montar();
    const campo = await tela.findByLabelText('Andamento da gravação, em BPM, ouvido do áudio');
    expect(tela.getByLabelText(
      'Trocar para 80 BPM: a mesma batida, contada em dobro ou em meio-tempo',
    )).toBeTruthy();

    fireEvent.changeText(campo, '92');

    // O andamento da obra é o que o autor diz que é — a partir daqui o número é dele, e a
    // máquina cala-se: nem a marca, nem a oferta da outra leitura.
    await waitFor(() => expect(tela.getByLabelText('Andamento da gravação, em BPM')).toBeTruthy());
    expect(tela.queryByLabelText(
      'Trocar para 80 BPM: a mesma batida, contada em dobro ou em meio-tempo',
    )).toBeNull();
  });

  // ─── A biblioteca ──────────────────────────────────────────────────────────
  //
  // ⚠️ NO TELEMÓVEL ELA É UMA GAVETA, e não uma coluna: 256 pt de coluna fixa são 68 % de um
  // ecrã de 402, sobrando um terço para a montagem inteira. É o que a web faz abaixo de 768 px.

  it('a pasta do rodapé abre a gaveta por cima da montagem, e o toque é que envia', async () => {
    (escolherAudios as jest.Mock).mockResolvedValue([
      { nome: 'bateria.wav', uri: 'file:///bateria.wav', tipo: 'audio/wav', tamanho: 2 * 1024 * 1024 },
    ]);
    (enviarParaOCatalogo as jest.Mock).mockResolvedValue({
      url: 'https://exemplo.invalid/bateria.wav', name: 'bateria.wav',
    });
    mockNovoArquivo.mockResolvedValue({ id: 'f-9' });
    mockCriarPista.mockResolvedValue({ id: 't-9' });

    const usuario = userEvent.setup();
    const tela = await montar();

    await usuario.press(await tela.findByLabelText('Abrir a biblioteca'));
    expect(await tela.findByText('Biblioteca')).toBeTruthy();

    // ⚠️ ESCOLHER NÃO ENVIA: o ficheiro fica do lado de cá até alguém o mandar para a montagem.
    // Enviar tudo o que se escolheu paga armazenamento e egress pelo que nem vai ser usado.
    await usuario.press(tela.getByLabelText('Escolher arquivos do aparelho'));
    expect(await tela.findByText('bateria.wav')).toBeTruthy();
    expect(enviarParaOCatalogo).not.toHaveBeenCalled();

    // O toque é que envia — na gaveta não há arrasto para faixa nenhuma, porque ela as tapa.
    await usuario.press(tela.getByLabelText('Enviar bateria.wav como faixa'));
    await waitFor(() => expect(mockCriarPista).toHaveBeenCalled());
    // E a gaveta fecha: ela cobre a montagem E o selo, e quem enviava ficava sem sinal nenhum.
    expect(tela.queryByText('Biblioteca')).toBeNull();
  });

  // ⚠️ NO FIM DO FICHEIRO, e não no meio: esta é a única que abre a pergunta do X, e o `Modal`
  // dela sobrevive à limpeza entre casos — montado depois dele, o editor do caso seguinte ficava
  // por baixo de uma tela que ainda estava lá, e a suíte inteira caía a seguir. Desmontar à mão
  // não bastou; a ordem bastou.
  //
  // ⚠️ "SÓ FECHAR" FECHA MESMO, e é metade do ponto da pergunta: quem entrou para ouvir, mexeu
  // num fader e quer sair não pode ser cobrado um minuto e meio de renderização por isso. O
  // preço está escrito na própria pergunta — a lista continua com o áudio anterior.
  it('o X pergunta, e "só fechar" sai sem gerar a guia', async () => {
    mockBuscar.mockResolvedValue(projeto({
      versions: [versao({ files: [arquivo()], tracks: [pista()] })],
    }));
    const tela = await montar();
    await tela.findByText('FAIXAS');

    // Mexer no volume muda a SOMA: é montagem, e é o que dá motivo à pergunta.
    fireEvent.press(tela.getByLabelText('Silenciar Voz'));
    fireEvent.press(tela.getAllByLabelText('Voltar para Músicas')[0]);

    expect(await tela.findByText('Gerar a guia antes de fechar?')).toBeTruthy();
    fireEvent.press(tela.getByText('Só fechar'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockOffline).not.toHaveBeenCalled();
    expect(mockGravarFixo).not.toHaveBeenCalled();

    // ⚠️ DESMONTADO À MÃO. O `Modal` da pergunta sobrevive à limpeza entre casos, e o caso
    // seguinte montava o editor por baixo de uma tela que ainda estava lá.
    tela.unmount();
  });
});
