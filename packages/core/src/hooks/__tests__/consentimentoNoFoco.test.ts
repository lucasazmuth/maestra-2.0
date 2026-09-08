import { renderHook, waitFor, act } from '@testing-library/react';

const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));

// O hook lê o consentimento pendente do cadastro pela porta de armazenamento.
jest.mock('../../nucleo/ambiente', () => ({
  ambiente: () => ({ armazenamento: { ler: () => null, gravar: () => {}, apagar: () => {} } }),
}));

// eslint-disable-next-line import/first
import { useEstadoDoConsentimento } from '../useConsent';

// O `loading` DESTE hook não é um spinner pequeno num canto: o `RequireConsent` troca a árvore
// inteira da rota por um spinner global enquanto ele for verdade. Ou seja, `loading` é
// "desmonte tudo o que a pessoa está fazendo" — e por isso ele só pode valer quando não há
// realmente nada para mostrar.
//
// Antes disto, qualquer reverificação o ligava de novo. Com o supabase-js reconferindo a sessão
// a cada volta de aba, a conta era: trocar de aba e voltar apagava o formulário pela metade.

const satisfeito = { satisfied: true, blocked: false };

// Objetos ESTÁVEIS de propósito: no app o `user` vem do store, e a correção em `setSession` é
// justamente o que garante que ele não seja recriado a cada evento. Um literal novo a cada
// render aqui dispararia o efeito sozinho e mediria o defeito do teste, não o do produto.
const U1 = { id: 'u-1' };
const U2 = { id: 'u-2' };

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue({ data: satisfeito, error: null });
});

describe('o portão do consentimento quando a aba volta', () => {
  it('a primeira carga mostra o spinner, porque não há nada na tela ainda', async () => {
    const { result } = renderHook(() => useEstadoDoConsentimento(U1));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toEqual(satisfeito);
  });

  // O CASO QUE APAGAVA A PÁGINA.
  //
  // O que importa é o estado DURANTE a reverificação, não depois: se ela abrir e fechar o
  // `loading`, a árvore já foi desmontada e remontada, e o que a pessoa estava preenchendo já
  // se perdeu — mesmo que um instante depois tudo pareça normal. Por isso a resposta fica
  // pendurada aqui, para a asserção cair no meio do caminho.
  it('reverificar a mesma pessoa não volta para o spinner', async () => {
    const { result } = renderHook(() => useEstadoDoConsentimento(U1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let responder: (v: unknown) => void = () => {};
    mockInvoke.mockReturnValue(new Promise((r) => { responder = r; }));

    act(() => { result.current.refresh(); });

    // A chamada está no ar e a tela continua de pé.
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.state).toEqual(satisfeito);

    await act(async () => { responder({ data: satisfeito, error: null }); });
    expect(result.current.loading).toBe(false);
  });

  // O outro lado: quem entra numa conta nova não pode herdar, nem por um instante, o veredito
  // de quem saiu. Este gate é o da maioridade — deixar passar é o erro que não se desfaz.
  it('outra pessoa volta a esperar', async () => {
    const { result, rerender } = renderHook(
      ({ user }) => useEstadoDoConsentimento(user),
      { initialProps: { user: U1 as { id: string } | null } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockInvoke.mockReturnValue(new Promise(() => {})); // a resposta da nova conta ainda não veio
    rerender({ user: U2 });

    expect(result.current.loading).toBe(true);
  });

  it('sem ninguém logado, não espera por nada', async () => {
    const { result } = renderHook(() => useEstadoDoConsentimento(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
