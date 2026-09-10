import { supabase } from '../../lib/supabase';
import { readEdgeFunctionError } from '../../lib/edgeError';

// O certificado de autoria de uma versão.
//
// Um carimbo de EXISTÊNCIA: a impressão digital do arquivo, o instante em que foi calculada e
// quem declarou a autoria. Responde "esta gravação já existia nesta data, exatamente assim".
//
// ⚠️ NÃO é registro de direito autoral, e a interface tem que dizer isso antes de qualquer outra
// coisa. Quem lê "certificado" num produto de música pensa em ECAD e em Biblioteca Nacional, e
// deixar essa confusão de pé seria vender uma proteção que não existe. A frase está em
// `AVISO_DO_CERTIFICADO`, uma vez só, para as duas superfícies dizerem o mesmo.
//
// Quem CALCULA o hash é o servidor, na edge function `version-certify`, lendo o arquivo do
// próprio balde. Um hash mandado pelo cliente não certificaria nada: quem carimba seria quem é
// carimbado. Por isso aqui não há caminho de escrita direto — só o `invoke`.

export interface CertificadoDeAutoria {
  id: string;
  artist_id: string;
  /** Fica nulo se a versão for apagada — o certificado sobrevive ao que documenta. */
  version_id: string | null;
  /** Artista, música e versão NO MOMENTO do carimbo, guardados por cópia. */
  artista: string;
  musica: string;
  versao: string;
  sha256: string;
  algoritmo: string;
  arquivo_url: string;
  arquivo_nome: string | null;
  arquivo_bytes: number | null;
  autor_id: string | null;
  autor_nome: string;
  certificado_em: string;
}

/** A ressalva que acompanha o certificado em toda superfície onde ele aparece. */
// Escrita para valer ANTES e DEPOIS de existir um certificado: ela aparece nos dois estados,
// e "este certificado comprova" dito ao lado de um botão de registrar fala de uma coisa que
// ainda não existe.
export const AVISO_DO_CERTIFICADO =
  'O registro comprova que o arquivo existia na data indicada, com aquele conteúdo exato. '
  + 'Não é registro de direito autoral e não substitui o registro na Biblioteca Nacional '
  + 'nem o cadastro no ECAD.';

const TABELA = 'version_certificates';

/** Os certificados de uma versão, do mais recente para o mais antigo. */
export const listarCertificados = async (versionId: string): Promise<CertificadoDeAutoria[]> => {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('version_id', versionId)
    .order('certificado_em', { ascending: false });
  if (error) throw error;
  return (data || []) as CertificadoDeAutoria[];
};

/**
 * Pede o carimbo ao servidor.
 *
 * `novo` diz se nasceu agora ou se já existia: certificar duas vezes o mesmo arquivo devolve o
 * carimbo antigo, com a data original. Emitir um segundo com a data de hoje enfraqueceria o
 * primeiro, que é justamente o que prova que a gravação é mais velha — e a interface precisa
 * saber a diferença para não anunciar "certificado!" quando não fez nada.
 */
export const certificarVersao = async (
  versionId: string,
): Promise<{ certificado: CertificadoDeAutoria; novo: boolean }> => {
  const { data, error } = await supabase.functions.invoke('version-certify', {
    body: { versionId },
  });
  if (error) throw new Error(await readEdgeFunctionError(error, 'Não consegui certificar esta versão.'));
  if (!data?.certificado) throw new Error('Não consegui certificar esta versão.');
  return { certificado: data.certificado as CertificadoDeAutoria, novo: !!data.novo };
};

/**
 * O hash em grupos de oito, para caber na tela e para o olho conseguir conferir.
 *
 * Sessenta e quatro caracteres numa linha só é uma parede que ninguém lê nem compara. Quebrado,
 * dá para bater o começo e o fim com outro documento sem contar caractere.
 */
export const hashLegivel = (sha256: string): string =>
  (sha256.match(/.{1,8}/g) || []).join(' ');
