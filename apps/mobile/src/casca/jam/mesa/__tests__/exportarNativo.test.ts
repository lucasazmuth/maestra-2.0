import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import { partilharGuiaWav, partilharStems } from '../exportarNativo';

// O que o sistema de ficheiros e a folha de partilha fizeram, registado para o teste ler.
const escritos: { nome: string; dados: Uint8Array }[] = [];
const partilhados: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { cache: '/cache' },
  Directory: class {
    exists = true;

    create() { /* já existe */ }
  },
  File: class {
    nome: string;

    uri: string;

    exists = false;

    constructor(_pasta: unknown, nome: string) {
      this.nome = nome;
      this.uri = `/cache/exportado/${nome}`;
    }

    write(bytes: Uint8Array) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      escritos.push({ nome: this.nome, dados: bytes });
    }

    delete() { /* o teste não apaga nada */ }
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn((uri: string) => { partilhados.push(uri); return Promise.resolve(); }),
}));

/** Um buffer de um quadro por canal — o que interessa é o nome do ficheiro, não o som. */
const buffer = (quadros = 10) => ({
  duration: quadros / 44100,
  length: quadros,
  numberOfChannels: 1,
  sampleRate: 44100,
  getChannelData: () => new Float32Array(quadros),
}) as never;

const criarOffline = (() => null) as never;

beforeEach(() => {
  escritos.length = 0;
  partilhados.length = 0;
  jest.clearAllMocks();
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});

describe('partilharStems', () => {
  it('põe uma pista por ficheiro no ZIP, com o nome higienizado', async () => {
    const mesa = { renderizar: jest.fn(() => Promise.resolve(buffer())) };
    const quantas = await partilharStems(
      mesa as never, criarOffline, [
        { id: 'a', nome: 'Voz · guia' },
        { id: 'b', nome: 'Bateria' },
      ], 'Minha Música',
    );

    expect(quantas).toBe(2);
    expect(escritos).toHaveLength(1);
    expect(escritos[0].nome).toBe('Minha Musica.zip');

    // O ZIP que foi escrito de verdade, relido: é a única forma de provar que os nomes
    // chegaram ao ficheiro, e não só à chamada.
    const zip = await JSZip.loadAsync(escritos[0].dados);
    expect(Object.keys(zip.files).sort()).toEqual(['Bateria.wav', 'Voz _ guia.wav']);
    // E que cada entrada é um WAV, e não um nome vazio: 44 de cabeçalho + as amostras.
    expect((await zip.file('Bateria.wav')!.async('uint8array')).length).toBe(44 + 10 * 2);
  });

  it('renderiza CADA pista sozinha — um ZIP de mixes completas não serve para nada', async () => {
    // Sem o id, `renderizar` devolve a montagem inteira: as quatro "faixas" do ZIP seriam
    // quatro cópias da música toda, e só se descobre ao abrir no outro programa.
    const mesa = { renderizar: jest.fn(() => Promise.resolve(buffer())) };
    await partilharStems(mesa as never, criarOffline, [{ id: 'a', nome: 'Voz' }], 'M');
    expect(mesa.renderizar).toHaveBeenCalledWith(criarOffline, 'a');
  });

  it('uma pista que não rende é saltada, e as outras saem na mesma', async () => {
    const mesa = {
      renderizar: jest.fn((_c: unknown, id?: string) =>
        Promise.resolve(id === 'b' ? null : buffer())),
    };
    const quantas = await partilharStems(
      mesa as never, criarOffline,
      [{ id: 'a', nome: 'Voz' }, { id: 'b', nome: 'Muda' }, { id: 'c', nome: 'Baixo' }], 'M',
    );
    expect(quantas).toBe(2);
    expect(partilhados).toHaveLength(1);
  });

  it('sem nenhuma pista rendida não abre a partilha — um ZIP vazio é pior que um aviso', async () => {
    const mesa = { renderizar: jest.fn(() => Promise.resolve(null)) };
    const quantas = await partilharStems(
      mesa as never, criarOffline, [{ id: 'a', nome: 'Voz' }], 'M',
    );
    expect(quantas).toBe(0);
    expect(escritos).toHaveLength(0);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('partilharGuiaWav', () => {
  it('rende a montagem INTEIRA, e não uma pista', async () => {
    const mesa = { renderizar: jest.fn(() => Promise.resolve(buffer())) };
    await partilharGuiaWav(mesa as never, criarOffline, 'Minha Música');
    expect(mesa.renderizar).toHaveBeenCalledWith(criarOffline);
    expect(escritos[0].nome).toBe('Minha Musica.wav');
  });

  it('o WAV tem cabeçalho: 44 bytes a mais que as amostras', async () => {
    const mesa = { renderizar: jest.fn(() => Promise.resolve(buffer(100))) };
    await partilharGuiaWav(mesa as never, criarOffline, 'M');
    expect(escritos[0].dados.length).toBe(44 + 100 * 2);
  });

  it('sem áudio carregado devolve falso e não escreve ficheiro nenhum', async () => {
    const mesa = { renderizar: jest.fn(() => Promise.resolve(null)) };
    expect(await partilharGuiaWav(mesa as never, criarOffline, 'M')).toBe(false);
    expect(escritos).toHaveLength(0);
  });

  it('num aparelho sem folha de partilha, avisa em vez de falhar em silêncio', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const mesa = { renderizar: jest.fn(() => Promise.resolve(buffer())) };
    await expect(partilharGuiaWav(mesa as never, criarOffline, 'M')).rejects.toThrow(/compartilhar/);
  });
});
