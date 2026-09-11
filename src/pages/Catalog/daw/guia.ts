import type { BufferDeAudio, ContextoOffline } from '@maestra/core/audio/contexto';
import { bytesDoMp3 } from '@maestra/core/audio/exportar';

// A GUIA: a montagem inteira num MP3 só.
//
// ─── Por que existe ──────────────────────────────────────────────────────────
//
// A lista de Músicas toca UMA coisa por música. Antes essa coisa era a "gravação principal" —
// fazia sentido quando uma música era várias gravações alternativas e uma delas era a boa. Com
// o editor, uma música passou a ser uma MONTAGEM: bateria, piano, voz, tocando juntas. Eleger
// uma principal entre elas não quer dizer nada — seria eleger a bateria como a música.
//
// Então o produto passa a gerar a soma. É isso que a lista toca.

/** O contexto que renderiza, no navegador. */
export const criarOfflineWeb = (canais: number, quadros: number, taxa: number): ContextoOffline => {
  const Offline = window.OfflineAudioContext
    || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) throw new Error('Este navegador não consegue gerar a guia.');
  return new Offline(canais, quadros, taxa) as unknown as ContextoOffline;
};

// ⚠️ O CODIFICADOR MUDOU-SE PARA O NÚCLEO quando o app passou a gerar a guia também. O que
// muda entre as duas superfícies é só o invólucro — `Blob` aqui, ficheiro lá —, e duas cópias
// de um codificador divergem na primeira afinação de qualidade, com o sintoma a aparecer só num
// dos lados e só depois de alguém reparar que a guia de um soa diferente da do outro.
export { caminhoDaGuia } from '@maestra/core/audio/exportar';

/** O buffer renderizado, em MP3, pronto para subir. */
export const paraMp3 = async (buffer: BufferDeAudio): Promise<Blob> =>
  new Blob([await bytesDoMp3(buffer)], { type: 'audio/mpeg' });

