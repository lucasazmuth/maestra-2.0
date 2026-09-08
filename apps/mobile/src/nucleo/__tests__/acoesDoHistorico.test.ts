import { acoesDoHistorico, type MensagemComAcoes } from '@maestra/core/nucleo/acoesDaNyta';

// O cartão de ação no HISTÓRICO da conversa.
//
// Ele só existia enquanto a ação estava pendente, porque vinha de `pendingToolCalls` — estado de
// memória, que morre ao fechar a tela. Quem voltava à conversa via a Nyta dizer "confirme no card
// abaixo" e nenhum card abaixo, sem saber se o evento chegou a ser criado. O registro sempre
// esteve no banco; ninguém desenhava.

const pediu = (id: string, chamada: string): MensagemComAcoes => ({
  id,
  role: 'assistant',
  toolCalls: [{ id: chamada, name: 'create_event', arguments: { title: 'Show Abril' } }],
});

// O servidor grava `tool_results` como UM OBJETO — ver `nyta-chat/index.ts`. O tipo dizia
// lista, e a primeira leitura de verdade estourou "iterator method is not callable" no
// aparelho. Por isso o caso normal deste arquivo usa a forma do servidor, e não a que o tipo
// prometia.
const respondeu = (chamada: string, success: boolean): MensagemComAcoes => ({
  id: `t-${chamada}`,
  role: 'tool',
  toolResults: { tool_call_id: chamada, success },
});

describe('as ações da Nyta no histórico', () => {
  it('devolve a ação que a mensagem pediu, com os argumentos', () => {
    const msg = pediu('m-1', 'c-1');
    const [acao] = acoesDoHistorico(msg, [msg, respondeu('c-1', true)]);

    expect(acao.name).toBe('create_event');
    expect(acao.arguments).toEqual({ title: 'Show Abril' });
  });

  // O ESTADO SAI DO RESULTADO, e não de um padrão otimista. Um cartão dizendo "executada" para
  // uma ação que falhou é pior do que cartão nenhum: a pessoa deixa de procurar o evento que
  // nunca foi criado.
  describe('o estado sai do resultado', () => {
    it('com sucesso, a ação está executada', () => {
      const msg = pediu('m-1', 'c-1');
      expect(acoesDoHistorico(msg, [msg, respondeu('c-1', true)])[0].status).toBe('done');
    });

    it('sem sucesso, a ação falhou', () => {
      const msg = pediu('m-1', 'c-1');
      expect(acoesDoHistorico(msg, [msg, respondeu('c-1', false)])[0].status).toBe('error');
    });

    // Sem resultado nenhum a ação NÃO terminou — o app fechou no meio, ou a resposta se perdeu.
    // Dizer "executada" aqui seria inventar um desfecho que ninguém observou.
    it('sem resultado, a ação não terminou', () => {
      const msg = pediu('m-1', 'c-1');
      expect(acoesDoHistorico(msg, [msg])[0].status).toBe('executing');
    });
  });

  // O resultado chega numa mensagem `tool` SEPARADA, que pode estar em qualquer ponto da lista.
  // Procurar só na própria mensagem devolveria "executing" para tudo.
  it('acha o resultado numa mensagem posterior da conversa', () => {
    const msg = pediu('m-1', 'c-1');
    const conversa = [msg, { id: 'm-2', role: 'assistant' }, respondeu('c-1', true)];

    expect(acoesDoHistorico(msg, conversa)[0].status).toBe('done');
  });

  it('não confunde o resultado de outra ação', () => {
    const msg = pediu('m-1', 'c-1');
    const conversa = [msg, respondeu('c-outra', false), respondeu('c-1', true)];

    expect(acoesDoHistorico(msg, conversa)[0].status).toBe('done');
  });

  // No instante entre confirmar e a lista recarregar, a mesma ação está viva em
  // `pendingToolCalls` E já gravada no histórico. Sem esta exclusão ela aparece duas vezes na
  // conversa, uma com botões e outra sem.
  it('não repete a ação que a tela já está desenhando ao vivo', () => {
    const msg = pediu('m-1', 'c-1');

    expect(acoesDoHistorico(msg, [msg], ['c-1'])).toEqual([]);
    expect(acoesDoHistorico(msg, [msg], ['c-outra'])).toHaveLength(1);
  });

  // Linhas antigas podem ter a lista que o tipo prometia. As duas formas precisam funcionar.
  it('aceita o resultado em lista, e não só o objeto do servidor', () => {
    const msg = pediu('m-1', 'c-1');
    const emLista: MensagemComAcoes = {
      id: 't-1', role: 'tool', toolResults: [{ tool_call_id: 'c-1', success: true }],
    };

    expect(acoesDoHistorico(msg, [msg, emLista])[0].status).toBe('done');
  });

  it('uma mensagem sem ações não gera cartão', () => {
    const msg = { id: 'm-1', role: 'assistant' };

    expect(acoesDoHistorico(msg, [msg])).toEqual([]);
  });
});
