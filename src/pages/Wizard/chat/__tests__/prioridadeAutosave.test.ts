import fs from 'fs';
import path from 'path';

// A priorização são dezenas de estratégias × todos os objetivos, uma nota por clique: cerca de
// 40 minutos de trabalho. Tudo isso vivia só no estado da aba até o clique final em "Gerar plano
// de ação", que era a ÚNICA gravação — um refresh no meio apagava a etapa inteira, e a pessoa
// voltava para "Como você quer priorizar?". Aconteceu em produção; metade dos planejamentos
// recentes estava parada exatamente nesta etapa, com as estratégias geradas e zero notas salvas.
//
// Como no teste do portão de etapa, este é sobre a FONTE: o comportamento vive num efeito com
// refs e debounce, e montar o wizard inteiro em jsdom para exercitá-lo custaria mais do que
// entrega. O que precisa ser garantido é simples e some fácil numa refatoração — as notas são
// gravadas enquanto a pessoa pontua, e o autosave não atropela o confirm.

const fonte = (arquivo: string) =>
  fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');

describe('autosave da priorização', () => {
  const chat = fonte('NytaChat.tsx');
  const widgets = fonte('widgets.tsx');

  /** Corpo do `<PriorityScale ... />` montado pelo chat. */
  const blocoDaPriorizacao = (): string => {
    const inicio = chat.indexOf('<PriorityScale');
    expect(inicio).toBeGreaterThan(-1);
    const fim = chat.indexOf('/>', inicio);
    expect(fim).toBeGreaterThan(inicio);
    return chat.slice(inicio, fim);
  };

  it('o chat grava as notas conforme são dadas', () => {
    expect(blocoDaPriorizacao()).toContain('onProgress');
  });

  it('grava SEM avançar de etapa — quem avança é o confirm', () => {
    const bloco = blocoDaPriorizacao();
    // `persist({ strategies })` com um segundo argumento levaria a pessoa para fora da
    // priorização a cada nota dada.
    expect(bloco).toMatch(/onProgress=\{\(strategies\) => \{ persist\(\{ strategies \}\); \}\}/);
  });

  it('o widget avisa o progresso a cada mudança das notas', () => {
    // O efeito depende de `list`, que é onde as notas são acumuladas.
    expect(widgets).toMatch(/pendenteRef\.current = list;/);
    expect(widgets).toContain('window.setTimeout(salvarPendente, 700)');
  });

  it('descarrega o que o debounce não levou ao desmontar', () => {
    expect(widgets).toMatch(/useEffect\(\(\) => \(\) => salvarPendente\(\), \[\]\)/);
  });

  it('desliga o autosave ao confirmar, para não apagar as tarefas recém-criadas', () => {
    // Sem isto, uma gravação atrasada aterrissa DEPOIS do `onConfirm` (que grava as estratégias
    // já com as tarefas e avança o step) e sobrescreve o resultado com a versão sem tarefas.
    expect(widgets).toContain('confirmadoRef.current = true;');
    expect(widgets).toMatch(/if \(!pendente \|\| confirmadoRef\.current\) return;/);
  });

  it('retoma a etapa onde parou, e não do começo', () => {
    // `alreadyScored` e o `idx` inicial já sabiam retomar; sem autosave nunca havia dado para
    // retomar. O `objIdx` acompanha: volta ao primeiro objetivo AINDA sem nota.
    expect(widgets).toContain('const alreadyScored = strategies.some((s) => stratComplete(s, objectives.length));');
    expect(widgets).toMatch(/const s = strategies\.find\(\(st\) => !stratComplete\(st, objectives\.length\)\);/);
  });
});
