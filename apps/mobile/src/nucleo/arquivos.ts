import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
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
 * A capa: uma imagem da galeria.
 *
 * Pede permissão antes — no iOS a primeira leitura da galeria abre o pedido do sistema, e sem
 * ele o seletor volta vazio como se a pessoa tivesse desistido.
 */
export const escolherImagem = async (): Promise<ArquivoEscolhido | null> => {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) throw new Error('Preciso de acesso às suas fotos para escolher a capa.');

  const escolha = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (escolha.canceled || !escolha.assets?.[0]) return null;

  const imagem = escolha.assets[0];
  return {
    nome: imagem.fileName ?? `capa-${Date.now()}.jpg`,
    tipo: imagem.mimeType ?? 'image/jpeg',
    uri: imagem.uri,
    tamanho: imagem.fileSize,
  };
};

/** Lê o arquivo escolhido e o envia pelo MESMO caminho que a web usa. */
export const enviarParaOCatalogo = async (
  pasta: string,
  arquivo: ArquivoEscolhido,
): Promise<ArquivoEnviado> => {
  const dados = await new File(arquivo.uri).bytes();
  return enviarArquivo(BALDE_DO_CATALOGO, pasta, {
    nome: arquivo.nome,
    tipo: arquivo.tipo,
    // `bytes()` devolve um Uint8Array; o corpo da requisição precisa do buffer por trás.
    dados: dados.buffer as ArrayBuffer,
  });
};
