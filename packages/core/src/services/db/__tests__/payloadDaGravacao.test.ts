import { payloadDaGravacao } from '../catalog';

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
  // vazio ali é uma decisão dela. Só o áudio é que nasce noutro sítio.
  it('os campos da ficha continuam a ser apagáveis por omissão', () => {
    const payload = payloadDaGravacao({ title: 'Só o título' }, AGORA);

    expect(payload.lyrics).toBeNull();
    expect(payload.bpm).toBeNull();
    expect(payload.key).toBeNull();
    expect(payload.duration).toBeNull();
    expect(payload.genre).toBeNull();
  });

  it('sem status, a gravação nasce em composição', () => {
    expect(payloadDaGravacao({}, AGORA).status).toBe('composition');
    expect(payloadDaGravacao({ status: 'mixing' }, AGORA).status).toBe('mixing');
  });
});
