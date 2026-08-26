import fs from 'fs';
import path from 'path';

// O portão de etapa cobre a conversa quando um passo termina. Ele NÃO cobre o widget da
// priorização, que é um `createPortal(..., document.body)` e portanto vive fora da árvore do
// chat — fica por cima de tudo, inclusive do portão.
//
// Foi assim que "Gerar plano de ação" pareceu não funcionar: o passo avançava e era gravado, mas
// o modal continuava na tela; clicar de novo não fazia nada, porque o `gateRef` já barrava o
// efeito na entrada. Só recarregando a página o wizard "pulava" para a etapa seguinte.
//
// Este teste é sobre a FONTE porque o comportamento vive num efeito com refs e portal: montar o
// wizard inteiro em jsdom para exercitar isso custaria mais do que entrega, e o que precisa ser
// garantido é simples — ao abrir o portão, o widget morre junto.

const fonte = (arquivo: string) =>
  fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8');

describe('portão de etapa', () => {
  const chat = fonte('NytaChat.tsx');

  /** Corpo do `if (stepAtual > anterior) { ... }`, que é quem abre o portão. */
  const blocoDoPortao = (): string => {
    const inicio = chat.indexOf('if (stepAtual > anterior) {');
    expect(inicio).toBeGreaterThan(-1);
    const fim = chat.indexOf('setGate({ concluida: anterior', inicio);
    expect(fim).toBeGreaterThan(inicio);
    return chat.slice(inicio, fim);
  };

  it('desmonta o widget ao abrir o portão', () => {
    expect(blocoDoPortao()).toContain('setWidget(null)');
  });

  it('desmonta também o fluxo guiado e o campo de texto', () => {
    const bloco = blocoDoPortao();
    expect(bloco).toContain('setGuided(null)');
    expect(bloco).toContain('setInputOn(false)');
  });

  // A limpeza precisa vir ANTES do `return`, senão nada disso executa.
  it('limpa antes de sair do efeito', () => {
    const bloco = blocoDoPortao();
    expect(bloco).not.toContain('return;');
  });

  // Se um dia a priorização deixar de usar portal, o acoplamento acima fica menos crítico — mas
  // enquanto usar, o widget POR CIMA do portão é exatamente o bug que voltaria.
  it('a priorização continua sendo um portal para o body', () => {
    const widgets = fonte('widgets.tsx');
    expect(widgets).toContain('document.body');
  });
});
