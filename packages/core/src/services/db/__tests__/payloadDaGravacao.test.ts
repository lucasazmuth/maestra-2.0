import { catalogProjectToItem, payloadDaGravacao } from '../catalog';

// ⚠️ ESTE TESTE EXISTE POR CAUSA DE UM ESTRAGO REAL.
//
// O payload da gravação escrevia `audio_file: input.audio_file ?? null`, como todos os outros
// campos. Enquanto a ficha só gravava ao carregar em "Salvar", isso quase não aparecia. No dia
// em que a ficha passou a gravar sozinha — e o payload do autosave não repetia o campo —, cada
// tecla escrita numa observação apagou a guia da música: o ficheiro que a lista de Músicas toca
// desapareceu de cinco músicas sem ninguém pedir e sem nada na tela dizer.
//
// A regra que estes casos prendem é uma só: o áudio só é escrito quando o chamador FALA dele.

const AGORA = '2026-09-10T00:00:00.000Z';

describe('payloadDaGravacao', () => {
  it('não menciona o áudio quando o chamador não o mencionou', () => {
    const payload = payloadDaGravacao({ title: 'Uma música', lyrics: 'la la' }, AGORA);

    // Nem como `null`: a chave tem de estar AUSENTE, senão o update escreve vazio por cima.
    expect('audio_file' in payload).toBe(false);
    expect('audio_file_name' in payload).toBe(false);
  });

  it('escreve o áudio quando ele é dado', () => {
    const payload = payloadDaGravacao(
      { audio_file: 'https://exemplo/guia.mp3', audio_file_name: 'guia.mp3' },
      AGORA,
    );

    expect(payload.audio_file).toBe('https://exemplo/guia.mp3');
    expect(payload.audio_file_name).toBe('guia.mp3');
  });

  // O outro lado da mesma regra: quem QUER limpar continua a conseguir.
  it('limpa o áudio quando ele é dado como nulo', () => {
    const payload = payloadDaGravacao({ audio_file: null, audio_file_name: null }, AGORA);

    expect('audio_file' in payload).toBe(true);
    expect(payload.audio_file).toBeNull();
  });

  // Os outros campos são todos editáveis no mesmo formulário: quem grava a ficha viu-os, e um
  // vazio ali é uma decisão dela. Áudio, andamento e tom é que nascem noutro sítio.
  it('os campos da ficha continuam a ser apagáveis por omissão', () => {
    const payload = payloadDaGravacao({ title: 'Só o título' }, AGORA);

    expect(payload.lyrics).toBeNull();
    expect(payload.duration).toBeNull();
    expect(payload.genre).toBeNull();
  });

  // ⚠️ O ANDAMENTO E O TOM SAÍRAM DA FICHA, e entraram na regra do áudio no mesmo dia.
  //
  // Eles são editáveis num sítio só — a barra do editor —, e essa barra escreve nesta MESMA
  // coluna por outro caminho. Enquanto o payload da ficha os repetia por omissão, escrever o
  // título mandava o BPM velho do rascunho (ou vazio) por cima do que a barra tinha acabado de
  // gravar: a ficha deixou de os MOSTRAR, e um vazio ali deixou de ser uma decisão de ninguém.
  it('não menciona o andamento nem o tom quando o chamador não os mencionou', () => {
    const payload = payloadDaGravacao({ title: 'Uma música', lyrics: 'la la' }, AGORA);

    // Nem como `null`: a chave tem de estar AUSENTE, senão o update escreve vazio por cima.
    expect('bpm' in payload).toBe(false);
    expect('key' in payload).toBe(false);
  });

  it('escreve o andamento e o tom quando eles são dados', () => {
    const payload = payloadDaGravacao({ bpm: '128', key: 'Am' }, AGORA);

    expect(payload.bpm).toBe('128');
    expect(payload.key).toBe('Am');
  });

  // O outro lado da mesma regra: a barra do editor apaga o BPM mandando-o vazio, e isso tem de
  // continuar a chegar ao banco.
  it('limpa o andamento e o tom quando eles são dados como nulos', () => {
    const payload = payloadDaGravacao({ bpm: null, key: null }, AGORA);

    expect('bpm' in payload).toBe(true);
    expect(payload.bpm).toBeNull();
    expect(payload.key).toBeNull();
  });

  it('sem status, a gravação nasce em composição', () => {
    expect(payloadDaGravacao({}, AGORA).status).toBe('composition');
    expect(payloadDaGravacao({ status: 'mixing' }, AGORA).status).toBe('mixing');
  });
});

// ISRC e UPC existiam na ficha e não existiam no banco: entravam no payload e o PostgREST
// ignorava-os, sem erro e sem aviso. Quem digitasse um ISRC via-o desaparecer no recarregamento
// seguinte. Agora têm coluna — e cada um na tabela certa, que é o que estes casos prendem.
describe('ISRC e UPC', () => {
  // O ISRC identifica uma GRAVAÇÃO: o acústico não partilha o código do original. Por isso vai
  // no payload da versão, pela mesma razão que o andamento e o tom vão.
  it('o ISRC vai na gravação', () => {
    expect(payloadDaGravacao({ isrc: 'BRABC2600001' }, AGORA).isrc).toBe('BRABC2600001');
  });

  it('o ISRC vazio limpa a coluna, como todo campo que a ficha mostra', () => {
    expect('isrc' in payloadDaGravacao({ title: 'x' }, AGORA)).toBe(true);
    expect(payloadDaGravacao({ title: 'x' }, AGORA).isrc).toBeNull();
  });

  // ⚠️ E O UPC NÃO VAI. Ele identifica o LANÇAMENTO, e é da música: mandá-lo para cá daria a
  // cada gravação o seu, que é o contrário do que o código significa.
  it('o UPC não é da gravação', () => {
    expect('upc' in payloadDaGravacao({ upc: '7891234567890' }, AGORA)).toBe(false);
  });

  // A volta: o item que a ficha lê junta os dois, cada um da sua tabela.
  it('o item lido traz o ISRC da gravação e o UPC da música', () => {
    const item = catalogProjectToItem(
      { id: 'p1', artist_id: 'a1', title: 'Uma', status: 'composition', upc: '7891234567890' },
      {
        id: 'v1', project_id: 'p1', version_number: 1, stage: 'guia', status: 'composition',
        isrc: 'BRABC2600001',
      },
    );

    expect(item.isrc).toBe('BRABC2600001');
    expect(item.upc).toBe('7891234567890');
  });
});
