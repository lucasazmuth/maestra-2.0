import JSZip from 'jszip';

import type { BufferDeAudio } from '@maestra/core/audio/contexto';

// EXPORTAR: tirar o que está montado no editor para fora dele.
//
// Duas coisas saem daqui: os STEMS (cada pista, sozinha, num ZIP — para levar a outro programa)
// e a GUIA (a soma de tudo, pronta para ouvir — o mesmo ficheiro que a lista de Músicas toca).
//
// A guia já existe em MP3 (é o que a lista toca — ver `guia.ts`). Para quem quer WAV — sem
// perda, para masterizar ou arquivar — este arquivo também sabe render a montagem inteira e
// embrulhar em WAV, com a MESMA função que embrulha cada stem.

/** Tira acento e troca o que não for letra, número, espaço, traço ou sublinhado por `_`. */
const higienizar = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '_')
    .trim() || 'pista';

/**
 * Um `AudioBuffer` em WAV (PCM 16-bit), sem perda e sem dependência.
 *
 * WAV é só um cabeçalho RIFF na frente das amostras — não precisa de codificador (ao contrário
 * do MP3), e por isso não trava a aba: mesmo um WAV de alguns minutos é escrito em milissegundos.
 */
export const paraWav = (buffer: BufferDeAudio): Blob => {
  const canais = buffer.numberOfChannels;
  const quadros = buffer.length;
  const taxa = buffer.sampleRate;
  const bytesPorAmostra = 2; // 16-bit
  const dados = quadros * canais * bytesPorAmostra;

  const arrayBuffer = new ArrayBuffer(44 + dados);
  const vista = new DataView(arrayBuffer);

  const texto = (deslocamento: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) vista.setUint8(deslocamento + i, s.charCodeAt(i));
  };

  // Cabeçalho RIFF/WAVE — os nomes e tamanhos são os do formato, não escolha nossa.
  texto(0, 'RIFF');
  vista.setUint32(4, 36 + dados, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  vista.setUint32(16, 16, true); // tamanho do bloco fmt
  vista.setUint16(20, 1, true); // PCM
  vista.setUint16(22, canais, true);
  vista.setUint32(24, taxa, true);
  vista.setUint32(28, taxa * canais * bytesPorAmostra, true); // byte rate
  vista.setUint16(32, canais * bytesPorAmostra, true); // block align
  vista.setUint16(34, 16, true); // bits por amostra
  texto(36, 'data');
  vista.setUint32(40, dados, true);

  // As amostras entrelaçadas (LRLRLR…), presas entre −1 e 1 antes de escalar — uma amostra fora
  // do intervalo daria a volta e viraria um estalo no lado oposto da onda.
  const canaisDoBuffer = Array.from({ length: canais }, (_, i) => buffer.getChannelData(i));
  let deslocamento = 44;
  for (let quadro = 0; quadro < quadros; quadro += 1) {
    for (let c = 0; c < canais; c += 1) {
      const amostra = Math.max(-1, Math.min(1, canaisDoBuffer[c][quadro]));
      vista.setInt16(deslocamento, amostra < 0 ? amostra * 0x8000 : amostra * 0x7fff, true);
      deslocamento += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

/** Um stem pronto para entrar no ZIP: o nome do arquivo e os bytes. */
export interface StemExportado {
  nome: string;
  dados: Blob;
}

/** Embrulha os stems num ZIP só — sem compressão (áudio já é denso; comprimir de novo é CPU
 * gasta por um ganho que não vem). */
export const paraZip = async (stems: StemExportado[]): Promise<Blob> => {
  const zip = new JSZip();
  stems.forEach(({ nome, dados }) => zip.file(nome, dados));
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
};

/** O nome de arquivo de uma pista, com a extensão pedida — higienizado, sem repetir extensão. */
export const nomeDoArquivoDaPista = (nomeDaPista: string, extensao: 'wav' | 'mp3'): string =>
  `${higienizar(nomeDaPista)}.${extensao}`;

/**
 * Dispara o download no navegador.
 *
 * Um link temporário com `download`: é a única forma sem backend de entregar um Blob como
 * arquivo, e o link nunca chega a aparecer na tela — nasce, clica-se nele por código, e morre.
 */
export const baixarArquivo = (blob: Blob, nome: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Adiado: revogar na mesma volta do laço de eventos já derrubou o download em alguns
  // navegadores — o clique ainda não tinha acabado de iniciar a busca do blob: URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
