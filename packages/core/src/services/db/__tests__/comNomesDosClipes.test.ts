import { comNomesDosClipes } from '../catalog';
import type { CatalogProject } from '../../../interfaces/maestra';

// O clipe tem de saber o nome do ficheiro que toca.
//
// `catalog_clips` guarda um `file_id` e mais nada; o nome vive em `catalog_version_files`. As
// duas tabelas voltam na MESMA leitura, mas em ramos diferentes da resposta — e enquanto
// ninguém as costurava, o `file_name` do tipo era um campo que nunca ninguém preenchia. A
// linha do tempo escrevia "Take 1" por cima de uma onda que se chama "voz dobra", e "Take 2"
// por cima da que se chama "voz ad-lib": dois rótulos que só dizem a ordem de entrada, em cima
// de duas ondas que se parecem.

const projeto = (parte: Partial<CatalogProject> = {}): CatalogProject => ({
  id: 'p-1',
  artist_id: 'a-1',
  title: 'Noite Clara',
  status: 'composition',
  versions: [{
    id: 'v-1',
    project_id: 'p-1',
    version_number: 1,
    stage: 'guia',
    status: 'composition',
    files: [
      { id: 'f-voz', version_id: 'v-1', name: 'voz dobra.wav', file_url: 'https://x/voz.wav' },
      { id: 'f-bat', version_id: 'v-1', name: 'bateria.wav', file_url: 'https://x/bat.wav' },
    ],
    tracks: [{
      id: 't-1',
      version_id: 'v-1',
      name: 'Voz',
      position: 0,
      gain: 1,
      muted: false,
      color_index: 0,
      clips: [
        { id: 'c-1', track_id: 't-1', file_id: 'f-voz', start_seconds: 0, offset_seconds: 0, duration_seconds: 10 },
        { id: 'c-2', track_id: 't-1', file_id: 'f-bat', start_seconds: 10, offset_seconds: 0, duration_seconds: 8 },
      ],
    }],
  }],
  ...parte,
});

describe('comNomesDosClipes', () => {
  it('carimba em cada clipe o nome do ficheiro que ele toca', () => {
    const [versao] = comNomesDosClipes(projeto()).versions!;
    const [voz, bateria] = versao.tracks![0].clips!;

    expect(voz.file_name).toBe('voz dobra.wav');
    expect(bateria.file_name).toBe('bateria.wav');
  });

  // ⚠️ POR `file_id`, e não pela ordem. Os clipes estão na ordem do TEMPO e os ficheiros na de
  // envio; casá-los por posição dava o nome certo enquanto o exemplo fosse pequeno e trocava
  // os nomes assim que alguém arrastasse um clipe para trás do outro.
  it('não casa pela ordem: um clipe que toca o segundo ficheiro leva o nome do segundo', () => {
    const base = projeto();
    // A bateria passa a ser o PRIMEIRO clipe da linha do tempo.
    base.versions![0].tracks![0].clips!.reverse();

    const [primeiro, segundo] = comNomesDosClipes(base).versions![0].tracks![0].clips!;
    expect(primeiro.file_name).toBe('bateria.wav');
    expect(segundo.file_name).toBe('voz dobra.wav');
  });

  // Quem acabou de criar o clipe sabe o nome melhor do que esta junção — e reescrevê-lo com o
  // `undefined` de um ficheiro que a leitura ainda não trouxe seria apagar informação boa.
  it('respeita o nome que já veio', () => {
    const base = projeto();
    base.versions![0].tracks![0].clips![0].file_name = 'o que quem enviou chamou.wav';
    base.versions![0].files = [];

    const [clipe] = comNomesDosClipes(base).versions![0].tracks![0].clips!;
    expect(clipe.file_name).toBe('o que quem enviou chamou.wav');
  });

  // Um clipe órfão (o ficheiro foi apagado do balde, a linha ficou) não pode derrubar a
  // leitura inteira do projeto: fica sem nome, e a tela volta ao número do take.
  it('deixa sem nome o clipe cujo ficheiro não está na leitura', () => {
    const base = projeto();
    base.versions![0].files = [];

    const [clipe] = comNomesDosClipes(base).versions![0].tracks![0].clips!;
    expect(clipe.file_name).toBeUndefined();
  });

  it('atravessa um projeto sem gravações, sem pistas e sem clipes', () => {
    expect(comNomesDosClipes(projeto({ versions: undefined })).versions).toEqual([]);

    const semPistas = projeto();
    semPistas.versions![0].tracks = undefined;
    expect(comNomesDosClipes(semPistas).versions![0].tracks).toEqual([]);

    const semClipes = projeto();
    semClipes.versions![0].tracks![0].clips = undefined;
    expect(comNomesDosClipes(semClipes).versions![0].tracks![0].clips).toEqual([]);
  });
});
