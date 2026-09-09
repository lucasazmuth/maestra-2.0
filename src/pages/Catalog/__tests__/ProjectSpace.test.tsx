import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { CatalogProject, CatalogVersion, CatalogVersionFile } from '@maestra/core/interfaces/maestra';

// O Espaço JAM é um EDITOR: as gravações são uma fila de fichas (alternativas, ouve-se uma de
// cada vez) e os stems da gravação aberta são pistas que tocam JUNTAS. Estes testes guardam a
// forma e as duas ligações que ela criou — o cabeçalho grava na gravação aberta, e a barra
// global de reprodução não existe aqui dentro.

jest.mock('@maestra/core/hooks/useArtist', () => ({
  useArtist: () => ({ artist: { id: 'a-1', name: 'Artista' }, loading: false }),
}));

jest.mock('@maestra/core/hooks/useArtistCapabilities', () => ({
  useArtistCapabilities: () => ({ canCollaborateJam: true, canEditCatalog: true }),
}));

jest.mock('@maestra/core/store/store', () => ({
  useAppSelector: (sel: (s: any) => unknown) => sel({ auth: { user: { id: 'u-1', user_metadata: {} } } }),
}));

const mockGet = jest.fn();
const mockUpdateProject = jest.fn();
const mockUpdateVersion = jest.fn();
const mockSetPrimary = jest.fn();
jest.mock('@maestra/core/services/db/catalog', () => ({
  __esModule: true,
  getCatalogProject: (...a: any[]) => mockGet(...a),
  updateCatalogProject: (...a: any[]) => mockUpdateProject(...a),
  updateCatalogVersion: (...a: any[]) => mockUpdateVersion(...a),
  setPrimaryVersion: (...a: any[]) => mockSetPrimary(...a),
  updateVersionFile: jest.fn(),
  reorderVersionFiles: jest.fn(),
  deleteVersionFile: jest.fn(),
  catalogProjectToItem: () => ({ id: 'p-1', artist_id: 'a-1', title: 'Noite Clara', status: 'mixing' }),
}));

jest.mock('@maestra/core/services/db/genres', () => ({ listGenres: () => Promise.resolve([]) }));
jest.mock('@maestra/core/services/db/members', () => ({ listMembers: () => Promise.resolve([]) }));

// A barra global: o que interessa é QUE ELA É FECHADA ao abrir o editor, e por isso o duplo
// guarda as chamadas em vez de as ignorar.
const mockPlayerState = { setOpen: jest.fn(), setCurrentId: jest.fn() };
jest.mock('@maestra/core/stores/localPlayerStore', () => ({
  useLocalPlayerStore: (sel: (s: any) => unknown) => sel(mockPlayerState),
}));

