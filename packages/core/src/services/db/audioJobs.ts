import { supabase } from '../../lib/supabase';
import { readEdgeFunctionError } from '../../lib/edgeError';

// A FILA de análise de áudio, vista do lado do cliente.
//
// O cliente não escreve na fila: `audio_jobs` não tem policy de INSERT, e quem enfileira é a
// edge function `audio-job-create`, que é onde se confere permissão e cota. Daqui só se PEDE,
// se OLHA e se CANCELA o que ainda não começou.

export type TipoDeAnalise = 'bpm_tom' | 'letra' | 'sensorial' | 'converter';
// 'cancelado' é separado de 'erro' de propósito: desistir não é falhar, e a tela mostrava
// "Cancelado." em vermelho ao lado do botão — dizendo que algo deu errado numa ação escolhida.
export type EstadoDoTrabalho = 'na_fila' | 'a_correr' | 'pronto' | 'erro' | 'cancelado';

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
 * O trabalho daquele tipo que ainda dá para cancelar, se houver.
 *
 * Só o que está NA FILA. Interromper a máquina a meio não é possível de um lado só, e marcar
 * como cancelado o que a CPU ainda gira produziria uma linha que mente — então a saída só
 * aparece enquanto ela é verdadeira.
 *
 * Mora aqui, e não nas telas: nasceu duplicado no app e na web, que é como duas cópias de uma
 * regra começam a divergir.
 */
export const cancelavel = (
  trabalhos: TrabalhoDeAudio[],
  tipo: TipoDeAnalise,
): TrabalhoDeAudio | undefined =>
  trabalhos.find((t) => t.tipo === tipo && t.estado === 'na_fila');

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

// ─── O ANDAMENTO OUVIDO SOZINHO ──────────────────────────────────────────────
//
// O detector existe desde sempre e vivia escondido na ficha, atrás de um botão que era preciso
// descobrir. No Espaço JAM ele passa a acontecer por conta própria — e é aí que as regras
// abaixo deixam de ser detalhe: análise custa CPU de verdade e tem cota, e um número que se
// instala sozinho por cima do trabalho de alguém apaga trabalho sem avisar.

/** O andamento que uma música humana quase sempre tem. */
export const ANDAMENTO_COMUM = { minimo: 70, maximo: 180 };

export interface OuvirSozinho {
  /** A gravação já tem áudio? Sem ele a fila recusa o pedido. */
  temAudio: boolean;
  /** O que está escrito no campo, como está escrito. */
  bpmEscrito?: string | number | null;
  analise?: AnaliseDaVersao | null;
  trabalhos: TrabalhoDeAudio[];
  /** Quem só olha não gasta a cota de quem paga. */
  podeEditar: boolean;
}

/**
 * Esta gravação pede uma análise sozinha, sem ninguém carregar em nada?
 *
 * Uma vez por gravação, e a memória disso é o próprio banco: basta ter existido UM trabalho de
 * `bpm_tom` — pronto, com erro, cancelado, o que for — para nunca mais haver pedido automático.
 * Sem isso, cada recarga da página enfileiraria outro, e a cota de dez por mês evaporava numa
 * tarde de trabalho.
 *
 * ⚠️ E SÓ COM O CAMPO VAZIO. Preencher um vazio não é sobrescrever: quem escreveu 92 à mão sabe
 * o que fez, e um detector que discorda dele está errado por definição — o andamento da obra é
 * o que o autor diz que é.
 */
export const podeOuvirSozinho = (entrada: OuvirSozinho): boolean => {
  if (!entrada.podeEditar || !entrada.temAudio) return false;
  if (bpmLegivel(entrada.bpmEscrito)) return false;
  if (entrada.analise) return false;
  return !entrada.trabalhos.some((t) => t.tipo === 'bpm_tom');
};

/**
 * O outro andamento possível: o dobro ou a metade.
 *
 * ⚠️ ESTE É O ERRO CLÁSSICO DE QUALQUER DETECTOR, e não é falta de certeza — é ambiguidade
 * real. Um trap a 140 e o mesmo trap contado em meio-tempo a 70 têm exatamente as mesmas
 * batidas; a máquina escolhe uma e fica confiante nela. Por isso a alternativa não é oferecida
 * "quando a confiança é baixa": é oferecida SEMPRE QUE EXISTE UMA PLAUSÍVEL, que é quando o
 * dobro ou a metade cai na faixa em que a música humana vive.
 *
 * Nunca há duas: dentro daquela faixa, se o dobro cabe, a metade não cabe.
 */
export const outroAndamento = (bpm?: number | string | null): number | null => {
  const n = Number(bpmLegivel(bpm));
  if (!n) return null;
  const cabe = (v: number) => v >= ANDAMENTO_COMUM.minimo && v <= ANDAMENTO_COMUM.maximo;
  const metade = Math.round(n / 2);
  const dobro = Math.round(n * 2);
  if (cabe(metade)) return metade;
  if (cabe(dobro)) return dobro;
  return null;
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
