import JSZip from 'jszip';

import type { BufferDeAudio } from '@maestra/core/audio/contexto';
import { bytesDoWav } from '@maestra/core/audio/exportar';

// EXPORTAR: tirar o que está montado no editor para fora dele.
//
// Duas coisas saem daqui: os STEMS (cada pista, sozinha, num ZIP — para levar a outro programa)
// e a GUIA (a soma de tudo, pronta para ouvir — o mesmo ficheiro que a lista de Músicas toca).
//
// A guia já existe em MP3 (é o que a lista toca — ver `guia.ts`). Para quem quer WAV — sem
// perda, para masterizar ou arquivar — este arquivo também sabe render a montagem inteira e
// embrulhar em WAV, com a MESMA função que embrulha cada stem.

// ⚠️ O WAV E O NOME DO FICHEIRO MUDARAM-SE PARA O NÚCLEO quando o app passou a exportar
// também: o cabeçalho RIFF e a conversão das amostras são os mesmos nas duas superfícies, e o
// que muda é só o invólucro — `Blob` e link de download aqui, ficheiro e folha de partilha lá.
export { nomeDoArquivoDaPista } from '@maestra/core/audio/exportar';

/** O WAV desta montagem como `Blob`, pronto para o ZIP ou para o download. */
export const paraWav = (buffer: BufferDeAudio): Blob =>
  new Blob([bytesDoWav(buffer)], { type: 'audio/wav' });

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