jest.mock('../../../components/VersionModal', () => ({ VersionModal: () => null }));
jest.mock('../../../components/TrackModal', () => ({
  TrackModal: ({ open }: { open: boolean }) => (open ? <div data-testid='ficha-da-musica' /> : null),
}));
jest.mock('../../../components/spinner/spinner', () => ({
  Spinner: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line import/first
import ProjectSpace from '../ProjectSpace';

// O jsdom não tem Web Audio. Este contexto de mentira devolve um buffer de três minutos e não
// toca nada: o que os testes de tela verificam é que o editor DESENHA — pistas, botões,
// transporte. Quem prova que a mesa mistura e sincroniza é a suíte do núcleo.
const parametro = () => ({ value: 1, setValueAtTime: jest.fn(), setTargetAtTime: jest.fn() });
const contextoFalso = () => ({
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  destination: {},
  decodeAudioData: () => Promise.resolve({
    duration: 180, length: 180 * 44100, numberOfChannels: 1, sampleRate: 44100,
    getChannelData: () => new Float32Array(4410),
  }),
  createGain: () => ({ gain: parametro(), connect: jest.fn(), disconnect: jest.fn() }),
  createWaveShaper: () => ({ curve: null, oversample: 'none', connect: jest.fn(), disconnect: jest.fn() }),
  createBufferSource: () => ({
    buffer: null, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(),
  }),
  createBuffer: () => ({ duration: 180, length: 1, numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array(1) }),
  resume: () => Promise.resolve(),
  suspend: () => Promise.resolve(),
  close: () => Promise.resolve(),
});

const stem = (over: Partial<CatalogVersionFile> = {}): CatalogVersionFile => ({
  id: 's-1', version_id: 'v-1', name: 'Voz', kind: 'stem',
  file_url: 'https://exemplo.invalid/voz.wav', position: 0, gain: 1, ...over,
} as CatalogVersionFile);

const version = (over: Partial<CatalogVersion> = {}): CatalogVersion => ({
  id: 'v-1', project_id: 'p-1', version_number: 1, title: 'guia vocal',
  audio_file: 'https://exemplo.invalid/guia.mp3', author_name: 'Lucas',
  bpm: '128', key: 'Am', created_at: '2026-08-01T12:00:00Z', ...over,
} as CatalogVersion);

const project = (over: Partial<CatalogProject> = {}): CatalogProject => ({
  id: 'p-1', artist_id: 'a-1', title: 'Noite Clara', status: 'mixing',
  genre: 'Pop', release_date: null, primary_version_id: 'v-1', versions: [version()], ...over,
} as CatalogProject);

const montar = () => render(
  <MemoryRouter initialEntries={['/artists/a-1/catalog/p-1']}>
    <Routes>
      <Route path='/artists/:id/catalog/:projectId' element={<ProjectSpace />} />
    </Routes>
  </MemoryRouter>,
);

describe('Espaço JAM na web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).AudioContext = jest.fn(contextoFalso);
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })) as any;
    mockGet.mockResolvedValue(project());
    mockUpdateVersion.mockImplementation((id, patch) => Promise.resolve(version({ id, ...patch })));
    mockUpdateProject.mockImplementation((id, patch) => Promise.resolve(project(patch)));
  });

  it('abre a gravação principal com a fila de fichas, o transporte e a pista da mix', async () => {
    montar();
    expect(await screen.findByText('Noite Clara')).toBeTruthy();
    expect(screen.getByText('Gravações desta música')).toBeTruthy();
    expect(screen.getByLabelText('Abrir V1, guia vocal, gravação principal')).toBeTruthy();
    // Sem stems, a mix entra sozinha e ACESA: a mesa com uma pista é o tocador da gravação.
    expect(await screen.findByLabelText('Silenciar Mix ★')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Tocar')).toBeTruthy());
    expect(screen.getByText('3:00')).toBeTruthy();
  });

  // ⚠️ A decisão menos óbvia da mesa: com stems, a MIX ENTRA MUDA. Ela já é a soma das camadas,
  // e tocá-la junto faz cada instrumento soar duas vezes.
  it('com stems, cada camada vira uma pista e a mix entra muda', async () => {
    mockGet.mockResolvedValue(project({
      versions: [version({ files: [stem(), stem({ id: 's-2', name: 'Bateria', position: 1 })] })],
    }));
    montar();

    expect(await screen.findByLabelText('Ouvir Mix ★')).toBeTruthy();
    expect(screen.getByLabelText('Silenciar Voz')).toBeTruthy();
    // Mutar e solar são ações opostas, e têm alvos próprios.
    expect(screen.getByLabelText('Ouvir só Voz')).toBeTruthy();
    // A Mix não se renomeia, não se move e não se apaga: só os stems têm o `⋯`.
    expect(screen.getByLabelText('Opções de Voz')).toBeTruthy();
    expect(screen.queryByLabelText('Opções de Mix ★')).toBeNull();
  });

  // ⚠️ Dois motores de áudio na mesma tela é o bug óbvio: a barra tocando a V2 por baixo da mesa
  // tocando a V1, cada uma com o seu play e nenhuma sabendo da outra.
  it('a barra global de reprodução é fechada ao abrir o editor', async () => {
    montar();
    await screen.findByText('Noite Clara');
    expect(mockPlayerState.setOpen).toHaveBeenCalledWith(false);
    expect(mockPlayerState.setCurrentId).toHaveBeenCalledWith(null);
  });

  // O que o dono do produto pediu de volta: o BPM é da GRAVAÇÃO, e o rótulo diz qual.
  it('o BPM digitado no cabeçalho grava na gravação aberta, e não na música', async () => {
    jest.useFakeTimers();
    montar();
    const campo = await screen.findByLabelText('Andamento da gravação, em BPM');
    expect(screen.getByText('de V1 · guia vocal ★')).toBeTruthy();

    fireEvent.change(campo, { target: { value: '96' } });
    expect(mockUpdateVersion).not.toHaveBeenCalled();

    jest.advanceTimersByTime(700);
    jest.useRealTimers();
    await waitFor(() => expect(mockUpdateVersion).toHaveBeenCalledTimes(1));
    expect(mockUpdateVersion.mock.calls[0][0]).toBe('v-1');
    expect(mockUpdateVersion.mock.calls[0][1]).toEqual({ bpm: '96', key: 'Am' });
  });

  // Trocar de ficha é ABRIR outra gravação: o cabeçalho passa a falar dela.
  it('escolher outra gravação troca os números do cabeçalho', async () => {
    mockGet.mockResolvedValue(project({
      versions: [
        version({ id: 'v-1', version_number: 1, bpm: '128', key: 'Am' }),
        version({ id: 'v-2', version_number: 2, title: 'acústico', bpm: '92', key: 'D' }),
      ],
    }));
    montar();

    fireEvent.click(await screen.findByLabelText('Abrir V2, acústico'));
    expect(await screen.findByText('de V2 · acústico')).toBeTruthy();
    expect((screen.getByLabelText('Andamento da gravação, em BPM') as HTMLInputElement).value).toBe('92');
  });

  // Trocar de gravação não é uma EDIÇÃO. Sem esta marca, o efeito do autosave acharia que o
  // valor que acabou de ser lido da nova gravação é uma digitação, e o regravaria por cima —
  // uma escrita à toa que atropelaria quem estivesse a editar a mesma gravação noutro lugar.
  it('trocar de gravação não regrava o que acabou de ler', async () => {
    mockGet.mockResolvedValue(project({
      versions: [
        version({ id: 'v-1', version_number: 1 }),
        version({ id: 'v-2', version_number: 2, title: 'acústico', bpm: '92', key: 'D' }),
      ],
    }));
    montar();
    fireEvent.click(await screen.findByLabelText('Abrir V2, acústico'));
    await screen.findByText('de V2 · acústico');

    await new Promise((pronto) => { setTimeout(pronto, 900); });
    expect(mockUpdateVersion).not.toHaveBeenCalled();
  });

  // O que sobra na linha da ficha é o que é da MÚSICA e não muda de gravação para gravação.
  it('a linha da música mostra o gênero e abre a ficha', async () => {
    montar();
    fireEvent.click(await screen.findByLabelText('Editar as informações da música'));
    expect(await screen.findByTestId('ficha-da-musica')).toBeTruthy();
  });

  // ⚠️ Sem esta guarda no `useMesa`, um navegador sem Web Audio derrubava a TELA INTEIRA pelo
  // efeito: uma página branca em vez de uma música que não toca.
  it('um navegador sem Web Audio mostra a tela, e as pistas dizem por que não tocam', async () => {
    delete (window as any).AudioContext;
    montar();

    expect(await screen.findByText('Noite Clara')).toBeTruthy();
    const pista = await screen.findByText('Mix ★');
    expect(within(pista.closest('div')?.parentElement as HTMLElement).getByText(/não toca áudio/)).toBeTruthy();
  });

  it('sem gravações, convida a mandar a primeira', async () => {
    mockGet.mockResolvedValue(project({ versions: [], primary_version_id: null }));
    montar();
    expect(await screen.findByText('Este Espaço JAM ainda não tem uploads.')).toBeTruthy();
  });
});
