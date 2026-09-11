import type { BufferDeAudio } from './contexto';

// EXPORTAR: tirar o que está montado no editor para fora dele.
//
// ⚠️ ISTO MORA NO NÚCLEO porque as duas superfícies exportam a MESMA coisa. O que difere é só o
// que se faz com os bytes no fim: a web embrulha num `Blob` e dispara um link de download; o app
// escreve um ficheiro e abre a folha de partilha do sistema. O cabeçalho RIFF, a conversão das
// amostras e o nome do ficheiro são iguais — e duas cópias deles divergiriam no primeiro ajuste,
// com o sintoma a aparecer só num dos lados e só depois de alguém abrir o ficheiro noutro
// programa.

/**
 * Tira acento e troca o que não for letra, número, espaço, traço ou sublinhado por `_`.
 *
 * ⚠️ O RECURSO É QUANDO NÃO SOBRA LETRA NENHUMA, e não quando a string fica vazia. A versão
 * anterior testava só o vazio — mas a troca acontece ANTES, então uma pista chamada "///" já
 * chegava ao teste como "___", que não é vazio: o recurso nunca corria, e o ficheiro saía do
 * ZIP chamado `___.wav`. É o mesmo tipo de nome que um nome em japonês ou em árabe produz.
 */
export const higienizar = (nome: string): string => {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '_')
    .trim();
  return /[a-zA-Z0-9]/.test(limpo) ? limpo : 'pista';
};

/** O nome de arquivo de uma pista, com a extensão pedida — higienizado, sem repetir extensão. */
export const nomeDoArquivoDaPista = (nomeDaPista: string, extensao: 'wav' | 'mp3'): string =>
  `${higienizar(nomeDaPista)}.${extensao}`;

/**
 * Um `AudioBuffer` em WAV (PCM 16-bit), sem perda e sem dependência.
 *
 * WAV é só um cabeçalho RIFF na frente das amostras — não precisa de codificador (ao contrário
 * do MP3), e por isso não trava a tela: mesmo um WAV de alguns minutos é escrito em
 * milissegundos.
 */
export const bytesDoWav = (buffer: BufferDeAudio): Uint8Array<ArrayBuffer> => {
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

  return new Uint8Array(arrayBuffer);
};
