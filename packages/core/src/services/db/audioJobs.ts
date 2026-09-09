import { supabase } from '../../lib/supabase';
import { readEdgeFunctionError } from '../../lib/edgeError';

// A FILA de análise de áudio, vista do lado do cliente.
//
// O cliente não escreve na fila: `audio_jobs` não tem policy de INSERT, e quem enfileira é a
// edge function `audio-job-create`, que é onde se confere permissão e cota. Daqui só se PEDE,
// se OLHA e se CANCELA o que ainda não começou.

export type TipoDeAnalise = 'bpm_tom' | 'letra' | 'sensorial' | 'converter';
export type EstadoDoTrabalho = 'na_fila' | 'a_correr' | 'pronto' | 'erro';

export interface TrabalhoDeAudio {
  id: string;
  artist_id: string;
  version_id: string | null;
  tipo: TipoDeAnalise;
  estado: EstadoDoTrabalho;
  resultado: Record<string, unknown> | null;
  erro: string | null;
  tentativas: number;
  criado_em: string;
  iniciado_em: string | null;
  terminado_em: string | null;
}

/** O que a máquina descobriu. Nunca substitui o que o artista escreveu — fica ao lado. */
export interface AnaliseDaVersao {
  id: string;
  version_id: string;
  arquivo_sha256: string;
  motor: string;
  bpm: number | null;
  bpm_confianca: number | null;
  tom: string | null;
  tom_escala: string | null;
  tom_confianca: number | null;
  duracao_segundos: number | null;
  caracteristicas: Record<string, number> | null;
  criado_em: string;
}

/** Quantas análises um artista sem PRO pode pedir por mês. Espelha o limite da edge function. */
export const LIMITE_MENSAL_DE_ANALISES = 10;

/** Enquanto está num destes, ainda há o que esperar. */
export const aindaAndando = (t?: TrabalhoDeAudio | null): boolean =>
  t?.estado === 'na_fila' || t?.estado === 'a_correr';

/**
 * Abaixo disto, a sugestão de tom vem com ressalva em vez de vir como resposta.
 *
 * O `KeyExtractor` confunde relativa maior com menor a toda a hora — Am e C têm as mesmas
 * notas —, e um palpite apresentado com a mesma cara de um BPM (que é bem mais confiável)
 * engana quem lê. O número mora aqui, e não nas telas: nasceu duplicado nas duas superfícies e
 * duas cópias de um limiar divergem no primeiro ajuste.
 */
export const CONFIANCA_BAIXA = 0.6;

/** O tom veio inseguro o bastante para merecer uma ressalva na tela? */
export const tomInseguro = (analise?: Pick<AnaliseDaVersao, 'tom_confianca'> | null): boolean =>
  (analise?.tom_confianca ?? 1) < CONFIANCA_BAIXA;

/**
 * O BPM como se escreve num campo: inteiro.
 *
 * O detector devolve 127,8 e ninguém anota isso na ficha — anota 128. A casa decimal fica
 * guardada no banco para quem quiser conferir.
 */
export const bpmLegivel = (bpm?: number | string | null): string => {
  const n = Number(bpm);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
};

/**
 * `C` + `minor` → `Cm`. O que a pessoa lê e escreve no campo de tom.
 *
 * A escala vem separada do banco porque comparar tom entre faixas precisa das duas partes; para
 * a tela, o que serve é a forma curta que todo mundo usa.
 */
export const tomLegivel = (tom?: string | null, escala?: string | null): string => {
  if (!tom) return '';
  return escala === 'minor' ? `${tom}m` : tom;
};

/** O último trabalho de cada tipo numa versão. */
export const trabalhosDaVersao = async (versionId: string): Promise<TrabalhoDeAudio[]> => {
  const { data, error } = await supabase
    .from('audio_jobs')
    .select('*')
    .eq('version_id', versionId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return (data || []) as TrabalhoDeAudio[];
};

/** A análise mais recente de uma versão, se houver. */
export const analiseDaVersao = async (versionId: string): Promise<AnaliseDaVersao | null> => {
  const { data, error } = await supabase
    .from('version_analysis')
    .select('*')
    .eq('version_id', versionId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AnaliseDaVersao) ?? null;
};

/**
 * Pede uma análise.
 *
 * `novo` falso quer dizer que já havia uma igual a andar, e o que volta é ELA. Pedir duas vezes
 * a mesma análise da mesma versão é o toque repetido no botão, não um pedido novo — e cada
 * duplicado custaria minutos de CPU.
 */
export const pedirAnalise = async (
  versionId: string,
  tipo: TipoDeAnalise,
): Promise<{ trabalho: TrabalhoDeAudio; novo: boolean }> => {
  const { data, error } = await supabase.functions.invoke('audio-job-create', {
    body: { versionId, tipo },
  });
  if (error) throw new Error(await readEdgeFunctionError(error, 'Não consegui pedir a análise.'));
  if (!data?.trabalho) throw new Error('Não consegui pedir a análise.');
  return { trabalho: data.trabalho as TrabalhoDeAudio, novo: !!data.novo };
};

/**
 * Cancela um trabalho que ainda não começou.
 *
 * Devolve `false` quando já começou: interromper a máquina no meio não é possível de um lado
 * só, e marcar como cancelado o que a CPU ainda está a girar produziria uma linha que mente.
 */
export const cancelarAnalise = async (jobId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('cancelar_trabalho_de_audio', { p_id: jobId });
  if (error) throw error;
  return !!data;
};
