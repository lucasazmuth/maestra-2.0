import { render, userEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { COR } from '@maestra/core/constants/design';
import { Provider } from 'react-redux';

import type { CatalogItem } from '@maestra/core/interfaces/maestra';
import { store } from '@maestra/core/store/store';
import Catalogo from '../artista/[id]/catalogo';
import { comDiagnostico } from './fixtures';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a-1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

const mockListar = jest.fn();
const mockSalvar = jest.fn();
const mockExcluir = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  listCatalogProjectItems: (...args: unknown[]) => mockListar(...args),
  saveCatalogProjectFromForm: (...args: unknown[]) => mockSalvar(...args),
  deleteCatalogProject: (...args: unknown[]) => mockExcluir(...args),
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

// A ilha do player sobe com a margem segura do aparelho; fora dele, o provedor precisa das
// medidas na mão.
const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// O limite do plano aparece no rótulo da aba. Para provar que ele SOME no PRO, o teto vem
// daqui: derivá-lo da assinatura de verdade exigiria montar meio slice para trocar um número.
let mockLimite: number | null = null;
jest.mock('@maestra/core/hooks/useArtistCapabilities', () => {
  const real = jest.requireActual('@maestra/core/hooks/useArtistCapabilities');
  return {
    ...real,
    useArtistCapabilities: (artista: unknown) => {
      const direitos = real.useArtistCapabilities(artista);
      return mockLimite === null ? direitos : { ...direitos, maxCatalogTracks: mockLimite };
    },
  };
});

const montar = () => render(
  <Provider store={store}>
    <SafeAreaProvider initialMetrics={MEDIDAS}><Catalogo /></SafeAreaProvider>
  </Provider>,
);

describe('catalogo', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
    mockSalvar.mockReset();
    mockExcluir.mockReset();
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    mockPlayer.replace.mockClear();
    mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
    mockLimite = null;
  });

  // O limite vivia numa linha própria do cabeçalho, acima das abas. Ele é sobre a lista que a
  // aba abre, e no rótulo dela fica ao lado do que conta — uma linha a menos no topo.
  describe('o limite do plano', () => {
    it('aparece no rótulo da aba, e não no cabeçalho', async () => {
      mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Chuva de Março' })]);
      const tela = await montar();

      await waitFor(() => expect(tela.getByText('Chuva de Março')).toBeTruthy());
      expect(tela.getByText(' 1/10')).toBeTruthy();
      expect(tela.getByLabelText('Músicas: 1 de 10 do seu plano')).toBeTruthy();
      // E não sobrou nada da linha antiga do cabeçalho.
      expect(tela.queryByText(/^\d+\/\d+ músicas$/)).toBeNull();
    });

    // Sem teto não há o que contar, e um "1/∞" só ocuparia espaço dizendo que não há limite.
    it('some para quem tem o PRO', async () => {
      mockLimite = Infinity;
      mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Chuva de Março' })]);
      const tela = await montar();

      await waitFor(() => expect(tela.getByText('Chuva de Março')).toBeTruthy());
      expect(tela.queryByText(/\d+\/\d+/)).toBeNull();
      expect(tela.queryByText(/∞/)).toBeNull();
      // E a aba continua lá, com o nome dela — o rótulo de acessibilidade é só "Músicas"
      // quando não há teto, e "Músicas: 1 de 10 do seu plano" quando há.
      expect(tela.getByLabelText('Músicas')).toBeTruthy();
    });
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

  // O PLAYER E O BOTAO DE CRIAR MORAM NO MESMO CANTO.
  //
  // A barra do player nasce acima da ilha de navegacao, no canto de baixo a direita, que e onde
  // o botao flutuante ja estava — e o botao ficava POR CIMA dela, cobrindo o "proxima faixa".
  // Sao dois `position: absolute` que so se encontram na tela, entao nada alem deste caso avisa
  // quando um invade o outro.
  it('com o player aberto, o botão de criar sobe acima da barra', async () => {
    mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Chuva de Março' })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Chuva de Março')).toBeTruthy());

    // O `bottom` vive na ÂNCORA, e não no botão: ela ocupa a largura toda para encostá-lo à
    // direita, e é ela que se desloca. Daí subir na árvore até achar quem tem a medida.
    type No = { props: { style?: unknown }; parent: No | null };
    const deBaixo = (rotulo: string) => {
      let no = tela.getByLabelText(rotulo) as unknown as No | null;
      for (let i = 0; no && i < 5; i += 1) {
        const estilo = StyleSheet.flatten(no.props.style) as { bottom?: number } | undefined;
        if (typeof estilo?.bottom === 'number') return estilo.bottom;
        no = no.parent;
      }
      throw new Error(`Sem "bottom" na árvore de ${rotulo}`);
    };
    const antes = deBaixo('Nova música');

    await userEvent.setup().press(tela.getByLabelText('Tocar Chuva de Março'));

    // O botão sobe, e sobe o suficiente: o piso dele passa a ficar ACIMA do topo da barra
    // (106 de base + 34 da margem do aparelho + 64 de altura = 204).
    expect(deBaixo('Nova música')).toBeGreaterThan(antes);
    expect(deBaixo('Nova música')).toBeGreaterThanOrEqual(204);
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
    await tela.rerender(
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={MEDIDAS}><Catalogo /></SafeAreaProvider>
      </Provider>,
    );

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

// A tela tem DUAS listas e CRIA música — não é só leitura.
//
// A aba Lançamentos mostra o que já saiu no Spotify, que vem do `content` do artista e não do
// banco do catálogo. A web mantém as duas na mesma tela porque quem procura uma música não sabe
// de qual das duas ela é.
describe('catalogo: as duas abas e a ficha', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
    mockSalvar.mockReset();
    mockListar.mockResolvedValue([faixa({ id: 'f-1', title: 'Chuva de fevereiro' })]);
  });

  it('a aba Lançamentos mostra o que veio do Spotify', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Chuva de fevereiro')).toBeTruthy());

    await userEvent.setup().press(tela.getByText('Lançamentos'));

    // O fixture não tem catálogo do Spotify: a lista precisa dizer isso em vez de ficar vazia.
    expect(tela.getByText('Nenhum lançamento')).toBeTruthy();
    expect(tela.queryByText('Chuva de fevereiro')).toBeNull();
  });

  it('"Nova música" abre a ficha em branco', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Chuva de fevereiro')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Nova música'));

    // O cabeçalho da ficha mostra o NOME da faixa; sem título ainda, mostra o que ela é.
    expect(tela.getByText(/A ficha da obra/)).toBeTruthy();
    expect(tela.getByLabelText('Título').props.value).toBe('');
  });

  it('o "⋮" abre a ficha da faixa, com os dados dela', async () => {
    mockListar.mockResolvedValue([
      faixa({ id: 'f-2', title: 'Vento sul', genre: 'MPB', bpm: '96' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Editar Vento sul'));

    // O cabeçalho da ficha é o NOME da faixa, como na web — não um rótulo genérico.
    expect(tela.getAllByText('Vento sul').length).toBeGreaterThan(1);
    expect(tela.getByLabelText('Título').props.value).toBe('Vento sul');
    expect(tela.getByLabelText('BPM').props.value).toBe('96');
  });

  // Grava pelo MESMO caminho da web (`saveCatalogProjectFromForm`), e manda o `project_id` como
  // `id`: o `id` do item é o da VERSÃO, e mandá-lo criaria uma faixa nova a cada edição.
  it('salvar a edição grava no projeto, e não numa faixa nova', async () => {
    mockListar.mockResolvedValue([
      faixa({ id: 'v-9', project_id: 'p-9', title: 'Vento sul' }),
    ]);
    mockSalvar.mockResolvedValue(faixa({ id: 'v-9', project_id: 'p-9', title: 'Vento norte' }));
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Editar Vento sul'));
    await usuario.type(tela.getByLabelText('Título'), ' norte');
    await usuario.press(tela.getByText('Salvar'));

    await waitFor(() => expect(mockSalvar).toHaveBeenCalled());
    expect(mockSalvar.mock.calls[0][0]).toMatchObject({
      id: 'p-9', versionId: 'v-9', artist_id: 'a-1', title: 'Vento sul norte',
    });
  });

  it('não salva sem título', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Chuva de fevereiro')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Nova música'));
    await usuario.press(tela.getByText('Salvar'));

    expect(mockSalvar).not.toHaveBeenCalled();
    expect(tela.getByText('Informe o título.')).toBeTruthy();
  });

  // Data em formato inválido não pode virar `Invalid Date` no banco.
  it('recusa data de lançamento mal escrita', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Chuva de fevereiro')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Nova música'));
    await usuario.type(tela.getByLabelText('Título'), 'Nova');
    await usuario.type(tela.getByLabelText('Data de lançamento'), '31/02/2026');
    await usuario.press(tela.getByText('Salvar'));

    expect(mockSalvar).not.toHaveBeenCalled();
    expect(tela.getByText(/formato 28\/08\/2026/)).toBeTruthy();
  });
});

