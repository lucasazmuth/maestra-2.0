import { supabase } from '../lib/supabase';

// O envio de arquivos para o Storage do Supabase.
//
// Vivia em `src/lib/storage.ts`, só na web, e recebia um `File` — que no React Native não
// existe. Subiu pro núcleo com uma forma que serve às duas: os BYTES mais o nome e o tipo. Na
// web isso sai do `File`; no app, de ler o arquivo escolhido pelo seletor do sistema.
//
// O que precisa ficar igual nas duas é o CAMINHO do arquivo — o nome higienizado e o carimbo de
// tempo na frente. Um artista que envia "Demo (final) v2.mp3" nas duas superfícies tem que ver o
// mesmo arquivo, e não dois com nomes diferentes.
//
// Upload direto, sem retomada: para capas e áudios curtos, que é o que o catálogo recebe, ele
// basta. Arquivo grande em rede ruim recomeça do zero.

export interface ArquivoEnviado {
  url: string;
  path: string;
  name: string;
}

/** Tira acento e troca o que não for letra, número, ponto, traço ou sublinhado. */
const higienizar = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

export const enviarArquivo = async (
  balde: string,
  pasta: string,
  arquivo: { nome: string; tipo?: string; dados: ArrayBuffer | Blob },
): Promise<ArquivoEnviado> => {
  const caminho = `${pasta}/${Date.now()}_${higienizar(arquivo.nome)}`;
  const { error } = await supabase.storage.from(balde).upload(caminho, arquivo.dados, {
    cacheControl: '3600',
    upsert: false,
    contentType: arquivo.tipo,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(balde).getPublicUrl(caminho);
  return { url: data.publicUrl, path: caminho, name: arquivo.nome };
};

export const removerArquivo = async (balde: string, caminho: string): Promise<void> => {
  await supabase.storage.from(balde).remove([caminho]);
};

/** O balde do catálogo: capas e áudios das versões. */
export const BALDE_DO_CATALOGO = 'catalog';

/**
 * O nome da gravação, tirado do nome do arquivo.
 *
 * Quem manda um áudio já batizou o arquivo ("guia vocal v2.wav"), e digitar o mesmo nome de novo
 * é trabalho que ninguém confere. Tira a extensão, troca `_` e `-` por espaço e corta em 80,
 * que é o limite da coluna.
 */
export const tituloDoArquivo = (nome: string) =>
  nome.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
