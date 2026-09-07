import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// §13.3 — o motor existe em DUAS cópias byte a byte: esta, testada aqui, e a de
// `supabase/functions/artist-diagnostic/realEngine.ts`, que roda no Deno (que não importa de fora
// do diretório da função). Divergirem significa dois diagnósticos diferentes para a mesma
// carreira, e o sintoma seria uma nota errada em produção, não uma tela quebrada.
//
// Quando este teste falhar, a correção é copiar — nunca editar uma cópia para "aproximar" da outra:
//   cp packages/core/src/services/realEngine/index.ts supabase/functions/artist-diagnostic/realEngine.ts
const AQUI = resolve(__dirname, 'index.ts');
const EDGE = resolve(__dirname, '../../../../../supabase/functions/artist-diagnostic/realEngine.ts');

const hash = (caminho: string) => createHash('sha256').update(readFileSync(caminho)).digest('hex');

describe('§13.3 integridade das duas cópias do motor', () => {
  it('a cópia do edge existe', () => {
    expect(existsSync(EDGE)).toBe(true);
  });

  it('as duas cópias são idênticas', () => {
    expect(hash(EDGE)).toBe(hash(AQUI));
  });
});
