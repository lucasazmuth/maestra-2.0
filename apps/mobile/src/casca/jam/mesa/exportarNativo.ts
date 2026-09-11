import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import { bytesDoWav, nomeDaGuia, nomeDoArquivoDaPista } from '@maestra/core/audio/exportar';
import type { BufferDeAudio, ContextoOffline } from '@maestra/core/audio/contexto';

// EXPORTAR NO TELEMÓVEL: o mesmo que a web faz, entregue de outro jeito.
//
// A web dispara um download — o ficheiro cai na pasta de transferências e o trabalho da tela
// acaba ali. Um telemóvel não tem pasta de transferências que se abra noutro programa: o que
// ele tem é a FOLHA DE PARTILHA, onde a pessoa escolhe o destino (AirDrop para o computador
// onde está o Ableton, Ficheiros, WhatsApp, e-mail). É o mesmo gesto com outra forma, e é por
// isso que aqui não há "Baixar" e sim "Enviar".
//
// ⚠️ OS BYTES SÃO OS MESMOS: `bytesDoWav` e `nomeDoArquivoDaPista` vêm do núcleo, partilhados
// com a web. O que este ficheiro acrescenta é só onde eles pousam antes de irem embora.

/** A pasta dos ficheiros que já saíram — cache, porque depois de partilhados não servem mais. */
const PASTA = 'exportado';

const pastaDeSaida = (): Directory => {
  const pasta = new Directory(Paths.cache, PASTA);
  if (!pasta.exists) pasta.create({ intermediates: true });
  return pasta;
};

/**
 * Escreve os bytes num ficheiro e abre a folha de partilha.
 *
 * ⚠️ O FICHEIRO É APAGADO ANTES DE ESCREVER, e não depois de partilhar: a folha de partilha
 * devolve o controlo assim que a pessoa escolhe o destino, mas a cópia para o destino ainda
 * está a acontecer — apagar aí entregaria um ficheiro truncado. Ficam na pasta de cache, que o
 * sistema limpa, e a exportação seguinte escreve por cima.
 */
const partilhar = async (nome: string, bytes: Uint8Array, tipo: string): Promise<void> => {
  const ficheiro = new File(pastaDeSaida(), nome);
  if (ficheiro.exists) ficheiro.delete();
  ficheiro.write(bytes);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este aparelho não sabe compartilhar arquivos.');
  }
  await Sharing.shareAsync(ficheiro.uri, { mimeType: tipo, UTI: tipo });
};

export type CriarOffline = (canais: number, quadros: number, taxa: number) => ContextoOffline;

/** O que destas funções a mesa precisa saber fazer, e só isso — os testes passam um duplo. */
export interface MesaQueRenderiza {
  renderizar(criarOffline: CriarOffline, apenasPistaId?: string): Promise<BufferDeAudio | null>;
}

/**
 * Cada pista sozinha, num ZIP, e a folha de partilha aberta.
 *
 * Sequencial, e não `Promise.all`: cada `renderizar` percorre o buffer descodificado inteiro —
 * em paralelo, uma gravação de dez pistas tentaria segurar dez montagens ao mesmo tempo, e é
 * isso que faz o app fechar sozinho num telemóvel, não o tempo total de espera.
 */
export const partilharStems = async (
  mesa: MesaQueRenderiza,
  criarOffline: CriarOffline,
  pistas: { id: string; nome: string }[],
  titulo: string,
): Promise<number> => {
  const zip = new JSZip();
  let quantas = 0;

  for (const pista of pistas) {
    // eslint-disable-next-line no-await-in-loop
    const rendido = await mesa.renderizar(criarOffline, pista.id);
    if (!rendido) continue;
    zip.file(nomeDoArquivoDaPista(pista.nome, 'wav'), bytesDoWav(rendido));
    quantas += 1;
  }
  if (!quantas) return 0;

  // Sem compressão: áudio já é denso, e comprimir de novo é CPU gasta por um ganho que não vem
  // — num telemóvel isso é bateria e um minuto de espera por nada.
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  await partilhar(`${nomeDoArquivoDaPista(titulo, 'wav').replace(/\.wav$/, '')}.zip`, bytes, 'application/zip');
  return quantas;
};

/** A soma de tudo num WAV, sem perda — para masterizar ou arquivar. */
export const partilharGuiaWav = async (
  mesa: MesaQueRenderiza,
  criarOffline: CriarOffline,
  titulo: string,
): Promise<boolean> => {
  const rendido = await mesa.renderizar(criarOffline);
  if (!rendido) return false;
  await partilhar(nomeDoArquivoDaPista(titulo, 'wav'), bytesDoWav(rendido), 'audio/wav');
  return true;
};

/**
 * A guia que já existe, em MP3 — a mesma que a lista de Músicas toca.
 *
 * Busca o ficheiro em vez de partilhar o endereço: só assim ele chega ao destino com o nome da
 * música, e não `guia.mp3` — o mesmo endereço fixo que toda gravação tem.
 *
 * ⚠️ O NOME VEM DO NÚCLEO (`nomeDaGuia`), e é o mesmo que a web escreve ao baixar. Aqui estava
 * `nomeDoArquivoDaPista`, que dá `Musica.mp3`: o mesmo ficheiro chegava ao computador com dois
 * nomes conforme o aparelho de onde saiu, e quem recebe os dois não sabe que são a mesma coisa.
 */
export const partilharGuiaMp3 = async (url: string, titulo: string): Promise<void> => {
  const destino = new File(pastaDeSaida(), nomeDaGuia(titulo));
  if (destino.exists) destino.delete();
  const baixado = await File.downloadFileAsync(url, destino);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este aparelho não sabe compartilhar arquivos.');
  }
  await Sharing.shareAsync(baixado.uri, { mimeType: 'audio/mpeg', UTI: 'audio/mpeg' });
};
