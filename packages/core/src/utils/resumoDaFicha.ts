// A ficha técnica de uma música numa LINHA só: `128 BPM · Am · Pop · 12/09/2026`.
//
// Nasceu de uma medição. No Espaço JAM do celular, a grelha 2×2 de BPM, tom, gênero e data
// custava 153 pt — o bloco mais alto da tela — e quase sempre mostrava quatro traços. Metade
// do ecrã passava antes da primeira versão, que é o assunto da tela. Uma linha só ocupa o
// que tem para dizer, e quando não tem nada, convida em vez de mostrar traços.
//
// Vive no núcleo porque as duas superfícies desenham a mesma linha na largura de celular, e a
// ORDEM dos itens e o que entra ou não são decisões que não podem divergir entre elas.

export interface DadosDaFicha {
  bpm?: string | number | null;
  /** O tom como a PESSOA o escreveu ("Am", "F#"). Não passa por tradução nenhuma. */
  tom?: string | null;
  genero?: string | null;
  /** A data de lançamento em ISO (`2026-09-12`). */
  lancamento?: string | null;
}

/** O que a linha diz quando a ficha está inteira vazia. */
export const CONVITE_DA_FICHA = 'Adicionar BPM, tom e gênero';

const limpo = (v?: string | number | null): string => String(v ?? '').trim();

/** `2026-09-12` → `12/09/2026`. Meio-dia para o fuso não puxar a data para o dia anterior. */
const dataCurta = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

/**
 * Os pedaços da linha, na ordem fixa BPM → tom → gênero → data, só os que têm valor.
 *
 * A ordem é a da ficha 2×2 que isto substitui, e é fixa de propósito: uma linha que reordena
 * conforme o que está preenchido faz "Pop" aparecer ora no início ora no meio, e o olho deixa
 * de encontrar as coisas no mesmo lugar.
 */
export const partesDaFicha = (dados: DadosDaFicha): string[] => {
  const partes: string[] = [];
  const bpm = limpo(dados.bpm);
  const tom = limpo(dados.tom);
  const genero = limpo(dados.genero);
  const lancamento = limpo(dados.lancamento);
  if (bpm) partes.push(`${bpm} BPM`);
  if (tom) partes.push(tom);
  if (genero) partes.push(genero);
  if (lancamento) {
    const data = dataCurta(lancamento);
    if (data) partes.push(data);
  }
  return partes;
};

/** A linha pronta, ou o convite quando não há nada. */
export const resumoDaFicha = (dados: DadosDaFicha): string => {
  const partes = partesDaFicha(dados);
  return partes.length ? partes.join(' · ') : CONVITE_DA_FICHA;
};

/** Há alguma coisa preenchida? Decide se a linha é resumo ou convite. */
export const fichaVazia = (dados: DadosDaFicha): boolean => partesDaFicha(dados).length === 0;