// A ficha tem TRÊS abas, como a da web — Informações, Letras e Splits. Ela já foi uma pilha de
// campos sem abas: a letra e os créditos ficavam no fim de uma rolagem longa, e o "Salvar" com
// eles.
describe('catalogo: as abas da ficha e os splits', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
    mockSalvar.mockReset();
    mockListar.mockResolvedValue([faixa({ id: 'f-1', project_id: 'p-1', title: 'Vento sul' })]);
  });

  const abrirFicha = async (tela: ReturnType<typeof montar> extends Promise<infer T> ? T : never) => {
    await userEvent.setup().press(tela.getByLabelText('Editar Vento sul'));
  };

  it('a letra vive na aba Letras, e não no meio das informações', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());
    await abrirFicha(tela);

    expect(tela.queryByLabelText('Letra')).toBeNull();

    await userEvent.setup().press(tela.getByText('Letras'));
    expect(tela.getByLabelText('Letra')).toBeTruthy();
    expect(tela.queryByLabelText('ISRC')).toBeNull();
  });

  it('os créditos vivem na aba Splits, nos dois grupos', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());
    await abrirFicha(tela);

    await userEvent.setup().press(tela.getByText('Splits'));

    expect(tela.getByText('Créditos autorais da obra')).toBeTruthy();
    expect(tela.getByText('Créditos do fonograma')).toBeTruthy();
    expect(tela.getAllByText('Nenhum participante adicionado.')).toHaveLength(2);
  });

  it('adicionar participante entra na lista e conta no total', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());
    await abrirFicha(tela);
    await usuario.press(tela.getByText('Splits'));

    await usuario.press(tela.getByLabelText('Adicionar participante em Composição'));
    await usuario.type(tela.getAllByLabelText('Percentual')[0], '60');

    // Um grupo ganhou participante; o outro continua vazio.
    expect(tela.getAllByText('Nenhum participante adicionado.')).toHaveLength(1);
    expect(tela.getByText('60%')).toBeTruthy();
  });

  // Passar de 100% divide direito que não existe — o total precisa dizer isso.
  it('total acima de 100% aparece em vermelho', async () => {
    mockListar.mockResolvedValue([
      faixa({
        id: 'f-2', project_id: 'p-2', title: 'Vento sul',
        composition_splits: [
          { id: 's1', name: 'A', role: 'Autor', percentage: 70 },
          { id: 's2', name: 'B', role: 'Autor', percentage: 50 },
        ],
      }),
    ]);
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());
    await abrirFicha(tela);
    await usuario.press(tela.getByText('Splits'));

    const total = tela.getByText('120%');
    const cor = StyleSheet.flatten(total.props.style).color;
    expect(cor).toBe(COR.erro);
  });

  it('os splits vão junto ao salvar', async () => {
    mockSalvar.mockResolvedValue(faixa({ id: 'f-1', project_id: 'p-1', title: 'Vento sul' }));
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Vento sul')).toBeTruthy());
    await abrirFicha(tela);
    await usuario.press(tela.getByText('Splits'));
    await usuario.press(tela.getByLabelText('Adicionar participante em Gravação'));
    await usuario.type(tela.getByLabelText('Nome do participante'), 'Ana');
    await usuario.press(tela.getByText('Salvar'));

    await waitFor(() => expect(mockSalvar).toHaveBeenCalled());
    expect(mockSalvar.mock.calls[0][0].recording_splits).toEqual([
      expect.objectContaining({ name: 'Ana', role: 'Autor' }),
    ]);
  });
});

