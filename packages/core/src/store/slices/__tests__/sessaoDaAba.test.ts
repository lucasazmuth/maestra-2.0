import reducer, { authActions } from '../auth';
import type { AuthState } from '../auth';

// A REGRA QUE IMPEDE A WEB DE SE DESMONTAR SOZINHA.
//
// O supabase-js registra um `visibilitychange` próprio: quando a aba volta ao foco ele reconfere
// a sessão e emite `SIGNED_IN` outra vez, com a MESMA sessão. Repassar isso cru trocava as
// referências de `session` e `user` no store, e todo efeito com `[user]` nas dependências
// disparava de novo — inclusive os gates de consentimento e de admin, que enquanto recarregam
// trocam a árvore inteira por um spinner. Trocar a árvore desmonta a página: o formulário pela
// metade, o rascunho, a rolagem, tudo perdido, sem ninguém ter navegado para lugar nenhum.
//
// Nada disso se vê num teste de renderização de tela, e o defeito só aparece com a pessoa usando
// duas abas — que é como todo mundo usa.

const sessao = (token: string, userId = 'u-1'): any => ({
  access_token: token,
  refresh_token: `r-${token}`,
  user: { id: userId, email: 'quem@usa.com' },
});

const comSessao = (s: any): AuthState =>
  reducer(undefined, authActions.setSession({ session: s }));

describe('a sessão quando a aba volta ao foco', () => {
  it('a mesma sessão não vira um objeto novo', () => {
    const antes = comSessao(sessao('t-1'));

    // O mesmo token, noutro objeto: é exatamente o que o supabase-js entrega no foco.
    const depois = reducer(antes, authActions.setSession({ session: sessao('t-1') }));

    expect(depois.user).toBe(antes.user);
    expect(depois.session).toBe(antes.session);
  });

  // O outro lado da regra: renovação de verdade precisa entrar, senão o app fica com um token
  // vencido na mão e toda chamada passa a voltar 401.
  it('um token novo entra', () => {
    const antes = comSessao(sessao('t-1'));

    const depois = reducer(antes, authActions.setSession({ session: sessao('t-2') }));

    expect(depois.session?.access_token).toBe('t-2');
    expect(depois.user).not.toBe(antes.user);
  });

  it('entrar e sair continuam valendo', () => {
    const entrou = comSessao(sessao('t-1'));
    expect(entrou.user?.id).toBe('u-1');

    const saiu = reducer(entrou, authActions.setSession({ session: null }));
    expect(saiu.user).toBeNull();
    expect(saiu.session).toBeNull();
  });

  // Duas contas seguidas sem passar por `null` no meio: se a comparação olhasse só o id do
  // usuário, ou pior, só a existência da sessão, a segunda pessoa herdaria a primeira.
  it('trocar de pessoa troca o usuário', () => {
    const antes = comSessao(sessao('t-1', 'u-1'));

    const depois = reducer(antes, authActions.setSession({ session: sessao('t-9', 'u-2') }));

    expect(depois.user?.id).toBe('u-2');
  });

  // O evento do foco chega enquanto a tela ainda espera o bootstrap. Ele encerra a espera de
  // qualquer jeito — senão a primeira carga fica presa no spinner global.
  it('mesmo sem novidade, a espera termina', () => {
    const esperando: AuthState = { ...comSessao(sessao('t-1')), requesting: true };

    const depois = reducer(esperando, authActions.setSession({ session: sessao('t-1') }));

    expect(depois.requesting).toBe(false);
  });
});
