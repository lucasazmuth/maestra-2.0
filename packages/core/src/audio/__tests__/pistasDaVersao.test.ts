import type { CatalogVersion } from '../../interfaces/maestra';
import {
  DURACAO_DESCONHECIDA, ID_DA_MIX, NOME_DA_MIX, ehPistaDaMix, montagemDaVersao, pistasDaGravacao,
} from '../pistasDaVersao';

// A ponte entre o banco e a mesa: três tabelas de um lado (ficheiros, pistas, clipes), uma
// montagem do outro.

const versao = (over: Partial<CatalogVersion> = {}): CatalogVersion => ({
  id: 'v1', project_id: 'p1', version_number: 1,
  audio_file: 'https://x/mix.mp3',
  ...over,
} as CatalogVersion);

describe('montagemDaVersao', () => {
  // ⚠️ Toda gravação que já existe hoje tem um `audio_file` e nenhuma pista, e tem de continuar
  // a tocar ao abrir, sem ninguém montar nada.
  it('sem montagem, a mix entra sozinha, do zero', () => {
    const montagem = montagemDaVersao(versao());
    expect(montagem).toHaveLength(1);
    expect(montagem[0].nome).toBe(NOME_DA_MIX);
    expect(montagem[0].clipes[0]).toMatchObject({
      url: 'https://x/mix.mp3', inicio: 0, recorte: 0, duracao: DURACAO_DESCONHECIDA,
    });
  });

  it('sem montagem e sem áudio, não há o que tocar', () => {
    expect(montagemDaVersao(versao({ audio_file: null }))).toEqual([]);
    expect(montagemDaVersao(null)).toEqual([]);
  });

  // ⚠️ Assim que existe montagem, a mix SAI DE CENA. Ela é a soma das camadas: tocá-la junto
  // faria cada instrumento soar duas vezes, ligeiramente desalinhado.
  it('com pistas montadas, a mix não entra', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 0.8, muted: false, color_index: 2,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'f1', start_seconds: 4, offset_seconds: 1, duration_seconds: 3 }],
      }],
    }));

    expect(montagem).toHaveLength(1);
    expect(montagem[0].nome).toBe('Voz');
    expect(montagem.some((p) => p.nome === NOME_DA_MIX)).toBe(false);
  });

  it('traz o volume e o mudo guardados, e resolve a URL pelo ficheiro', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 0.4, muted: true, color_index: 0,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'f1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 }],
      }],
    }));

    expect(montagem[0]).toMatchObject({ ganhoInicial: 0.4, mudaInicial: true });
    expect(montagem[0].clipes[0].url).toBe('https://x/voz.wav');
  });

  // Um clipe cujo ficheiro sumiu é uma linha órfã: some da mesa em vez de a derrubar com uma
  // URL indefinida.
  it('um clipe sem ficheiro não entra', () => {
    const montagem = montagemDaVersao(versao({
      files: [],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'sumiu', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 }],
      }],
    }));
    expect(montagem[0].clipes).toEqual([]);
  });

  // O banco devolve `numeric` como texto: sem a conversão, `inicio` viria "4" e a aritmética do
  // agendamento faria concatenação em vez de soma.
  it('os segundos chegam como número, mesmo vindo como texto', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [{
          id: 'c1', track_id: 't1', file_id: 'f1',
          start_seconds: '4.5' as unknown as number,
          offset_seconds: '1.25' as unknown as number,
          duration_seconds: '3' as unknown as number,
        }],
      }],
    }));
    expect(montagem[0].clipes[0]).toMatchObject({ inicio: 4.5, recorte: 1.25, duracao: 3 });
  });

  it('os clipes saem na ordem do tempo', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [
          { id: 'tarde', track_id: 't1', file_id: 'f1', start_seconds: 10, offset_seconds: 0, duration_seconds: 2 },
          { id: 'cedo', track_id: 't1', file_id: 'f1', start_seconds: 1, offset_seconds: 0, duration_seconds: 2 },
        ],
      }],
    }));
    expect(montagem[0].clipes.map((c) => c.id)).toEqual(['cedo', 'tarde']);
  });
});

describe('pistasDaGravacao', () => {
  it('ordena pela posição, e desempata pela chegada', () => {
    const faixas = pistasDaGravacao(versao({
      tracks: [
        { id: 'b', version_id: 'v1', name: 'B', position: 1, gain: 1, muted: false, color_index: 0 },
        { id: 'a2', version_id: 'v1', name: 'A2', position: 0, gain: 1, muted: false, color_index: 0, created_at: '2026-02-01' },
        { id: 'a1', version_id: 'v1', name: 'A1', position: 0, gain: 1, muted: false, color_index: 0, created_at: '2026-01-01' },
      ],
    }));
    // Sem o desempate, duas pistas com a mesma posição trocariam de lugar a cada leitura.
    expect(faixas.map((f) => f.id)).toEqual(['a1', 'a2', 'b']);
  });
});

describe('ehPistaDaMix', () => {
  it('reconhece só a pista montada na hora', () => {
    expect(ehPistaDaMix(ID_DA_MIX)).toBe(true);
    expect(ehPistaDaMix('t1')).toBe(false);
  });
});
