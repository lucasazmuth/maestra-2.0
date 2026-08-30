// Matrizes determinísticas de geração de estratégias (Metodologia v2).
// Transcrição literal de "Nyta_Etapa_Estrategias_v3" §4 (Matriz A), §5 (Matriz B) e §7 (Matriz C).
// Lookup tables puras — sem LLM. Chaves = IDs canônicos de ./swotItems.ts; valores = IDs do banco.

// MATRIZ A — Fraqueza (item interno marcado "melhorar", id 1–20) → estratégias disparadas.
export const MATRIX_A: Record<number, string[]> = {
  1: ['N1'],
  2: ['1', '42', 'N2'],
  3: ['N3'],
  4: ['23', '25'],
  5: ['24', '23'],
  6: ['26', '29', '30', '31', '32', '33'],
  7: ['26'],
  8: ['34', '35', '36', '46'],
  9: ['47', '26', '46'],
  10: ['47', '1', '26'],
  11: ['6'],
  12: ['6', '8', '11'],
  13: ['8', '9'],
  14: ['14', '22'],
  15: ['10', '11', '12', '13', '14'],
  16: ['15', '17', '18'],
  17: ['29', '30', '31', '32', '33', '37', '38', '39', '40', '43', '54', '55', '4', '2', '12'],
  18: ['1', '2', '3', '4', '5'],
  19: ['22', '48', '49'],
  20: ['44', '36', '5'],
};

// MATRIZ B — Oportunidade marcada (id 1–22) → estratégias disparadas.
export const MATRIX_B: Record<number, string[]> = {
  1: ['37'],
  2: ['38'],
  3: ['10', '11', '12', '13', '14'],
  4: ['40', '38'],
  5: ['15', '9'],
  6: ['33', '26', '49', '53'],
  7: ['18'],
  8: ['19'],
  9: ['32', '26', '23'],
  10: ['30', '26'],
  11: ['29'],
  12: ['39'],
  13: ['42'],
  14: ['1', '2'],
  15: ['43'],
  16: ['4', '3'],
  17: ['17', '20', '15'],
  18: ['31', '26'],
  19: ['41a', '41b'],
  20: ['54', '55'],
  21: ['50', '51', '52'],
  22: ['49'],
};

// MATRIZ C — Força focada (item interno marcado "forte", id) → estratégias potencializadas.
// Forças TRANSVERSAIS (1 talento, 8 equipe, 9 profissionalismo, 10 planejamento, 17 investimento)
// NÃO disparam personalização (evita ruído) — por isso não aparecem aqui.
export const MATRIX_C: Record<number, string[]> = {
  2: ['1', '3', '4', '42', '49'],
  3: ['1', '4', '14'],
  4: ['26', '29', '30', '31', '32', '33'],
  5: ['26', '29', '30', '31', '32', '33', '20', '19'],
  6: ['1', '15', '14'],
  7: ['50', '43'],
  11: ['10', '15', '40'],
  12: ['8', '11', '43', '50', '52'],
  13: ['15', '26', '29', '30', '31', '32', '33', '40', '41a'],
  14: ['14', '22', '34', '42', '40', '50', '29', '30', '31', '32', '33'],
  15: ['41b', '40', '14'],
  16: ['1', '15'],
  18: ['1', '3', '4', '14'],
  19: ['26', '29', '30', '31', '32', '33', '40'],
  20: ['2', '3', '37', '38', '40', '50'],
};

// Forças transversais que não personalizam (Estrategias_v3 §7).
export const TRANSVERSAL_FORCES = new Set<number>([1, 8, 9, 10, 17]);
