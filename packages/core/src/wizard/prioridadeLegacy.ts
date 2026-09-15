// Matriz de priorização determinística (Metodologia v2).
// Transcrição literal de "Nyta_Matriz_Priorizacao_v2" §2 — notas 1–10 de cada estratégia em cada
// um dos 8 objetivos. Lookup table 53×8 pura, sem LLM.

// Os 8 códigos de objetivo (colunas), nesta ordem.
export type ObjectiveCode = 'DIG' | 'SHW' | 'MRC' | 'MID' | 'CLS' | 'INT' | 'SIM' | 'FIN';
export const OBJECTIVE_CODES: ObjectiveCode[] = ['DIG', 'SHW', 'MRC', 'MID', 'CLS', 'INT', 'SIM', 'FIN'];

// Tupla de 8 notas na ordem de OBJECTIVE_CODES: [DIG, SHW, MRC, MID, CLS, INT, SIM, FIN].
export const PRIORITY: Record<string, [number, number, number, number, number, number, number, number]> = {
  '1': [10, 9, 10, 10, 10, 9, 10, 9],
  '2': [9, 7, 9, 9, 9, 9, 9, 9],
  '3': [8, 7, 8, 8, 8, 8, 8, 10],
  '4': [9, 8, 10, 9, 10, 9, 9, 10],
  '5': [8, 6, 8, 7, 7, 8, 8, 9],
  '6': [10, 9, 10, 10, 10, 10, 9, 9],
  '8': [10, 10, 10, 10, 9, 9, 9, 9],
  '9': [9, 8, 9, 9, 9, 9, 8, 8],
  '10': [10, 9, 9, 9, 10, 9, 10, 8],
  '11': [10, 8, 9, 10, 9, 10, 9, 9],
  '12': [10, 8, 8, 8, 9, 10, 10, 9],
  '13': [9, 8, 9, 9, 9, 10, 9, 9],
  '14': [9, 9, 9, 9, 9, 9, 8, 9],
  '15': [9, 8, 10, 10, 10, 10, 9, 9],
  '17': [10, 7, 8, 9, 8, 8, 9, 7],
  '18': [9, 9, 10, 9, 9, 7, 10, 9],
  '19': [10, 6, 7, 7, 9, 9, 10, 7],
  '20': [9, 6, 9, 9, 9, 6, 10, 6],
  '22': [8, 9, 10, 9, 10, 9, 8, 8],
  '23': [9, 10, 10, 10, 10, 9, 10, 9],
  '24': [8, 10, 10, 10, 10, 8, 10, 8],
  '25': [9, 10, 8, 8, 8, 8, 10, 10],
  '26': [9, 10, 10, 9, 9, 10, 10, 10],
  '29': [9, 10, 9, 9, 9, 8, 10, 10],
  '30': [8, 10, 8, 8, 8, 8, 10, 10],
  '31': [8, 10, 8, 8, 8, 7, 10, 10],
  '32': [10, 10, 10, 10, 9, 9, 10, 9],
  '33': [10, 10, 10, 9, 10, 9, 10, 9],
  '34': [8, 10, 10, 9, 8, 9, 9, 10],
  '35': [8, 9, 8, 8, 8, 8, 9, 9],
  '36': [7, 8, 8, 7, 8, 9, 10, 9],
  '37': [8, 8, 9, 9, 8, 8, 9, 10],
  '38': [9, 9, 10, 10, 9, 9, 10, 10],
  '39': [9, 9, 8, 8, 9, 8, 10, 10],
  '40': [8, 8, 10, 9, 9, 9, 8, 10],
  '41a': [9, 8, 9, 8, 9, 9, 8, 8],
  '41b': [10, 6, 7, 7, 6, 8, 8, 10],
  '42': [9, 9, 9, 9, 10, 9, 10, 8],
  '43': [9, 4, 7, 5, 7, 5, 8, 10],
  '44': [7, 10, 10, 7, 7, 7, 10, 10],
  '46': [8, 9, 9, 8, 8, 8, 10, 9],
  '47': [8, 9, 9, 8, 8, 9, 10, 9],
  '48': [10, 9, 9, 9, 9, 9, 10, 9],
  '49': [8, 8, 10, 10, 10, 9, 9, 9],
  '50': [9, 9, 9, 10, 9, 10, 9, 8],
  '51': [8, 9, 10, 10, 10, 10, 9, 9],
  '52': [8, 8, 9, 9, 9, 10, 8, 8],
  '53': [9, 9, 10, 10, 10, 8, 9, 9],
  '54': [7, 3, 6, 5, 6, 4, 7, 10],
  '55': [7, 3, 7, 6, 6, 5, 7, 9],
  N1: [8, 8, 8, 9, 9, 7, 10, 8],
  N2: [8, 8, 9, 9, 10, 8, 10, 8],
  N3: [10, 9, 10, 10, 10, 8, 10, 8],
};

// Nota de uma estratégia num código de objetivo (default 0 se a estratégia não estiver na matriz).
export const scoreFor = (bankId: string, code: ObjectiveCode): number => {
  const row = PRIORITY[bankId];
  if (!row) return 0;
  return row[OBJECTIVE_CODES.indexOf(code)] ?? 0;
};

// Soma global das 8 notas de uma estratégia — medida de "versatilidade" (desempate §5.2).
export const globalSum = (bankId: string): number => (PRIORITY[bankId] || []).reduce((a, b) => a + b, 0);

// Classificador objetivo (texto livre) → um dos 8 códigos (Matriz §7.6). A taxonomia de Objetivos
// v2 já usa rótulos próximos das colunas, o que torna o casamento por palavra-chave robusto.
// Ordem de teste importa: financeiro e internacional antes dos genéricos; missão simbólica é o
// fallback (coluna de impacto amplo) quando nenhum padrão casa.
export const objectiveToCode = (text: string): ObjectiveCode => {
  const t = (text || '').toLowerCase();
  if (/financ|receita|lucro|sustenta|renda|monetiz|patroc/.test(t)) return 'FIN';
  if (/internacional|exterior|fora do brasil|globaliz/.test(t)) return 'INT';
  if (/cr[íi]tica|m[íi]dia|imprensa|ve[íi]culo|jornal/.test(t)) return 'MID';
  if (/classe art[íi]stica|pares|outros artistas|regrava/.test(t)) return 'CLS';
  if (/agenda|show|palco|turn[êe]|festiv|ao vivo/.test(t)) return 'SHW';
  if (/digit|streaming|redes|seguidor|ouvinte|online|playlist/.test(t)) return 'DIG';
  if (/mercado|reconheci|posicion|contrata/.test(t)) return 'MRC';
  return 'SIM';
};
