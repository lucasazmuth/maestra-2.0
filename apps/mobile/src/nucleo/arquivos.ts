import { createAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import {
  BALDE_DO_CATALOGO, enviarArquivo, type ArquivoEnviado,
} from '@maestra/core/services/armazenamento';

// Escolher um arquivo no aparelho e mandá-lo para o Storage.
//
// O núcleo envia BYTES; quem os lê é a superfície. Na web o `File` já é o corpo da requisição;
// aqui o seletor devolve uma URI (`file://…` ou um caminho do provedor) e é preciso abrir e ler.
//
// `fetch(uri).then(r => r.blob())` também funcionaria, mas o Blob do React Native é um ponteiro
// para um arquivo — mandá-lo ao supabase-js sobe um corpo vazio em algumas versões. Ler os bytes
// de uma vez é maior na memória e é o que de fato chega inteiro do outro lado.

export interface ArquivoEscolhido {
  nome: string;
  tipo?: string;
  uri: string;
  tamanho?: number;
}

/** O áudio de uma versão: qualquer formato que o aparelho reconheça como som. */
export const escolherAudio = async (): Promise<ArquivoEscolhido | null> => {
  const escolha = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });
  if (escolha.canceled || !escolha.assets?.[0]) return null;

  const arquivo = escolha.assets[0];
  return {
    nome: arquivo.name,
    tipo: arquivo.mimeType ?? undefined,
    uri: arquivo.uri,
    tamanho: arquivo.size ?? undefined,
  };
};

/**
 * A capa: uma imagem da galeria, sempre em JPEG.
 *
 * Pede permissão antes — no iOS a primeira leitura da galeria abre o pedido do sistema, e sem
 * ele o seletor volta vazio como se a pessoa tivesse desistido.
 *
 * A conversão NÃO é zelo: a foto do iPhone sai em HEIC, o balde recusa o formato ("mime type
 * image/heic is not supported") e, mesmo se aceitasse, nenhum navegador desenha HEIC — a capa
 * subiria e apareceria quebrada na web. O JPEG é o formato que os dois lados entendem.
 */
export const escolherImagem = async (): Promise<ArquivoEscolhido | null> => {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) throw new Error('Preciso de acesso às suas fotos para escolher a capa.');

  const escolha = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
  if (escolha.canceled || !escolha.assets?.[0]) return null;

  const imagem = escolha.assets[0];
  const contexto = ImageManipulator.manipulate(imagem.uri);
  const convertida = await (await contexto.renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
  });

  // O nome também troca de extensão: guardar "IMG_0042.HEIC" apontando para um JPEG é a
  // pegadinha que só aparece quando alguém baixa o arquivo.
  const nome = (imagem.fileName ?? `capa-${Date.now()}`).replace(/\.[^.]+$/, '');
  return {
    nome: `${nome}.jpg`,
    tipo: 'image/jpeg',
    uri: convertida.uri,
  };
};

/** Lê o arquivo escolhido e o envia pelo MESMO caminho que a web usa. */
export const enviarEscolhido = async (
  balde: string,
  pasta: string,
  arquivo: ArquivoEscolhido,
): Promise<ArquivoEnviado> => {
  const dados = await new File(arquivo.uri).bytes();
  return enviarArquivo(balde, pasta, {
    nome: arquivo.nome,
    tipo: arquivo.tipo,
    // `bytes()` devolve um Uint8Array; o corpo da requisição precisa do buffer por trás.
    dados: dados.buffer as ArrayBuffer,
  });
};

export const enviarParaOCatalogo = (pasta: string, arquivo: ArquivoEscolhido) =>
  enviarEscolhido(BALDE_DO_CATALOGO, pasta, arquivo);

/**
 * A duração da gravação, lida do próprio arquivo.
 *
 * Digitar duração à mão é trabalho que ninguém confere, e a web já não pede: o `<audio>` do
 * navegador responde nos metadados. Aqui é o mesmo, com um player descartável — ele é fechado
 * na saída, senão cada versão enviada deixa um tocador vivo segurando o arquivo.
 *
 * Formato que o aparelho não decodifica não impede o envio: a versão só fica sem duração.
 */
export const duracaoDoAudio = async (uri: string): Promise<string | null> => {
  const tocador = createAudioPlayer({ uri });
  try {
    // O `duration` só existe depois que os metadados chegam; em arquivo local isso é imediato,
    // mas "imediato" ainda é o próximo ciclo.
    for (let tentativa = 0; tentativa < 20; tentativa += 1) {
      const segundos = tocador.duration;
      if (Number.isFinite(segundos) && segundos > 0) {
        const m = Math.floor(segundos / 60);
        const s = String(Math.floor(segundos % 60)).padStart(2, '0');
        return `${m}:${s}`;
      }
      await new Promise((pronto) => setTimeout(pronto, 100));
    }
    return null;
  } catch {
    return null;
  } finally {
    tocador.release();
  }
};
