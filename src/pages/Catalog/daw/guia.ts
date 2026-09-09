import { Mp3Encoder } from '@breezystack/lamejs';

import type { BufferDeAudio, ContextoOffline } from '@maestra/core/audio/contexto';

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

/**
 * A qualidade da guia.
 *
 * 128 kbps estéreo: ~1 MB por minuto. Ela é uma REFERÊNCIA para ouvir na lista, não um master —
 * e cada quilobit a mais é armazenamento por música e, sobretudo, download de quem for ouvir.
 */
const KBPS = 128;
/** Quantas amostras por bloco entregue ao codificador. 1152 é o quadro do MP3. */
const QUADRO = 1152;

const paraInteiros = (canal: Float32Array): Int16Array => {
  const saida = new Int16Array(canal.length);
  for (let i = 0; i < canal.length; i += 1) {
    // Preso entre −1 e 1 antes de escalar: uma amostra fora do intervalo daria a volta e viraria
    // um estalo no lado oposto da onda.
    const amostra = Math.max(-1, Math.min(1, canal[i]));
    saida[i] = amostra < 0 ? amostra * 0x8000 : amostra * 0x7fff;
  }
  return saida;
};

/**
 * O buffer renderizado, em MP3.
 *
 * Feito em blocos porque o codificador quer blocos, e porque assim o navegador respira entre
 * eles — um `for` de dez milhões de amostras sem pausa congela a aba, e congelar a aba de
 * alguém para gerar um ficheiro que ela nem pediu é o pior tipo de custo.
 */
export const paraMp3 = async (buffer: BufferDeAudio): Promise<Blob> => {
  const canais = Math.min(2, buffer.numberOfChannels);
  const esquerdo = paraInteiros(buffer.getChannelData(0));
  const direito = canais > 1 ? paraInteiros(buffer.getChannelData(1)) : esquerdo;

  const codificador = new Mp3Encoder(canais, buffer.sampleRate, KBPS);
  const partes: Uint8Array[] = [];

  for (let i = 0; i < esquerdo.length; i += QUADRO) {
    const pedaco = codificador.encodeBuffer(
      esquerdo.subarray(i, i + QUADRO),
      canais > 1 ? direito.subarray(i, i + QUADRO) : undefined,
    );
    if (pedaco.length) partes.push(pedaco);
    // A cada ~5 segundos de áudio, devolve a vez ao navegador.
    if ((i / QUADRO) % 200 === 0) await new Promise((segue) => setTimeout(segue, 0));
  }

  const fim = codificador.flush();
  if (fim.length) partes.push(fim);

  return new Blob(partes as BlobPart[], { type: 'audio/mpeg' });
};

/** O caminho da guia de uma música. FIXO: uma música tem uma guia, e ela é regravada por cima. */
export const caminhoDaGuia = (artistaId: string, projetoId: string) =>
  `${artistaId}/${projetoId}/guia.mp3`;
