// A LEGENDA DE UMA LINHA DA LISTA DE MÚSICAS.
//
// Ela dizia "V1 · versão principal" — a mesma frase em todas as linhas, que por isso não
// distinguia nenhuma. E o modelo de versões saiu do produto: uma música é uma montagem de
// pistas, não uma pilha de alternativas com uma eleita.
//
// O que serve numa lista é o que MUDA de linha para linha e ajuda a retomar o trabalho: quem
// mexeu por último, e há quanto tempo. O gênero e a data de lançamento ficam, porque já
// estavam e continuam a ser do projeto.

/** Um dia em milissegundos. */
const DIA = 86_400_000;

/**
 * "agora mesmo", "há 3 h", "há 2 dias"…
 *
 * Escrito à mão em vez de puxar uma biblioteca de datas: são cinco faixas, todas em português,
 * e o resultado entra numa linha estreita — o que se ganha aqui é o controlo do comprimento.
 *
 * Devolve `null` para data ausente ou impossível de ler, e para datas no FUTURO: um relógio
 * errado no computador de alguém não pode fazer a lista dizer "há -3 dias".
 */
export const haQuantoTempo = (quando?: string | null, agora: number = Date.now()): string | null => {
  if (!quando) return null;
  const instante = new Date(quando).getTime();
  if (Number.isNaN(instante)) return null;

  const decorrido = agora - instante;
  if (decorrido < 0) return null;

  const minutos = Math.floor(decorrido / 60_000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(decorrido / 3_600_000);
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(decorrido / DIA);
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'há 1 mês';
  if (meses < 12) return `há ${meses} meses`;

  const anos = Math.floor(dias / 365);
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`;
};

export interface DadosDaLegenda {
  /** Quem mexeu por último. ⚠️ Não é quem CRIOU a gravação. */
  last_edited_by?: string | null;
  updated_at?: string | null;
  genre?: string | null;
  release_date?: string | null;
}

/**
 * A legenda pronta.
 *
 * A ordem é a da utilidade: primeiro a última mexida (é o que responde "onde é que eu ia?"),
 * depois o que a música é (gênero) e quando sai.
 *
 * O nome só aparece com o tempo ao lado: "Editado por Ana" sozinho não diz se foi hoje ou no
 * ano passado, e é o "quando" que faz a lista servir para retomar trabalho. Sem nome nenhum, o
 * tempo entra sozinho.
 */
export const legendaDaMusica = (dados: DadosDaLegenda, agora: number = Date.now()): string => {
  const tempo = haQuantoTempo(dados.updated_at, agora);
  const quem = dados.last_edited_by?.trim();

  const edicao = quem && tempo ? `Editado por ${quem} · ${tempo}`
    : quem ? `Editado por ${quem}`
      : tempo ? `Editado ${tempo}`
        : null;

  const lancamento = dados.release_date
    ? new Date(`${dados.release_date}T00:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short',
      })
    : null;

  return [edicao, dados.genre, lancamento].filter(Boolean).join(' · ');
};
