import { Mp3Encoder } from '@breezystack/lamejs';

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

// ─── A GUIA, em MP3 ─────────────────────────────────────────────────────────
//
// A lista de Músicas toca UMA coisa por música. Antes essa coisa era a "gravação principal" —
// fazia sentido quando uma música era várias gravações alternativas e uma delas era a boa. Com
// o editor, uma música passou a ser uma MONTAGEM: bateria, piano, voz, tocando juntas. Eleger
// uma principal entre elas seria eleger a bateria como a música. Então o produto gera a soma.

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
 * Feito em blocos porque o codificador quer blocos, e porque assim a tela respira entre eles —
 * um laço de dez milhões de amostras sem pausa congela a interface, e congelar a tela de alguém
 * para gerar um ficheiro que ela nem pediu é o pior tipo de custo. No telemóvel isto pesa mais
 * do que no computador: é a mesma conta num processador que é uma fração do outro.
 *
 * `aoAndar` recebe 0..1 — é o que deixa a tela dizer quanto falta em vez de fingir que travou.
 */
export const bytesDoMp3 = async (
  buffer: BufferDeAudio,
  aoAndar?: (parte: number) => void,
): Promise<Uint8Array<ArrayBuffer>> => {
  const canais = Math.min(2, buffer.numberOfChannels);
  const esquerdo = paraInteiros(buffer.getChannelData(0));
  const direito = canais > 1 ? paraInteiros(buffer.getChannelData(1)) : esquerdo;

  const codificador = new Mp3Encoder(canais, buffer.sampleRate, KBPS);
  const partes: Uint8Array[] = [];
  let total = 0;

  for (let i = 0; i < esquerdo.length; i += QUADRO) {
    const pedaco = codificador.encodeBuffer(
      esquerdo.subarray(i, i + QUADRO),
      canais > 1 ? direito.subarray(i, i + QUADRO) : undefined,
    );
    if (pedaco.length) { partes.push(pedaco); total += pedaco.length; }
    // A cada ~5 segundos de áudio, devolve a vez a quem está a desenhar a tela.
    if ((i / QUADRO) % 200 === 0) {
      aoAndar?.(i / esquerdo.length);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((segue) => { setTimeout(segue, 0); });
    }
  }

  const fim = codificador.flush();
  if (fim.length) { partes.push(fim); total += fim.length; }
  aoAndar?.(1);

  // Uma cópia só no fim: concatenar a cada bloco seria copiar o ficheiro inteiro mil vezes.
  const tudo = new Uint8Array(new ArrayBuffer(total));
  let em = 0;
  for (const parte of partes) { tudo.set(parte, em); em += parte.length; }
  return tudo;
};

/**
 * Acima de que amostra é que já se chama som. −80 dBFS: abaixo disto não há gravação, há ruído
 * de arredondamento do codificador.
 */
export const LIMIAR_DO_SILENCIO = 1e-4;

/**
 * De quantas em quantas amostras se espreita o buffer.
 *
 * ⚠️ AMOSTRADO, e não amostra a amostra: uma guia de dois minutos são 5,8 milhões de amostras
 * por canal, e percorrê-las todas só para responder "tem som?" seria pagar de novo o preço da
 * renderização. Uma a cada 64 é uma espreitadela a cada 1,5 ms — nenhuma gravação de verdade
 * se esconde nesse intervalo, e uma que se escondesse seria silêncio na prática.
 */
const PASSO_DA_ESPREITA = 64;

/**
 * O buffer tem som, ou é silêncio?
 *
 * ⚠️ ISTO EXISTE PARA NÃO GRAVAR SILÊNCIO POR CIMA DA GUIA BOA. A guia é a soma da montagem, e
 * é o que a lista de Músicas toca; ela é regravada no MESMO caminho a cada saída do editor. Uma
 * montagem que por algum motivo renderiza mudo — todas as pistas caladas, um áudio que não
 * chegou a descodificar, uma pista vazia a ser a única que resta — apagaria a guia anterior e
 * deixaria a música sem nada para tocar, sem erro nenhum a explicar porquê.
 *
 * Entre gravar silêncio e não gravar, não gravar é sempre melhor: a montagem continua salva, a
 * guia anterior continua a tocar, e a saída seguinte tenta de novo.
 */
export const temSom = (buffer: BufferDeAudio, limiar = LIMIAR_DO_SILENCIO): boolean => {
  for (let canal = 0; canal < buffer.numberOfChannels; canal += 1) {
    const dados = buffer.getChannelData(canal);
    for (let i = 0; i < dados.length; i += PASSO_DA_ESPREITA) {
      if (Math.abs(dados[i]) > limiar) return true;
    }
  }
  return false;
};

/** O que se diz a quem acabou de sair de uma montagem que não soa. */
export const MONTAGEM_MUDA = 'A montagem está em silêncio: a guia anterior continua no lugar.';

/**
 * O que a tela escreve enquanto a guia está a ser feita.
 *
 * ⚠️ COM A PERCENTAGEM, e não só as reticências. Codificar MP3 é JavaScript a correr sobre cada
 * amostra, e o preço disso muda de máquina para máquina: no computador são segundos, no
 * telemóvel foram medidos 101 segundos para 227 de áudio — quase metade do tempo real da
 * música. Reticências que não se mexem durante um minuto e meio são indistinguíveis de uma tela
 * pendurada, e quem espera fecha o aplicativo — que é exatamente o gesto que perde o trabalho.
 *
 * O texto mora aqui porque as duas telas o escrevem, e um sinal de espera que diz coisas
 * diferentes em cada uma é duas explicações para a mesma pausa.
 */
export const rotuloDaGuia = (parte?: number | null): string => (
  parte == null || !Number.isFinite(parte)
    ? 'Gerando a guia…'
    : `Gerando a guia… ${Math.min(100, Math.max(0, Math.round(parte * 100)))}%`
);

/** O caminho da guia de uma música. FIXO: uma música tem uma guia, e ela é regravada por cima. */
export const caminhoDaGuia = (artistaId: string, projetoId: string): string =>
  `${artistaId}/${projetoId}/guia.mp3`;
