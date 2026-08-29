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

/** O balde do catálogo: capas e áudios das versões. */
export const BALDE_DO_CATALOGO = 'catalog';

/**
 * O tipo do arquivo, decidido pela EXTENSÃO — e não pelo que o sistema declara.
 *
 * O balde `catalog` tem lista fechada de tipos, e quem declara o tipo é quem envia. Aí mora a
 * armadilha: um .wav escolhido nos Ficheiros do iOS chega com `audio/vnd.wave` (a UTI da Apple
 * é `com.microsoft.waveform-audio`), que NÃO está na lista — o Storage recusa um arquivo que
 * ele aceitaria de bom grado sob outro nome. O navegador, para o mesmo arquivo, diz `audio/wav`.
 *
 * Dois seletores, dois nomes para o mesmo formato. A extensão é o que os dois concordam, e é
 * também o que o balde entende — então é ela que decide. O que não estiver aqui é recusado
 * ANTES de subir, com uma frase em português: a recusa do Storage chega depois do arquivo ter
 * viajado e diz "mime type ... is not supported", que não sugere o que fazer.
 */
const TIPO_POR_EXTENSAO: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const tipoDoCatalogo = (nome: string): string | null => {
  const extensao = nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (extensao && TIPO_POR_EXTENSAO[extensao]) || null;
};

const RECUSA = 'Esse formato não é aceito. Para áudio use MP3 ou WAV; para imagem, JPG, PNG ou WebP.';

export const enviarArquivo = async (
  balde: string,
  pasta: string,
  arquivo: { nome: string; tipo?: string; dados: ArrayBuffer | Blob },
): Promise<ArquivoEnviado> => {
  // No balde do catálogo o tipo NUNCA vem do seletor: sai da extensão, que é a única coisa em
  // que o navegador, os Ficheiros do iOS e o próprio balde concordam.
  const doCatalogo = balde === BALDE_DO_CATALOGO;
  const tipo = doCatalogo ? tipoDoCatalogo(arquivo.nome) : arquivo.tipo;
  if (doCatalogo && !tipo) throw new Error(RECUSA);

  const caminho = `${pasta}/${Date.now()}_${higienizar(arquivo.nome)}`;
  const { error } = await supabase.storage.from(balde).upload(caminho, arquivo.dados, {
    cacheControl: '3600',
    upsert: false,
    contentType: tipo ?? undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(balde).getPublicUrl(caminho);
  return { url: data.publicUrl, path: caminho, name: arquivo.nome };
};

export const removerArquivo = async (balde: string, caminho: string): Promise<void> => {
  await supabase.storage.from(balde).remove([caminho]);
};


/**
 * O nome da gravação, tirado do nome do arquivo.
 *
 * Quem manda um áudio já batizou o arquivo ("guia vocal v2.wav"), e digitar o mesmo nome de novo
 * é trabalho que ninguém confere. Tira a extensão, troca `_` e `-` por espaço e corta em 80,
 * que é o limite da coluna.
 */
export const tituloDoArquivo = (nome: string) =>
  nome.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