// O player é uma ILHA flutuante acima da barra de navegação, com capa e controles — não uma
// faixa colada no rodapé com só o título e o tempo.
describe('catalogo: o player', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
    mockPlayer.replace.mockClear();
    mockStatus = { playing: true, currentTime: 30, duration: 180, didJustFinish: false };
    mockListar.mockResolvedValue([
      faixa({ id: 'f-1', title: 'Primeira', audio_file: 'https://x/1.mp3' }),
      faixa({ id: 'f-2', title: 'Segunda', audio_file: 'https://x/2.mp3' }),
      faixa({ id: 'f-3', title: 'Sem áudio', audio_file: null }),
    ]);
  });

  it('tocar abre o player com capa, tempo e controles', async () => {
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Primeira')).toBeTruthy());

    await userEvent.setup().press(tela.getByLabelText('Tocar Primeira'));

    expect(tela.getByText('0:30 / 3:00')).toBeTruthy();
    expect(tela.getByLabelText('Anterior')).toBeTruthy();
    expect(tela.getByLabelText('Próxima')).toBeTruthy();
    expect(tela.getByLabelText('Fechar player')).toBeTruthy();
  });

  it('próxima toca a faixa seguinte que TEM áudio', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Primeira')).toBeTruthy());
    await usuario.press(tela.getByLabelText('Tocar Primeira'));

    mockPlayer.replace.mockClear();
    await usuario.press(tela.getByLabelText('Próxima'));

    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://x/2.mp3' });
  });

  // Pular para uma faixa sem arquivo pararia o player: a fila só tem as que têm áudio.
  it('a fila dá a volta sem passar pela faixa sem áudio', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Primeira')).toBeTruthy());
    await usuario.press(tela.getByLabelText('Tocar Segunda'));

    mockPlayer.replace.mockClear();
    await usuario.press(tela.getByLabelText('Próxima'));

    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://x/1.mp3' });
  });

  it('fechar o player para o áudio e some com a ilha', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();
    await waitFor(() => expect(tela.getByText('Primeira')).toBeTruthy());
    await usuario.press(tela.getByLabelText('Tocar Primeira'));

    await usuario.press(tela.getByLabelText('Fechar player'));

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(tela.queryByLabelText('Fechar player')).toBeNull();
  });
});
